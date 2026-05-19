# WebRTC

## The fundamental problem: two browsers can't call each other on their own
When you type a URL into a browser, you're making an outbound connection to a server with a known public IP. Servers are easy - they sit at a fixed address and wait for connections.

Browsers are different. They sit behind:
* A router doing NAT (Network Address Translation). Your laptop has a private IP like `192.168.1.5`, but the internet only sees your router's public IP like `203.0.113.7` via NAT. There's no way for another computer to initiate a connection to `192.168.1.5` from outside your network, because that address means nothing on the public internet.
* Firewalls - both OS-level and router-level, which block unsolicited inbound connections by default.

So two browsers wanting to talk directly face this problem: neither can "call" the other, because neither has a reachable address.

This is where WebRTC comes in, but WebRTC alone can't solve the problem.

## What is WebRTC?

WebRTC is a browser API (and underlying protocol suite) that enables direct peer-to-peer communication - audio, video, and arbitrary data - between browsers. The key word is direct: once connected, traffic doesn't go through any server.

However, "direct" can be misleading. Getting to that direct connection requires solving several networking problems first. WebRTC is really a stack of protocols layered on top of each other:

```
Your app (JSON messages)
 ↓
SCTP     (reliable/ordered delivery, like TCP but for data channels)
 ↓
DTLS     (encryption, like TLS but for UDP)
 ↓
ICE      (figures out the best network path)
 ↓
UDP      (the underlying transport)
```

These are the problems WebRTC solves, in order.

### Problem 1: Finding each other's addresses - STUN
Before two **peers** can connect, each needs to know each other's public addresses.

**STUN** (Session Traversal Utilities for NAT) is a tiny protocol that solves this. You send a UDP packet to a public STUN server (Google runs free ones at `stun.l.google.com:19302`), and it replies telling you: "I received this packet from `203.0.113.7:54321`.", so you now know the public address.

STUN is cheap - one round trip, no ongoing traffic. But it only discovers your external address. It doesn't solve the harder problem of actually getting through NAT.

### Problem 2: Getting through NAT - ICE and hole punching
Knowing your external address isn't enough. Your router is still going to drop any incoming packets it didn't expect. This is where ICE (Interactive Connectivity Establishment) comes in.

ICE is the algorithm that figures out how two peers can actually reach each other. It works by gathering a list of candidates - possible addresses where you might be reachable:
- Host candidates - your actual local IP (`192.168.1.5:PORT`). Useful on LANs.
- Server-reflexive candidates - your external IP/port discovered via STUN (`203.0.113.7:54321`). Useful over the internet.
- Relay candidates - a [TURN](#problem-3-when-hole-punching-fails---turn-relay) server's address. The fallback.

Each peer gathers their own candidates and sends them to the other peer via the signalling server. Nobody discovers the other's addresses - each peer reports their own.

Once both peers have exchanged their candidates, they try all combinations - A's candidate 1 → B's candidate 1, A's candidate 1 → B's candidate 2, and so on. This is called ICE connectivity checks.

| A | B | Result |
|---|---|--------|
| Host | Host | Direct, same LAN |
| Host | Reflexive | Direct, no hole punching needed |
| Reflexive | Host | Direct, no hole punching needed |
| Reflexive | Reflexive | Hole punching needed |
| Host | Relay | TURN relay |
| Relay | Host | TURN relay |
| Reflexive | Relay | TURN relay |
| Relay | Reflexive | TURN relay |
| Relay | Relay | TURN relay |

The clever trick for getting through NAT is called hole punching. 
1. When A sends a UDP packet to B's external address, A's router creates a temporary mapping: "packets coming back from B's address → forward to A." Meanwhile B does the same toward A. 
2. In other words, A sends the "dummy" packet to B and therefore expects a response from B, and vice versa at the same time, allowing A and B to open up to each other.
3. The two routers both punch a "hole" in their NAT tables at roughly the same time, and suddenly packets flow through.

In summary, hole punching occurs for each combination during ICE connectivity checks until a connection is able to be established.

### Problem 3: When hole punching fails - TURN relay
Some NATs are symmetric - they assign a different external port for every different destination you send to. The hole punching trick doesn't work because B's packets arrive from a different address than A expected.

Corporate networks and mobile carriers often do this. This is where TURN (Traversal Using Relays around NAT) comes in. A TURN server is a relay (a middleman server in the cloud both peers can reach) - both peers connect to it (outbound, so firewalls allow it), and it bounces traffic between them.

TURN isn't free - you're paying for bandwidth. The codebase currently only uses STUN, which means it'll fail for some users on strict NATs. A production system would add a TURN provider (Twilio, Metered, Cloudflare).

In summary, ICE selects the best working path from all candidates - preferring direct connections, falling back to TURN only if necessary.

### Problem 4: Agreeing on how to talk - SDP and the offer/answer exchange
Before any media or data can flow, both peers need to agree on:

* What codecs and formats they support
* What security parameters to use (DTLS fingerprints)
* What ICE credentials to use for connectivity checks

This negotiation uses SDP (Session Description Protocol) - a text format that describes a session. It's verbose and ugly, but that's what's under the hood of every offer and answer in the codebase.

The exchange is:
1. Offerer calls `createOffer()` → gets an SDP blob describing its capabilities
2. Offerer calls `setLocalDescription(offer)` → "this is what I said I can do"
3. Offerer sends the SDP to the other peer out of band (this is the signaling - via your tRPC server)
4. Answerer calls `setRemoteDescription(offer)` → "this is what they said they can do"
5. Answerer calls `createAnswer()` → SDP blob that intersects capabilities
6. Answerer calls `setLocalDescription(answer)` → "this is my final decision"
7. Answerer sends the answer back out of band
8. Offerer calls `setRemoteDescription(answer)` → both sides now agree

The browser won't start gathering ICE candidates until `setLocalDescription()` is called.

In summary, the flow is:
1. A creates an SDP offer describing itself
2. A sends it to the tRPC server (signalling server)
3. tRPC server holds it until B polls for it
4. B receives the offer and sends back an SDP answer
5. Now both peers know enough about each other to attempt a connection

> [!NOTE]
> Polling is when a client repeatedly asks the tRPC server "do you have anything for me?" on a timer, rather than the server pushing data to the client when something arrives. This is simple but inefficient, a better SDP implementation would perhaps use websockets.

### Problem 5: Getting the offer/answer to the other peer - Signaling
All of the above (SDP, ICE candidates) needs to be exchanged somehow before the WebRTC connection exists. This is the chicken-and-egg problem: you need a channel to set up the channel.

This out-of-band exchange is called signaling. WebRTC deliberately doesn't specify how to do it - that's your problem. You can use WebSockets, HTTP polling, carrier pigeons, whatever.

This codebase uses HTTP polling via tRPC. When peer A wants to send a signal to peer B:

1. A calls `sendSignal` mutation → server stores it in `SignalQueue` under B's peer ID
2. B polls `getSignals` every second → dequeues and processes everything waiting for it

The SignalQueue is just a `Map<peerId, WebRTCSignal[]>`. Signals auto-expire after 60 seconds to prevent buildup. Polling every second means up to ~1 second of latency in the handshake, which is fine - this only happens once per connection.

WebSockets would be lower latency but add operational complexity. For a LAN tool or low-traffic app, polling is totally fine.

### Problem 6: Sending data - DTLS and SCTP
Once ICE finds a working path, two more protocols layer on top of UDP:

**DTLS** (Datagram TLS) encrypts everything. WebRTC mandates encryption - you can't turn it off. Both peers verify each other's certificate fingerprints (which were exchanged in the SDP), preventing man-in-the-middle attacks. This is why WebRTC connections are secure even though your signaling server is untrusted.

**SCTP** (Stream Control Transmission Protocol) runs over DTLS and gives you the data channel semantics you want:
- Reliable, ordered delivery (like TCP)
- Or unreliable, unordered (useful for games where old state is worthless)
- Multiple independent streams, so one large message doesn't block others

## WebRTC Implementation Architecture
```
┌─────────────────────────────────────────────────────────────┐
│  BROWSER A                           BROWSER B              │
│                                                             │
│  useP2P()                            useP2P()               │
│    ↓ polls every 1s                    ↓ polls every 1s     │
│  getSignals ←──────┐      ┌──────→ getSignals               │
│                    │      │                                 │
│  sendSignal ───────┼──────┼──────→ WebRTCManager            │
│  (offer/answer/    │      │        SignalQueue              │
│   ICE candidates)  │      │                                 │
│                    └──────┘                                 │
│         Next.js tRPC server (signaling only)                │
│                    │                                        │
│  Once ICE finds a path:                                     │
│                                                             │
│  p2p-network.ts ←─────────────────────────→ p2p-network.ts  │
│  RTCDataChannel  (direct UDP, server gone)  RTCDataChannel  │
└─────────────────────────────────────────────────────────────┘
```

The tRPC server is only the signaling channel. Once the `RTCDataChannel` opens, `broadcast()` and `sendToPeer()` send JSON directly, and `getSignals` polling becomes a no-op (something that runs but does nothing meaningful).

The fallback path (`sendMessage`/`getMessages`) exists for when ICE completely fails - the server becomes a message relay, which is slower and has server costs, but keeps the app working.

## The LAN discovery layer
This solves a different problem: what if you're running two server instances on the same LAN (e.g. a team app running on two laptops)?

Each server instance needs to know about peers registered on other instances. It does this by broadcasting UDP heartbeats over multicast (`239.255.42.99:41235`). Multicast means "send once, all interested parties on the LAN receive it" - more efficient than broadcast.

Every heartbeat contains the node's `baseUrl` and its current peer list. When a remote peer's signal needs to be forwarded, `lanDiscovery.resolvePeer()` finds which node hosts it, and `forwardSignal()` HTTP-POSTs the signal to that node's `/api/p2p/relay` endpoint - which then puts it in that node's local `SignalQueue`.

For a single-server deployment this whole layer is invisible - `resolvePeer()` always returns `kind: "local"` and signals go straight to the local queue.