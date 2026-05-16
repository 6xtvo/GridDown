/**
 * P2P Network - Client-side WebRTC connection manager
 *
 * Usage:
 *   const network = getNetwork();
 *   network.configure({ peerId, iceServers, sendSignal });
 *   network.updatePeers(["peer1", "peer2"]);
 *   network.handleSignals(signals);
 *   network.broadcast({ from: peerId, type: "chat", data: "hello", timestamp: Date.now() });
 */

import type { P2PMessage, WebRTCSignal } from "@/server/p2p-types";

type SignalSender = (signal: WebRTCSignal) => void;

interface NetworkConfig {
	peerId: string;
	iceServers?: RTCIceServer[];
	sendSignal: SignalSender;
}

class P2PNetwork {
	private peerId: string | null = null;
	private iceServers: RTCIceServer[] = [
		{ urls: ["stun:stun.l.google.com:19302"] },
	];
	private sendSignal: SignalSender | null = null;

	private connections = new Map<string, RTCPeerConnection>();
	private connectionRoles = new Map<string, boolean>();
	private channels = new Map<string, RTCDataChannel>();
	private pendingIce = new Map<string, RTCIceCandidateInit[]>();
	private pendingMessages = new Map<string, P2PMessage[]>();
	private listeners = new Set<(message: P2PMessage) => void>();
	private knownPeers = new Set<string>();

	private readonly webRtcAvailable = typeof RTCPeerConnection !== "undefined";

	configure(config: NetworkConfig): void {
		if (!this.webRtcAvailable) return;

		if (this.peerId && this.peerId !== config.peerId) {
			this.reset();
		}

		this.peerId = config.peerId;
		this.iceServers = config.iceServers ?? this.iceServers;
		this.sendSignal = config.sendSignal;
	}

	updatePeers(peerIds: string[]): void {
		if (!this.peerId) return;

		const next = new Set(peerIds.filter((id) => id && id !== this.peerId));
		this.knownPeers = next;

		// Close connections to peers who left
		for (const peerId of this.connections.keys()) {
			if (!next.has(peerId)) this.closeConnection(peerId);
		}

		// Open connections to new peers (lower peerId initiates)
		for (const peerId of next) {
			if (this.peerId < peerId) {
				this.ensureConnection(peerId, true);
			}
		}
	}

	handleSignals(signals: WebRTCSignal[]): void {
		if (!this.peerId) return;
		for (const signal of signals) {
			if (signal.to !== this.peerId) continue;
			if (signal.type === "offer")
				void this.handleOffer(signal.from, signal.data);
			if (signal.type === "answer")
				void this.handleAnswer(signal.from, signal.data);
			if (signal.type === "ice-candidate")
				void this.handleIce(signal.from, signal.data);
		}
	}

	onMessage(listener: (message: P2PMessage) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	sendToPeer(peerId: string, message: P2PMessage): void {
		if (!this.peerId || peerId === this.peerId) return;
		const channel = this.channels.get(peerId);
		if (channel?.readyState === "open") {
			channel.send(JSON.stringify(message));
			return;
		}
		// Queue and ensure connection
		const pending = this.pendingMessages.get(peerId) ?? [];
		pending.push(message);
		this.pendingMessages.set(peerId, pending);

		const existing = this.connections.get(peerId);
		const existingRole = this.connectionRoles.get(peerId);
		if (existing && existingRole === false) {
			this.closeConnection(peerId);
		}

		this.ensureConnection(peerId, true);
	}

	broadcast(message: P2PMessage): void {
		for (const peerId of this.knownPeers) {
			this.sendToPeer(peerId, message);
		}
	}

	// ─── Private ───────────────────────────────────────────────────────────────

	private reset(): void {
		for (const peerId of this.connections.keys()) this.closeConnection(peerId);
		this.pendingIce.clear();
		this.pendingMessages.clear();
		this.knownPeers.clear();
		this.connectionRoles.clear();
	}

	private ensureConnection(
		peerId: string,
		initiator: boolean,
	): RTCPeerConnection | null {
		if (!this.webRtcAvailable) return null;

		const existing = this.connections.get(peerId);
		if (existing && existing.connectionState !== "closed") return existing;
		if (existing) this.closeConnection(peerId);

		const conn = new RTCPeerConnection({ iceServers: this.iceServers });
		this.connections.set(peerId, conn);
		this.connectionRoles.set(peerId, initiator);

		conn.onicecandidate = (e) => {
			if (!e.candidate || !this.sendSignal || !this.peerId) return;
			this.sendSignal({
				from: this.peerId,
				to: peerId,
				type: "ice-candidate",
				data: e.candidate.toJSON() as unknown as Record<string, unknown>,
				timestamp: Date.now(),
			});
		};

		conn.ondatachannel = (e) => this.attachChannel(peerId, e.channel);

		conn.onconnectionstatechange = () => {
			const s = conn.connectionState;
			if (s === "failed" || s === "closed" || s === "disconnected") {
				this.closeConnection(peerId);
			}
		};

		if (initiator) {
			const channel = conn.createDataChannel("p2p", { ordered: true });
			this.attachChannel(peerId, channel);

			conn
				.createOffer()
				.then((offer) => conn.setLocalDescription(offer))
				.then(() => {
					if (!this.sendSignal || !this.peerId || !conn.localDescription)
						return;
					const desc = conn.localDescription;
					this.sendSignal({
						from: this.peerId,
						to: peerId,
						type: "offer",
						data: { type: desc.type, sdp: desc.sdp },
						timestamp: Date.now(),
					});
				})
				.catch((e) => console.error("[P2P] Offer failed:", e));
		}

		return conn;
	}

	private attachChannel(peerId: string, channel: RTCDataChannel): void {
		channel.binaryType = "arraybuffer";
		this.channels.set(peerId, channel);

		channel.onmessage = (e) => {
			const text =
				e.data instanceof ArrayBuffer
					? new TextDecoder().decode(e.data)
					: (e.data as string);
			try {
				const msg = JSON.parse(text) as P2PMessage;
				for (const listener of this.listeners) listener(msg);
			} catch {
				console.error("[P2P] Failed to parse message");
			}
		};

		channel.onopen = () => {
			const pending = this.pendingMessages.get(peerId) ?? [];
			for (const msg of pending) channel.send(JSON.stringify(msg));
			this.pendingMessages.delete(peerId);
		};

		channel.onclose = () => this.channels.delete(peerId);
	}

	private async handleOffer(
		from: string,
		data: Record<string, unknown>,
	): Promise<void> {
		const conn = this.ensureConnection(from, false);
		if (!conn || !this.peerId) return;
		await conn.setRemoteDescription(
			data as unknown as RTCSessionDescriptionInit,
		);
		const answer = await conn.createAnswer();
		await conn.setLocalDescription(answer);
		if (!this.sendSignal || !conn.localDescription) return;
		const desc = conn.localDescription;
		this.sendSignal({
			from: this.peerId,
			to: from,
			type: "answer",
			data: { type: desc.type, sdp: desc.sdp },
			timestamp: Date.now(),
		});
		this.flushIce(from, conn);
	}

	private async handleAnswer(
		from: string,
		data: Record<string, unknown>,
	): Promise<void> {
		const conn = this.connections.get(from);
		if (!conn) return;
		await conn.setRemoteDescription(
			data as unknown as RTCSessionDescriptionInit,
		);
		this.flushIce(from, conn);
	}

	private async handleIce(
		from: string,
		data: Record<string, unknown>,
	): Promise<void> {
		const conn = this.connections.get(from);
		const candidate = data as RTCIceCandidateInit;
		if (!conn || !conn.remoteDescription) {
			const pending = this.pendingIce.get(from) ?? [];
			pending.push(candidate);
			this.pendingIce.set(from, pending);
			return;
		}
		await conn.addIceCandidate(data as unknown as RTCIceCandidateInit);
	}

	private flushIce(peerId: string, conn: RTCPeerConnection): void {
		const pending = this.pendingIce.get(peerId) ?? [];
		for (const candidate of pending) void conn.addIceCandidate(candidate);
		this.pendingIce.delete(peerId);
	}

	private closeConnection(peerId: string): void {
		this.channels.get(peerId)?.close();
		this.channels.delete(peerId);
		this.connections.get(peerId)?.close();
		this.connections.delete(peerId);
		this.connectionRoles.delete(peerId);
		this.pendingMessages.delete(peerId);
		this.pendingIce.delete(peerId);
	}
}

// Singleton
const globalForP2P = globalThis as { __p2pNetwork?: P2PNetwork };

export function getNetwork(): P2PNetwork {
	if (!globalForP2P.__p2pNetwork) {
		globalForP2P.__p2pNetwork = new P2PNetwork();
	}
	return globalForP2P.__p2pNetwork;
}
