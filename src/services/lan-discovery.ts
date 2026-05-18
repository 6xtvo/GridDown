import dgram from "node:dgram";
import os from "node:os";

import type {
	LanHeartbeat,
	PeerLocation,
	RelayPayload,
	RemoteNode,
} from "@/types/lan-discovery";
import type { PeerInfo, WebRTCSignal } from "@/types/p2p";
import {
	getBroadcastAddress,
	getIPv4Interfaces,
	normalizeUrl,
	resolveBaseUrl,
	resolveRelayUrls,
	withLanMetadata,
} from "@/utils/lan-discovery";

const DISCOVERY_PORT = Number(process.env.LAN_DISCOVERY_PORT ?? 41235);
const DISCOVERY_GROUP = process.env.LAN_DISCOVERY_MULTICAST ?? "239.255.42.99";
const RELAY_TOKEN = process.env.LAN_RELAY_TOKEN ?? "gdgc-lan-dev-token";

const HEARTBEAT_INTERVAL_MS = Number(
	process.env.LAN_HEARTBEAT_INTERVAL_MS ?? 5000,
);
const STALE_NODE_MS = Number(process.env.LAN_STALE_NODE_MS ?? 20000);
const DISCOVERY_SEND_TIMEOUT_MS = Number(
	process.env.LAN_DISCOVERY_SEND_TIMEOUT_MS ?? 1500,
);

/**
 * Manages LAN peer discovery via UDP multicast/broadcast heartbeats and
 * HTTP relay forwarding for peers that cannot communicate directly.
 *
 * Each running server instance is a "node". Nodes periodically broadcast a
 * {@link LanHeartbeat} listing their known local peers. On receiving a
 * heartbeat from another node, this class merges its peers into
 * `remoteNodes` so they are visible to the local WebRTC layer.
 *
 * Relay forwarding is used when a peer is behind a remote node - signals
 * and messages are posted to `/api/p2p/relay` on the remote node's base URL.
 */
export class LanDiscovery {
	/**
	 * Unique identifier for this node, stable for the lifetime of the process.
	 */
	private readonly nodeId =
		process.env.LAN_NODE_ID ??
		`${os.hostname()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

	/**
	 * HTTP base URL at which this node's API is reachable on the LAN.
	 */
	private readonly baseUrl = resolveBaseUrl();

	/**
	 * Relay URLs advertised to peers, ordered most-preferred first.
	 */
	private readonly relayUrls = resolveRelayUrls(this.baseUrl);

	/**
	 * Peers managed by this node, keyed by peer ID.
	 */
	private readonly localPeers = new Map<string, PeerInfo>();

	/**
	 * Remote nodes discovered via heartbeat, keyed by node ID.
	 */
	private readonly remoteNodes = new Map<string, RemoteNode>();

	/**
	 * Broadcast addresses derived from local network interfaces, plus the global broadcast.
	 */
	private readonly broadcastTargets = new Set<string>();

	/**
	 * UDP socket used for sending and receiving heartbeats.
	 */
	private socket: dgram.Socket | null = null;

	/**
	 * Handle for the periodic heartbeat interval.
	 */
	private heartbeatTimer: NodeJS.Timeout | null = null;

	/**
	 * Handle for the periodic stale-node cleanup interval.
	 */
	private cleanupTimer: NodeJS.Timeout | null = null;

	/**
	 *  Whether {@link start} has already been called.
	 */
	private started = false;

	/**
	 * Starts the UDP discovery socket, joins the multicast group on all eligible
	 * interfaces, and begins sending periodic heartbeats.
	 * No-ops if already started or if `NODE_ENV` is `"test"`.
	 */
	public start(): void {
		if (this.started || process.env.NODE_ENV === "test") return;
		this.started = true;

		try {
			this.socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

			this.socket.on("error", (err) => {
				console.error("[LAN] Discovery socket error:", err.message);
			});

			this.socket.on("message", (msg) => this.onMessage(msg));

			this.socket.bind(DISCOVERY_PORT, () => {
				if (!this.socket) return;
				for (const iface of getIPv4Interfaces()) {
					try {
						this.socket.addMembership(DISCOVERY_GROUP, iface.address);
					} catch {
						// Ignore interfaces that do not support multicast.
					}

					const broadcast = getBroadcastAddress(iface.address, iface.netmask);
					if (broadcast) this.broadcastTargets.add(broadcast);
				}

				this.broadcastTargets.add("255.255.255.255");
				this.socket.setBroadcast(true);
				this.socket.setMulticastTTL(64);
				this.sendHeartbeat();
			});

			this.heartbeatTimer = setInterval(
				() => this.sendHeartbeat(),
				HEARTBEAT_INTERVAL_MS,
			);
			this.cleanupTimer = setInterval(() => this.cleanupStaleNodes(), 5000);
		} catch (error) {
			console.error("[LAN] Failed to start discovery:", error);
		}
	}

	/**
	 * Inserts or updates a local peer and immediately broadcasts a heartbeat
	 * so remote nodes see the change without waiting for the next interval.
	 * @param {PeerInfo} peer - The peer to insert or update
	 */
	public upsertLocalPeer(peer: PeerInfo): void {
		this.localPeers.set(peer.peerId, peer);
		this.sendHeartbeat();
	}

	/**
	 * Removes a local peer and immediately broadcasts a heartbeat.
	 * @param {string} peerId - The ID of the peer to remove
	 */
	public removeLocalPeer(peerId: string): void {
		this.localPeers.delete(peerId);
		this.sendHeartbeat();
	}

	/**
	 * Replaces the entire local peer set and immediately broadcasts a heartbeat.
	 * @param {PeerInfo[]} peers - The new set of local peers
	 */
	public setLocalPeers(peers: PeerInfo[]): void {
		this.localPeers.clear();
		for (const peer of peers) {
			this.localPeers.set(peer.peerId, peer);
		}
		this.sendHeartbeat();
	}

	/**
	 * Returns a deduplicated list of all known peers - both local and remote -
	 * each annotated with LAN metadata indicating which node they were seen through.
	 * Local peers take precedence over remote peers with the same ID.
	 * @param {PeerInfo[]} localPeers - The caller's current local peer list
	 * @returns {PeerInfo[]} All known peers with LAN metadata attached
	 */
	public getAllPeers(localPeers: PeerInfo[]): PeerInfo[] {
		const merged = new Map<string, PeerInfo>();

		for (const peer of localPeers) {
			merged.set(
				peer.peerId,
				withLanMetadata(peer, this.nodeId, this.baseUrl, this.relayUrls),
			);
		}

		for (const node of this.remoteNodes.values()) {
			for (const peer of node.peers) {
				if (merged.has(peer.peerId)) continue;
				merged.set(
					peer.peerId,
					withLanMetadata(peer, node.nodeId, node.baseUrl, node.relayUrls),
				);
			}
		}

		return [...merged.values()];
	}

	/**
	 * Resolves where a peer is located relative to this node.
	 * Returns `"local"` if the peer is managed here, `"remote"` if it was seen
	 * through another node's heartbeat, or `"unknown"` if it has not been seen at all.
	 * @param {string} peerId - The ID of the peer to locate
	 * @returns {PeerLocation} The peer's location and relay connectivity info
	 */
	public resolvePeer(peerId: string): PeerLocation {
		if (this.localPeers.has(peerId)) {
			return {
				kind: "local",
				baseUrl: this.relayUrls[0],
				relayUrls: this.relayUrls,
			};
		}

		for (const node of this.remoteNodes.values()) {
			if (node.peers.some((peer) => peer.peerId === peerId)) {
				return {
					kind: "remote",
					baseUrl: node.relayUrls[0] ?? node.baseUrl,
					relayUrls: node.relayUrls,
				};
			}
		}

		return { kind: "unknown" };
	}

	/**
	 * Returns whether the given token matches the configured relay token.
	 * Used by the relay HTTP endpoint to authenticate incoming relay requests.
	 * @param {string} token - The token to validate
	 * @returns {boolean} `true` if the token is valid
	 */
	public isRelayTokenValid(token: string): boolean {
		return token === RELAY_TOKEN;
	}

	/**
	 * Forwards a WebRTC signal to a remote peer via one of the provided relay URLs.
	 * Tries each URL in order and resolves on the first success.
	 * @param {string[]} relayUrls - Ordered list of relay URLs to try
	 * @param {WebRTCSignal} signal - The WebRTC signal to forward
	 */
	public async forwardSignal(
		relayUrls: string[],
		signal: WebRTCSignal,
	): Promise<void> {
		const payload: RelayPayload = {
			type: "signal",
			token: RELAY_TOKEN,
			signal,
		};
		await this.relayToAny(relayUrls, payload);
	}

	/**
	 * Forwards an application message to a remote peer via one of the provided relay URLs.
	 * Tries each URL in order and resolves on the first success.
	 * @param {string[]} relayUrls - Ordered list of relay URLs to try
	 * @param message - The message to forward
	 */
	public async forwardMessage(
		relayUrls: string[],
		message: {
			from: string;
			to: string;
			type: string;
			data: unknown;
			timestamp: number;
		},
	): Promise<void> {
		const payload: RelayPayload = {
			type: "message",
			token: RELAY_TOKEN,
			message,
		};
		await this.relayToAny(relayUrls, payload);
	}

	/**
	 * Attempts to deliver a relay payload to the first reachable URL in the list.
	 * Throws the last error if all URLs fail.
	 * @param {string[]} relayUrls - Ordered list of relay URLs to try
	 * @param {RelayPayload} payload - The payload to deliver
	 */
	public async relayToAny(
		relayUrls: string[],
		payload: RelayPayload,
	): Promise<void> {
		let lastError: unknown = null;

		for (const relayUrl of relayUrls) {
			try {
				await this.sendRelay(relayUrl, payload);
				return;
			} catch (error) {
				lastError = error;
			}
		}

		throw lastError instanceof Error
			? lastError
			: new Error("No relay URL available");
	}

	/**
	 * Posts a relay payload to `/api/p2p/relay` on the given base URL.
	 * Throws if the request fails or returns a non-OK status.
	 * @param {string} baseUrl - The base URL of the target node
	 * @param {RelayPayload} payload - The payload to POST
	 */
	private async sendRelay(
		baseUrl: string,
		payload: RelayPayload,
	): Promise<void> {
		let lastError: unknown = null;

		try {
			const target = new URL("/api/p2p/relay", baseUrl).toString();
			const res = await fetch(target, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload),
				signal: AbortSignal.timeout(DISCOVERY_SEND_TIMEOUT_MS),
			});
			if (res.ok) return;
			lastError = new Error(`Relay request failed: ${res.status}`);
		} catch (error) {
			lastError = error;
		}

		throw lastError instanceof Error
			? lastError
			: new Error("Relay request failed");
	}

	/**
	 * Handles an incoming UDP message. Parses it as a {@link LanHeartbeat},
	 * ignores malformed packets and our own broadcasts, then upserts the
	 * sending node into `remoteNodes`.
	 * @param {Buffer} raw - The raw UDP message buffer
	 */
	private onMessage(raw: Buffer): void {
		let msg: LanHeartbeat;
		try {
			msg = JSON.parse(raw.toString()) as LanHeartbeat;
		} catch {
			return;
		}

		if (msg.version !== 1 || msg.nodeId === this.nodeId) return;
		if (!msg.baseUrl || !Array.isArray(msg.peers)) return;

		const relayUrls =
			msg.relayUrls && msg.relayUrls.length > 0
				? msg.relayUrls.map(normalizeUrl)
				: [normalizeUrl(msg.baseUrl)];

		this.remoteNodes.set(msg.nodeId, {
			nodeId: msg.nodeId,
			baseUrl: msg.baseUrl,
			relayUrls,
			lastSeen: Date.now(),
			peers: msg.peers,
		});
	}

	/**
	 * Broadcasts a {@link LanHeartbeat} containing this node's identity and
	 * current local peer list to the multicast group and all broadcast targets.
	 * No-ops if the socket is not yet open.
	 */
	private sendHeartbeat(): void {
		if (!this.socket) return;

		const payload: LanHeartbeat = {
			version: 1,
			nodeId: this.nodeId,
			baseUrl: this.baseUrl,
			relayUrls: this.relayUrls,
			peers: [...this.localPeers.values()],
			timestamp: Date.now(),
		};

		const data = Buffer.from(JSON.stringify(payload));
		this.socket.send(data, DISCOVERY_PORT, DISCOVERY_GROUP);
		for (const target of this.broadcastTargets) {
			this.socket.send(data, DISCOVERY_PORT, target);
		}
	}

	/**
	 * Removes remote nodes that have not sent a heartbeat within `STALE_NODE_MS`.
	 * Called on a fixed interval regardless of heartbeat timing.
	 */
	private cleanupStaleNodes(): void {
		const now = Date.now();
		for (const [nodeId, node] of this.remoteNodes.entries()) {
			if (now - node.lastSeen > STALE_NODE_MS) {
				this.remoteNodes.delete(nodeId);
			}
		}
	}
}

/**
 * Process-wide singleton - reused across Next.js hot reloads via `globalThis`.
 * Import this instead of constructing `LanDiscovery` directly.
 */
const globalForLan = globalThis as { __lanDiscovery?: LanDiscovery };

export const lanDiscovery = globalForLan.__lanDiscovery ?? new LanDiscovery();

if (!globalForLan.__lanDiscovery) {
	globalForLan.__lanDiscovery = lanDiscovery;
	lanDiscovery.start();
}
