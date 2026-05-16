/**
 * WebRTC Manager
 * Queues signals and messages between peers on the server side.
 * Peers poll for their pending signals/messages via tRPC.
 */

import type { P2PMessage, WebRTCSignal } from "@/server/p2p-types";

const SIGNAL_TTL = 60_000;  // 1 minute
const MESSAGE_TTL = 300_000; // 5 minutes
const MAX_CONNECTIONS = 100;

class SignalQueue {
	private queue = new Map<string, WebRTCSignal[]>();

	enqueue(signal: WebRTCSignal): void {
		const existing = this.queue.get(signal.to) ?? [];
		existing.push(signal);
		this.queue.set(signal.to, existing);

		// Auto-expire signals
		setTimeout(() => {
			const signals = this.queue.get(signal.to);
			if (!signals) return;
			const filtered = signals.filter((s) => s.timestamp !== signal.timestamp);
			if (filtered.length === 0) {
				this.queue.delete(signal.to);
			} else {
				this.queue.set(signal.to, filtered);
			}
		}, SIGNAL_TTL);
	}

	dequeue(peerId: string): WebRTCSignal[] {
		const signals = this.queue.get(peerId) ?? [];
		this.queue.delete(peerId);
		return signals;
	}

	clear(): void {
		this.queue.clear();
	}
}

class MessageBuffer {
	private buffer = new Map<string, P2PMessage[]>();

	enqueue(peerId: string, message: P2PMessage): void {
		const existing = this.buffer.get(peerId) ?? [];
		existing.push(message);
		this.buffer.set(peerId, existing);

		// Auto-expire messages
		setTimeout(() => {
			const messages = this.buffer.get(peerId);
			if (!messages) return;
			const filtered = messages.filter((m) => m.timestamp !== message.timestamp);
			if (filtered.length === 0) {
				this.buffer.delete(peerId);
			} else {
				this.buffer.set(peerId, filtered);
			}
		}, MESSAGE_TTL);
	}

	dequeue(peerId: string, count = 10): P2PMessage[] {
		const messages = this.buffer.get(peerId) ?? [];
		const taken = messages.splice(0, count);
		if (messages.length === 0) {
			this.buffer.delete(peerId);
		} else {
			this.buffer.set(peerId, messages);
		}
		return taken;
	}

	pending(peerId: string): number {
		return (this.buffer.get(peerId) ?? []).length;
	}

	clear(): void {
		this.buffer.clear();
	}
}

export class WebRTCManager {
	private signalQueue = new SignalQueue();
	private messageBuffer = new MessageBuffer();
	private connections = new Map<string, { peerId: string; metadata?: Record<string, unknown> }>();
	private readonly iceServers: RTCIceServer[] = [
		{ urls: ["stun:stun.l.google.com:19302"] },
	];

	queueSignal(signal: WebRTCSignal): void {
		this.signalQueue.enqueue(signal);
	}

	getSignals(peerId: string): WebRTCSignal[] {
		return this.signalQueue.dequeue(peerId);
	}

	storeMessage(peerId: string, message: P2PMessage): void {
		this.messageBuffer.enqueue(peerId, message);
	}

	getMessages(peerId: string, count = 10): P2PMessage[] {
		return this.messageBuffer.dequeue(peerId, count);
	}

	hasPendingMessages(peerId: string): number {
		return this.messageBuffer.pending(peerId);
	}

	registerConnection(peerId: string, metadata?: Record<string, unknown>): void {
		if (this.connections.size >= MAX_CONNECTIONS) {
			throw new Error("Max connections reached");
		}
		this.connections.set(peerId, { peerId, metadata });
	}

	closeConnection(peerId: string): void {
		this.connections.delete(peerId);
	}

	getIceServers(): RTCIceServer[] {
		return this.iceServers;
	}

	clear(): void {
		this.signalQueue.clear();
		this.messageBuffer.clear();
		this.connections.clear();
	}
}

// Singleton — persists across hot reloads in Next.js dev
const globalForWebRTC = globalThis as { __webrtcManager?: WebRTCManager };

export const webrtcManager =
	globalForWebRTC.__webrtcManager ?? new WebRTCManager();

if (process.env.NODE_ENV !== "production") {
	globalForWebRTC.__webrtcManager = webrtcManager;
}