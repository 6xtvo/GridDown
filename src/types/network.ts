/**
 * Callback responsible for delivering a WebRTC signal to its recipient.
 */
export type SignalSender = (signal: WebRTCSignal) => void;

/**
 * Configuration required to initialise the WebRTC network layer.
 */
export interface NetworkConfig {
	/** The local peer's unique identifier. */
	peerId: string;

	/** ICE servers (STUN/TURN) used for NAT traversal. Defaults to public STUN if omitted. */
	iceServers?: RTCIceServer[];

	/** Function used to dispatch outbound signals to remote peers. */
	sendSignal: SignalSender;
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
 * A single IPv4 network interface on the local machine.
 */
export interface IPv4Interface {
	/** The interface's IPv4 address (e.g. `"192.168.1.42"`). */
	address: string;

	/** The subnet mask (e.g. `"255.255.255.0"`). */
	netmask: string;
}
