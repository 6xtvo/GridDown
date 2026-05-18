import type { P2PMessage, WebRTCSignal } from "@/types/p2p";

/**
 * How long a queued signal is retained before being auto-expired.
 */
const SIGNAL_TTL = 60_000; // 1 minute

/**
 * How long a buffered message is retained before being auto-expired.
 */
const MESSAGE_TTL = 300_000; // 5 minutes

/**
 * Maximum number of concurrently registered peer connections.
 */
const MAX_CONNECTIONS = 100;

/**
 * Stores inbound WebRTC signals (offers, answers, ICE candidates) keyed by
 * the recipient peer ID. Signals are held until the recipient polls for them
 * or until they expire after {@link SIGNAL_TTL}.
 */
class SignalQueue {
	private queue = new Map<string, WebRTCSignal[]>();

	/**
	 * Returns a copy of the signal with a guaranteed `id`, generating one if absent.
	 * @param {WebRTCSignal} signal - The signal to ensure an ID for
	 * @returns {WebRTCSignal} The signal with `id` set
	 */
	private ensureId(signal: WebRTCSignal): WebRTCSignal {
		return { ...signal, id: signal.id ?? crypto.randomUUID() };
	}

	/**
	 * Adds a signal to the recipient's queue and schedules its expiry.
	 * @param {WebRTCSignal} signal - The signal to enqueue
	 */
	enqueue(signal: WebRTCSignal): void {
		const storedSignal = this.ensureId(signal);
		const existing = this.queue.get(signal.to) ?? [];

		existing.push(storedSignal);
		this.queue.set(signal.to, existing);

		setTimeout(() => {
			const signals = this.queue.get(signal.to);

			if (!signals) return;

			const filtered = signals.filter((s) => s.id !== storedSignal.id);

			if (filtered.length === 0) {
				this.queue.delete(signal.to);
			} else {
				this.queue.set(signal.to, filtered);
			}
		}, SIGNAL_TTL);
	}

	/**
	 * Removes and returns all queued signals for the given peer.
	 * @param {string} peerId - The peer to dequeue signals for
	 * @returns {WebRTCSignal[]} All pending signals, or `[]` if none
	 */
	dequeue(peerId: string): WebRTCSignal[] {
		const signals = this.queue.get(peerId) ?? [];
		this.queue.delete(peerId);
		return signals;
	}

	/** Removes all queued signals for all peers. */
	clear(): void {
		this.queue.clear();
	}
}

/**
 * Buffers inbound application messages keyed by the recipient peer ID.
 * Messages are held until polled or until they expire after {@link MESSAGE_TTL}.
 */
class MessageBuffer {
	private buffer = new Map<string, P2PMessage[]>();

	/**
	 * Returns a copy of the message with a guaranteed `id`, generating one if absent.
	 * @param {P2PMessage} message - The message to ensure an ID for
	 * @returns {P2PMessage} The message with `id` set
	 */
	private ensureId(message: P2PMessage): P2PMessage {
		return { ...message, id: message.id ?? crypto.randomUUID() };
	}

	/**
	 * Adds a message to the recipient's buffer and schedules its expiry.
	 * @param {string} peerId - The recipient peer ID
	 * @param {P2PMessage} message - The message to buffer
	 */
	public enqueue(peerId: string, message: P2PMessage): void {
		const storedMessage = this.ensureId(message);
		const existing = this.buffer.get(peerId) ?? [];

		existing.push(storedMessage);
		this.buffer.set(peerId, existing);

		setTimeout(() => {
			const messages = this.buffer.get(peerId);

			if (!messages) return;

			const filtered = messages.filter((m) => m.id !== storedMessage.id);

			if (filtered.length === 0) {
				this.buffer.delete(peerId);
			} else {
				this.buffer.set(peerId, filtered);
			}
		}, MESSAGE_TTL);
	}

	/**
	 * Removes and returns up to `count` messages for the given peer, oldest first.
	 * @param {string} peerId - The peer to dequeue messages for
	 * @param {number} count - Maximum number of messages to return
	 * @returns {P2PMessage[]} The dequeued messages, or `[]` if none
	 */
	public dequeue(peerId: string, count: number): P2PMessage[] {
		const messages = this.buffer.get(peerId) ?? [];
		const taken = messages.splice(0, count);

		if (messages.length === 0) {
			this.buffer.delete(peerId);
		} else {
			this.buffer.set(peerId, messages);
		}

		return taken;
	}

	/**
	 * Returns the number of buffered messages waiting for the given peer.
	 * @param {string} peerId - The peer to check
	 * @returns {number} Count of pending messages
	 */
	public pending(peerId: string): number {
		return (this.buffer.get(peerId) ?? []).length;
	}

	/**
	 * Removes all buffered messages for all peers.
	 */
	public clear(): void {
		this.buffer.clear();
	}
}

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
