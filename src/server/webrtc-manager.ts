/**
 * WebRTC Connection Manager - Handles peer connections and signaling
 * Server-side utility for managing WebRTC connections
 */

import type { P2PMessage, WebRTCSignal } from "@/server/p2p-types";

export interface PeerConnection {
	peerId: string;
	connected: boolean;
	metadata?: Record<string, unknown>;
}

export interface WebRTCManagerConfig {
	iceServers?: RTCIceServer[];
	maxConnections?: number;
	signalTimeout?: number; // ms
}

/**
 * Stores pending signals waiting to be picked up by peers
 */
export class SignalQueue {
	private queue: Map<string, WebRTCSignal[]> = new Map();
	private cleanup: Map<string, NodeJS.Timeout> = new Map();
	private readonly SIGNAL_TTL = 60000; // 1 minute

	enqueue(signal: WebRTCSignal): void {
		const key = signal.to;

		if (!this.queue.has(key)) {
			this.queue.set(key, []);
		}

		this.queue.get(key)?.push(signal);

		// Set auto-cleanup
		const existingTimeout = this.cleanup.get(`${signal.from}-${signal.to}`);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
		}

		const timeout = setTimeout(() => {
			this.dequeueAll(signal.to);
			this.cleanup.delete(`${signal.from}-${signal.to}`);
		}, this.SIGNAL_TTL);

		this.cleanup.set(`${signal.from}-${signal.to}`, timeout);
	}

	dequeue(
		peerId: string,
		filter?: (signal: WebRTCSignal) => boolean,
	): WebRTCSignal[] {
		const signals = this.queue.get(peerId) ?? [];

		if (!filter) {
			this.queue.delete(peerId);
			return signals;
		}

		const filtered = signals.filter(filter);
		const remaining = signals.filter((s) => !filter(s));

		if (remaining.length > 0) {
			this.queue.set(peerId, remaining);
		} else {
			this.queue.delete(peerId);
		}

		return filtered;
	}

	dequeueAll(peerId: string): WebRTCSignal[] {
		const signals = this.queue.get(peerId) ?? [];
		this.queue.delete(peerId);
		return signals;
	}

	size(): number {
		let total = 0;
		for (const signals of this.queue.values()) {
			total += signals.length;
		}
		return total;
	}

	clear(): void {
		this.queue.clear();
		for (const timeout of this.cleanup.values()) {
			clearTimeout(timeout);
		}
		this.cleanup.clear();
	}
}

/**
 * In-memory message buffer for peer-to-peer messages
 */
export class MessageBuffer {
	private buffer: Map<string, P2PMessage[]> = new Map();
	private readonly MESSAGE_TTL = 300000; // 5 minutes

	enqueue(peerId: string, message: P2PMessage): void {
		if (!this.buffer.has(peerId)) {
			this.buffer.set(peerId, []);
		}

		this.buffer.get(peerId)?.push(message);

		// Auto cleanup after TTL
		setTimeout(() => {
			this.dequeue(peerId, 1); // Remove oldest
		}, this.MESSAGE_TTL);
	}

	dequeue(peerId: string, count: number = -1): P2PMessage[] {
		const messages = this.buffer.get(peerId) ?? [];

		if (count === -1) {
			this.buffer.delete(peerId);
			return messages;
		}

		const removed = messages.splice(0, Math.min(count, messages.length));

		if (messages.length === 0) {
			this.buffer.delete(peerId);
		} else {
			this.buffer.set(peerId, messages);
		}

		return removed;
	}

	peek(peerId: string, count: number = 10): P2PMessage[] {
		return (this.buffer.get(peerId) ?? []).slice(0, count);
	}

	pending(peerId: string): number {
		return (this.buffer.get(peerId) ?? []).length;
	}

	clear(): void {
		this.buffer.clear();
	}
}

/**
 * WebRTC Manager - Central coordinator for all WebRTC operations
 */
export class WebRTCManager {
	private signalQueue = new SignalQueue();
	private messageBuffer = new MessageBuffer();
	private connections: Map<string, PeerConnection> = new Map();
	private config: Required<WebRTCManagerConfig>;

	constructor(config: WebRTCManagerConfig = {}) {
		this.config = {
			iceServers: config.iceServers ?? [
				{ urls: ["stun:stun.l.google.com:19302"] },
			],
			maxConnections: config.maxConnections ?? 100,
			signalTimeout: config.signalTimeout ?? 30000,
		};
	}

	/**
	 * Queue a WebRTC signal (offer/answer/ICE candidate)
	 */
	queueSignal(signal: WebRTCSignal): void {
		this.signalQueue.enqueue(signal);
	}

	/**
	 * Retrieve queued signals for a peer
	 */
	getSignals(
		peerId: string,
		type?: "offer" | "answer" | "ice-candidate",
	): WebRTCSignal[] {
		return this.signalQueue.dequeue(
			peerId,
			(signal) => !type || signal.type === type,
		);
	}

	/**
	 * Store a message for delivery to peer
	 */
	storeMessage(peerId: string, message: P2PMessage): void {
		this.messageBuffer.enqueue(peerId, message);
	}

	/**
	 * Retrieve messages for a peer
	 */
	getMessages(peerId: string, count?: number): P2PMessage[] {
		return this.messageBuffer.dequeue(peerId, count);
	}

	/**
	 * Check pending messages count
	 */
	hasPendingMessages(peerId: string): number {
		return this.messageBuffer.pending(peerId);
	}

	/**
	 * Register a peer connection
	 */
	registerConnection(peerId: string, metadata?: Record<string, unknown>): void {
		if (this.connections.size >= this.config.maxConnections) {
			throw new Error("Max connections reached");
		}

		this.connections.set(peerId, {
			peerId,
			connected: true,
			metadata,
		});
	}

	/**
	 * Close a peer connection
	 */
	closeConnection(peerId: string): void {
		this.connections.delete(peerId);
	}

	/**
	 * Get all active connections
	 */
	getConnections(): PeerConnection[] {
		return Array.from(this.connections.values());
	}

	/**
	 * Get connection count
	 */
	getConnectionCount(): number {
		return this.connections.size;
	}

	/**
	 * Get ICE server configuration
	 */
	getIceServers(): RTCIceServer[] {
		return this.config.iceServers;
	}

	/**
	 * Clear all data
	 */
	clear(): void {
		this.signalQueue.clear();
		this.messageBuffer.clear();
		this.connections.clear();
	}
}

/**
 * Create and export singleton instance
 */
export const webrtcManager = new WebRTCManager();
