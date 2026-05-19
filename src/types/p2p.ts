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
