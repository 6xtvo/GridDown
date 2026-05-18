import type { WebRTCSignal } from "./p2p";

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
