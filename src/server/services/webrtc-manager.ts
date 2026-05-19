import { MessageBuffer } from "@/lib/message-buffer";
import { SignalQueue } from "@/lib/signal-queue";
import type { WebRTCSignal } from "@/types/network";
import type { P2PMessage } from "@/types/p2p";

/**
 * Maximum number of concurrently registered peer connections.
 */
const MAX_CONNECTIONS = 100;

/**
 * Server-side coordinator for WebRTC peer connections.
 *
 * Because WebRTC signalling requires an out-of-band channel, this class acts
 * as a lightweight signalling server: peers push signals and messages here,
 * and recipients poll for them via tRPC. It also tracks registered connections
 * and vends ICE server config to clients.
 */
export class WebRTCManager {
	private signalQueue = new SignalQueue();
	private messageBuffer = new MessageBuffer();
	private connections = new Map<
		string,
		{ peerId: string; metadata?: Record<string, unknown> }
	>();

	/**
	 * ICE servers provided to clients to assist with NAT traversal.
	 */
	private readonly iceServers: RTCIceServer[] = [
		{ urls: ["stun:stun.l.google.com:19302"] },
	];

	/**
	 * Enqueues a WebRTC signal for the recipient to collect on their next poll.
	 * @param {WebRTCSignal} signal - The signal to queue
	 */
	public queueSignal(signal: WebRTCSignal): void {
		this.signalQueue.enqueue(signal);
	}

	/**
	 * Dequeues and returns all pending signals for the given peer.
	 * @param {string} peerId - The polling peer's ID
	 * @returns {WebRTCSignal[]} All pending signals, or `[]` if none
	 */
	public getSignals(peerId: string): WebRTCSignal[] {
		return this.signalQueue.dequeue(peerId);
	}

	/**
	 * Buffers an application message for a peer that is not yet directly reachable.
	 * @param {string} peerId - The recipient peer's ID
	 * @param {P2PMessage} message - The message to buffer
	 */
	public storeMessage(peerId: string, message: P2PMessage): void {
		this.messageBuffer.enqueue(peerId, message);
	}

	/**
	 * Dequeues and returns up to `count` buffered messages for the given peer.
	 * @param {string} peerId - The polling peer's ID
	 * @param {number} count - Maximum number of messages to return
	 * @returns {P2PMessage[]} The dequeued messages, or `[]` if none
	 */
	public getMessages(peerId: string, count: number): P2PMessage[] {
		return this.messageBuffer.dequeue(peerId, count);
	}

	/**
	 * Returns the number of buffered messages waiting for the given peer.
	 * @param {string} peerId - The peer to check
	 * @returns {number} Count of pending messages
	 */
	public hasPendingMessages(peerId: string): number {
		return this.messageBuffer.pending(peerId);
	}

	/**
	 * Registers a peer connection, associating optional metadata with the peer ID.
	 * Throws if {@link MAX_CONNECTIONS} has been reached.
	 * @param {string} peerId - The peer to register
	 * @param {Record<string, unknown>} [metadata] - Optional metadata to attach
	 * @throws {Error} If the connection limit has been reached
	 */
	public registerConnection(
		peerId: string,
		metadata?: Record<string, unknown>,
	): void {
		if (this.connections.size >= MAX_CONNECTIONS) {
			throw new Error("Max connections reached");
		}
		this.connections.set(peerId, { peerId, metadata });
	}

	/**
	 * Removes a registered peer connection.
	 * @param {string} peerId - The peer to deregister
	 */
	public closeConnection(peerId: string): void {
		this.connections.delete(peerId);
	}

	/**
	 * Returns the list of ICE servers to provide to WebRTC clients.
	 * @returns {RTCIceServer[]} The configured ICE servers
	 */
	public getIceServers(): RTCIceServer[] {
		return this.iceServers;
	}

	/** Clears all signals, messages, and registered connections. Primarily for testing. */
	public clear(): void {
		this.signalQueue.clear();
		this.messageBuffer.clear();
		this.connections.clear();
	}
}

/**
 * Process-wide singleton - reused across Next.js hot reloads via `globalThis`.
 * Import this instead of constructing `WebRTCManager` directly.
 */
const globalForWebRTC = globalThis as { __webrtcManager?: WebRTCManager };

export const webrtcManager =
	globalForWebRTC.__webrtcManager ?? new WebRTCManager();

if (process.env.NODE_ENV !== "production") {
	globalForWebRTC.__webrtcManager = webrtcManager;
}
