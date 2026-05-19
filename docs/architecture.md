## The Big Picture
The system builds a peer-to-peer mesh where browsers talk directly to each other via WebRTC data channels. The Next.js server only exists to bootstrap connections - once two peers are linked, traffic flows browser-to-browser with zero server involvement. There's also a LAN discovery layer so multiple Next.js server instances on the same network can find each other.

## Layer 1: Types (`p2p-types.ts`)
Three shared shapes used everywhere:

* `PeerInfo` - who a peer is (id, IP, metadata, last heartbeat)
* `WebRTCSignal` - a signaling envelope: `offer`, `answer`, or `ice-candidate`, with `from`/`to` peer IDs
* `P2PMessage` - the actual application data once peers are connected


## Layer 2: Server-side infrastructure
`MemoryPeerRegistry`
A simple in-memory Map<peerId, PeerInfo>. Peers register themselves on page load, unregister on unload, and it has a cleanup() method to evict stale entries. No persistence - it resets on server restart.

`WebRTCManager` (`webrtc-manager.ts`)
Two queues that act as a temporary post-office during connection setup:

`SignalQueue` - holds offer/answer/ice-candidate messages addressed to a peer until they come to pick them up. Signals auto-expire after 60 seconds. This is the core of your signaling server.

`MessageBuffer` - holds fallback application messages (for when WebRTC itself fails) for up to 5 minutes. Once WebRTC is working, this goes idle.
The manager also tracks active connections and returns ICE server config (currently just Google's public STUN).

`LanDiscovery` (`lan-discovery.t`s)
This is the most complex piece. When you run multiple Next.js instances on the same LAN (e.g. two laptops), they need to find each other's peers. It works via:

* A UDP multicast socket on port 41235, group `239.255.42.99`
* Every 5 seconds, each server instance broadcasts a **heartbeat** containing its `nodeId`,` baseUrl`, and the list of peers it knows about
* When a heartbeat arrives from another node, it's stored as a `RemoteNode`
* Stale nodes (no heartbeat in 20s) are evicted
* When a signal needs to go to a peer on a different node, `resolvePeer()` finds which node hosts it and `forwardSignal()` HTTP-POSTs it to that node's `/api/p2p/relay` endpoint

For single-machine setups, this layer is basically dormant.

## Layer 3: tRPC router (`p2p.ts`)
The API surface that clients talk to. All procedures are public (no auth):

|Procedure|Kind|What it does|
|-|-|-|
|register|mutation|Adds peer to registry + LAN discovery + WebRTCManager|
|unregister|mutation|Removes peer from all three|
|listPeers|query|Returns all known peers, including those from remote LAN nodes|
|sendSignal|mutation|Routes signal to local queue or forwards to remote node|
|getSignals|query|Dequeues and returns all pending signals for a peer|
|sendMessage|mutation|Fallback: routes message to local buffer or remote node|
|getMessages|query|Dequeues fallback messages for a peer|
|getIceServers|query|Returns STUN/TURN config|
|cleanupStalePeers|mutation|Evicts peers older than `maxAge`|
|getPeer|query|Looks up a single peer|

## Layer 4: Client-side WebRTC (`p2p-network.ts`)
The `P2PNetwork` class manages the actual browser WebRTC connections. It's a singleton (stored on `globalThis`) so it survives React re-renders.

**Connection lifecycle**
Who initiates? The peer with the *lexicographically lower* `peerId `initiates. This prevents both peers from simultaneously trying to create offers to each other.
```
Peer "aaa" sees "zzz" → "aaa" < "zzz" → "aaa" creates offer
Peer "zzz" sees "aaa" → "zzz" > "aaa" → "zzz" waits for offer
```
**Connection setup flow:**
```
Initiator ("aaa")                    Server                    Responder ("zzz")
     |                                  |                            |
     |-- createOffer() ---------------→ |                            |
     |   setLocalDescription(offer)     |                            |
     |-- sendSignal(offer) ----------→  |                            |
     |                                  |-- getSignals() ----------→ |
     |                                  |                  handleOffer()
     |                                  |                  setRemoteDescription()
     |                                  |                  createAnswer()
     |                                  |← sendSignal(answer) -------|
     |← getSignals() -------------------|                            |
     |   handleAnswer()                 |                            |
     |   setRemoteDescription()         |                            |
     |                                  |                            |
     |←←←←←← ICE candidates flow both ways via sendSignal ←←←←←←←←←←←|
     |                                  |                            |
     |←←←←←←←←←← RTCDataChannel "p2p" open - server bypassed ←←←←←←←←|
```
**Data channel**
Once open, the `RTCDataChannel` named `"p2p"` carries all messages as JSON strings. The `attachChannel()` method wires up:

* `onmessage` → parses JSON and fires all registered listeners
* `onopen` → flushes any queued messages that arrived before the channel was ready
* `onclose` → cleans up

**Pending ICE candidates**
ICE candidates can arrive before `setRemoteDescription()` has been called (a race condition). The code handles this by buffering them in `pendingIce` and flushing them in `flushIce()` once the remote description is set.

## Layer 5: React hook (`use-p2p.ts`)
This is the glue between tRPC polling and the network singleton:
```
useEffect: register on mount, unregister on unmount
                    ↓
useQuery(getIceServers) → network.configure(...)
                    ↓
useQuery(listPeers, refetch 3s) → network.updatePeers(...)
  → closes connections to gone peers
  → opens connections to new peers (if lower ID)
                    ↓
useQuery(getSignals, refetch 1s) → network.handleSignals(...)
  → processes offer/answer/ice-candidate
                    ↓
network.onMessage(onMessage) → your app callback
```
Polling every 1 second for signals is the "heartbeat" of the signaling phase. Once WebRTC is connected, signals stop being generated, so this polling becomes a no-op (just empty arrays coming back).

**End-to-end example**

1. User A opens the page → `register("peerA")` → server knows about A
2. User B opens the page → `register("peerB")` → server knows about A and B
3. Both poll `listPeers` → both see each other
4. "peerA" < "peerB", so A calls `ensureConnection("peerB", initiator=true)`
5. A creates an offer, calls `sendSignal({from:A, to:B, type:"offer", ...})`
6. Server stores offer in `SignalQueue` for B
7. B's 1s poll fires `getSignals("peerB")` → gets the offer
8. B calls `handleOffer()`, creates answer, calls `sendSignal({type:"answer", ...})`
9. A's poll picks up the answer → `handleAnswer()`
10. ICE candidates exchange similarly via `sendSignal`/`getSignals`
11. `DataChannel` opens → server is no longer in the loop
12. A calls `broadcast({type:"chat", data:"hello"})` → goes directly to B's browser