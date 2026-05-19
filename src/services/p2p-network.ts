import type {
	NetworkConfig,
	SignalSender,
	WebRTCSignal,
} from "@/types/network";
import type { P2PMessage } from "@/types/p2p";

/**
 * Client-side WebRTC connection manager.
 *
 * Manages a mesh of peer connections using RTCPeerConnection and RTCDataChannel.
 * The server is only involved during signalling (offer/answer/ICE exchange).
 * Once a data channel is open, all messages flow directly between browsers.
 *
 * @example
 * ```ts
 * const network = getNetwork();
 * network.configure({ peerId, iceServers, sendSignal });
 * network.updatePeers(["peer-b", "peer-c"]);
 * network.handleSignals(signals);
 * network.broadcast({ from: peerId, type: "chat", data: "hello", timestamp: Date.now() });
 * ```
 */
class P2PNetwork {
	private peerId: string | null = null;
	private iceServers: RTCIceServer[] = [
		{ urls: ["stun:stun.l.google.com:19302"] },
	];
	private sendSignal: SignalSender | null = null;

	/** Active RTCPeerConnections, keyed by remote peer ID. */
	private connections = new Map<string, RTCPeerConnection>();

	/**
	 * Tracks who initiated each connection.
	 * `true` = we are the offerer, `false` = we are the answerer.
	 */
	private connectionRoles = new Map<string, boolean>();

	/** Open RTCDataChannels, keyed by remote peer ID. */
	private channels = new Map<string, RTCDataChannel>();

	/**
	 * ICE candidates that arrived before setRemoteDescription() was called.
	 * Flushed once the remote description is set.
	 */
	private pendingIce = new Map<string, RTCIceCandidateInit[]>();

	/**
	 * Messages queued for peers whose data channel is not yet open.
	 * Flushed when the channel opens.
	 */
	private pendingMessages = new Map<string, P2PMessage[]>();

	/** Callbacks registered via {@link onMessage}. */
	private listeners = new Set<(message: P2PMessage) => void>();

	/** Peer IDs seen in the most recent {@link updatePeers} call. */
	private knownPeers = new Set<string>();

	/** False in SSR / Node environments where WebRTC is unavailable. */
	private readonly webRtcAvailable = typeof RTCPeerConnection !== "undefined";

	/**
	 * Configure the network with the local peer identity and signalling callback.
	 * Must be called before any connections are made.
	 *
	 * If the peer ID changes, all existing connections are torn down first.
	 */
	public configure(config: NetworkConfig): void {
		if (!this.webRtcAvailable) return;

		if (this.peerId && this.peerId !== config.peerId) {
			this.reset();
		}

		this.peerId = config.peerId;
		this.iceServers = config.iceServers ?? this.iceServers;
		this.sendSignal = config.sendSignal;
	}

	/**
	 * Reconcile the set of known peers with the given list.
	 *
	 * - Connections to peers no longer in the list are closed.
	 * - Connections to new peers are opened if this node has the lower peer ID
	 *   (to prevent both sides from simultaneously sending offers).
	 */
	public updatePeers(peerIds: string[]): void {
		if (!this.peerId) return;

		const next = new Set(peerIds.filter((id) => id && id !== this.peerId));
		this.knownPeers = next;

		for (const peerId of this.connections.keys()) {
			if (!next.has(peerId)) this.closeConnection(peerId);
		}

		for (const peerId of next) {
			if (this.peerId < peerId) {
				this.ensureConnection(peerId, true);
			}
		}
	}

	/**
	 * Process incoming WebRTC signals from the signalling server.
	 * Routes each signal to the appropriate handler based on its type.
	 */
	public handleSignals(signals: WebRTCSignal[]): void {
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

	/**
	 * Register a callback to receive messages from any peer.
	 *
	 * @returns A cleanup function that removes the listener.
	 */
	public onMessage(listener: (message: P2PMessage) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Send a message directly to a specific peer over their data channel.
	 *
	 * If the channel is not yet open, the message is queued and delivered
	 * once the connection is established.
	 */
	public sendToPeer(peerId: string, message: P2PMessage): void {
		if (!this.peerId || peerId === this.peerId) return;

		const channel = this.channels.get(peerId);
		if (channel?.readyState === "open") {
			channel.send(JSON.stringify(message));
			return;
		}

		// Queue the message and make sure a connection is in progress.
		const pending = this.pendingMessages.get(peerId) ?? [];
		pending.push(message);
		this.pendingMessages.set(peerId, pending);

		// If we were previously the answerer, flip to initiator so we can send.
		const existingRole = this.connectionRoles.get(peerId);
		if (this.connections.get(peerId) && existingRole === false) {
			this.closeConnection(peerId);
		}

		this.ensureConnection(peerId, true);
	}

	/**
	 * Broadcast a message to all known peers.
	 */
	public broadcast(message: P2PMessage): void {
		for (const peerId of this.knownPeers) {
			this.sendToPeer(peerId, message);
		}
	}

	/** Tear down all connections and clear all state. */
	private reset(): void {
		for (const peerId of this.connections.keys()) this.closeConnection(peerId);
		this.pendingIce.clear();
		this.pendingMessages.clear();
		this.knownPeers.clear();
		this.connectionRoles.clear();
	}

	/**
	 * Return an existing live connection to `peerId`, or create a new one.
	 *
	 * @param initiator - Whether this side should create the offer and data channel.
	 */
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

		// The answerer receives the data channel via this event.
		conn.ondatachannel = (e) => this.attachChannel(peerId, e.channel);

		conn.onconnectionstatechange = () => {
			const s = conn.connectionState;
			if (s === "failed" || s === "closed" || s === "disconnected") {
				this.closeConnection(peerId);
			}
		};

		if (initiator) {
			// The initiator creates the data channel and sends the offer.
			const channel = conn.createDataChannel("p2p", { ordered: true });
			this.attachChannel(peerId, channel);

			conn
				.createOffer()
				.then((offer) => conn.setLocalDescription(offer))
				.then(() => {
					if (!this.sendSignal || !this.peerId || !conn.localDescription)
						return;
					const { type, sdp } = conn.localDescription;
					this.sendSignal({
						from: this.peerId,
						to: peerId,
						type: "offer",
						data: { type, sdp },
						timestamp: Date.now(),
					});
				})
				.catch((e) => console.error("[P2P] Offer failed:", e));
		}

		return conn;
	}

	/**
	 * Attach event handlers to a data channel and register it in the channel map.
	 * Flushes any messages that were queued before the channel opened.
	 */
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

	/**
	 * Handle an incoming offer from a remote peer.
	 * Creates an answer and sends it back via the signalling server.
	 */
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
		const { type, sdp } = conn.localDescription;
		this.sendSignal({
			from: this.peerId,
			to: from,
			type: "answer",
			data: { type, sdp },
			timestamp: Date.now(),
		});

		this.flushIce(from, conn);
	}

	/**
	 * Handle an incoming answer from a remote peer.
	 * Completes the local description negotiation.
	 */
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

	/**
	 * Handle an incoming ICE candidate from a remote peer.
	 *
	 * If the remote description is not yet set, the candidate is buffered
	 * and applied once {@link flushIce} is called.
	 */
	private async handleIce(
		from: string,
		data: Record<string, unknown>,
	): Promise<void> {
		const conn = this.connections.get(from);

		if (!conn || !conn.remoteDescription) {
			const pending = this.pendingIce.get(from) ?? [];
			pending.push(data as RTCIceCandidateInit);
			this.pendingIce.set(from, pending);
			return;
		}

		await conn.addIceCandidate(data as unknown as RTCIceCandidateInit);
	}

	/**
	 * Apply any buffered ICE candidates for a peer now that the remote
	 * description is available.
	 */
	private flushIce(peerId: string, conn: RTCPeerConnection): void {
		const pending = this.pendingIce.get(peerId) ?? [];
		for (const candidate of pending) void conn.addIceCandidate(candidate);
		this.pendingIce.delete(peerId);
	}

	/**
	 * Fully tear down the connection to a peer, closing its channel and
	 * clearing all associated state.
	 */
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

// Stored on globalThis so the instance survives Next.js hot reloads in dev.

const globalForP2P = globalThis as { __p2pNetwork?: P2PNetwork };

/**
 * Returns the global {@link P2PNetwork} singleton.
 * Safe to call multiple times — always returns the same instance.
 */
export function getNetwork(): P2PNetwork {
	globalForP2P.__p2pNetwork ??= new P2PNetwork();
	return globalForP2P.__p2pNetwork;
}
