/**
 * Represents a peer in the P2P network.
 */
export interface PeerInfo {
	/** Unique identifier for the peer. */
	peerId: string;

	/** IP address of the peer. */
	ip: string;

	/** Port the peer is listening on, if known. */
	port?: number;

	/** Metadata attached to this peer. */
	metadata?: Record<string, unknown>;

	/** Unix timestamp (ms) of the last time this peer was seen active. */
	lastSeen: number;
}

/**
 * A WebRTC signalling message exchanged between peers during connection setup.
 */
export interface WebRTCSignal {
	/** Optional unique identifier for this signal message. */
	id?: string;

	/** Peer ID of the sender. */
	from: string;

	/** Peer ID of the intended recipient. */
	to: string;

	/** Signal type - drives the WebRTC handshake state machine. */
	type: "offer" | "answer" | "ice-candidate";

	/** Signal payload (SDP or ICE candidate serialised as a plain object). */
	data: Record<string, unknown>;

	/** Unix timestamp (ms) of when this signal was created. */
	timestamp: number;
}

/**
 * An application-level message sent over an established P2P data channel.
 */
export interface P2PMessage {
	/** Optional unique identifier for this message. */
	id?: string;

	/** Peer ID of the sender. */
	from: string;

	/** Application-defined message type used for routing/handling. */
	type: string;

	/** Message payload - shape determined by `type`. */
	data: unknown;

	/** Unix timestamp (ms) of when this message was created. */
	timestamp: number;
}

/**
 * Options for the useP2P hook.
 */
export interface UseP2POptions {
	/** The local peer's unique identifier. */
	peerId: string;

	/** Called whenever a message is received from any connected peer. */
	onMessage?: (message: P2PMessage) => void;
}
