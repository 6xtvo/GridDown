import type { P2PMessage, PeerInfo, WebRTCSignal } from "./p2p";

/**
 * Payload sent through the relay server.
 * Either forwards a WebRTC signal or an application message between peers.
 */
export type RelayPayload =
	| {
			/** Relay a WebRTC signalling message (offer/answer/ICE candidate). */
			type: "signal";

			/** Auth token identifying the sending peer to the relay. */
			token: string;

			signal: WebRTCSignal;
	  }
	| {
			/** Relay an application-level message between peers. */
			type: "message";

			/** Auth token identifying the sending peer to the relay. */
			token: string;

			message: P2PMessage;
	  };

/**
 * UDP broadcast packet emitted periodically by each node on the LAN
 * so that peers can discover one another without a central registry.
 */
export interface LanHeartbeat {
	/** Protocol version - increment when the shape changes. */
	version: 1;

	/** Unique identifier for the broadcasting node. */
	nodeId: string;

	/** HTTP base URL at which this node's API is reachable on the LAN. */
	baseUrl: string;

	/** Optional relay URLs this node can offer to peers that need them. */
	relayUrls?: string[];

	/** Peers currently known to this node, piggybacked for faster discovery. */
	peers: PeerInfo[];

	/** Unix timestamp (ms) of when this heartbeat was emitted. */
	timestamp: number;
}

/**
 * A remote node discovered via LAN heartbeat or relay registration.
 * Tracks connectivity info and the peers reachable through that node.
 */
export interface RemoteNode {
	/** Unique identifier for this remote node. */
	nodeId: string;

	/** HTTP base URL at which this node's API is reachable. */
	baseUrl: string;

	/** Relay URLs advertised by this node. */
	relayUrls: string[];

	/** Unix timestamp (ms) of the last received heartbeat from this node. */
	lastSeen: number;

	/** Peers known to be reachable via this node. */
	peers: PeerInfo[];
}

/**
 * Describes where a peer is located relative to the local node.
 * */
export interface PeerLocation {
	/** Whether the peer is on the same LAN, behind a remote node, or not yet resolved. */
	kind: "local" | "remote" | "unknown";

	/** Base URL of the node hosting this peer - present when `kind` is "remote". */
	baseUrl?: string;

	/** Relay URLs that can forward traffic to this peer - present when `kind` is "remote". */
	relayUrls?: string[];
}

/**
 * A single IPv4 network interface on the local machine.
 */
export interface IPv4Interface {
	/** The interface's IPv4 address (e.g. `"192.168.1.42"`). */
	address: string;

	/** The subnet mask (e.g. `"255.255.255.0"`). */
	netmask: string;
}
