import dgram from "node:dgram";
import os from "node:os";
import type { PeerInfo, WebRTCSignal } from "@/server/p2p-types";

type RelayPayload =
	| {
			type: "signal";
			token: string;
			signal: WebRTCSignal;
	  }
	| {
			type: "message";
			token: string;
			message: {
				from: string;
				to: string;
				type: string;
				data: unknown;
				timestamp: number;
			};
	  };

interface LanHeartbeat {
	version: 1;
	nodeId: string;
	baseUrl: string;
	relayUrls?: string[];
	peers: PeerInfo[];
	timestamp: number;
}

interface RemoteNode {
	nodeId: string;
	baseUrl: string;
	relayUrls: string[];
	lastSeen: number;
	peers: PeerInfo[];
}

interface PeerLocation {
	kind: "local" | "remote" | "unknown";
	baseUrl?: string;
	relayUrls?: string[];
}

const DISCOVERY_PORT = Number(process.env.LAN_DISCOVERY_PORT ?? 41235);
const DISCOVERY_GROUP =
	process.env.LAN_DISCOVERY_MULTICAST ?? "239.255.42.99";
const RELAY_TOKEN = process.env.LAN_RELAY_TOKEN ?? "gdgc-lan-dev-token";
const HEARTBEAT_INTERVAL_MS = Number(process.env.LAN_HEARTBEAT_INTERVAL_MS ?? 5000);
const STALE_NODE_MS = Number(process.env.LAN_STALE_NODE_MS ?? 20000);
const DISCOVERY_SEND_TIMEOUT_MS = Number(
	process.env.LAN_DISCOVERY_SEND_TIMEOUT_MS ?? 1500,
);

interface IPv4Interface {
	address: string;
	netmask: string;
}

function normalizeUrl(url: string): string {
	return url.replace(/\/+$/, "");
}

function parseRelayUrls(value: string | undefined): string[] {
	if (!value) return [];
	return value
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean)
		.map(normalizeUrl);
}

function firstPrivateIPv4(): string | null {
	const nets = os.networkInterfaces();
	for (const addresses of Object.values(nets)) {
		for (const addr of addresses ?? []) {
			if (
				addr.family === "IPv4" &&
				!addr.internal &&
				/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(addr.address)
			) {
				return addr.address;
			}
		}
	}
	return null;
}

function getIPv4Interfaces(): IPv4Interface[] {
	const out: IPv4Interface[] = [];
	const nets = os.networkInterfaces();
	for (const addresses of Object.values(nets)) {
		for (const addr of addresses ?? []) {
			if (addr.family !== "IPv4" || addr.internal || !addr.netmask) continue;
			out.push({ address: addr.address, netmask: addr.netmask });
		}
	}
	return out;
}

function ipToInt(ip: string): number {
	const parts = ip.split(".").map((p) => Number(p));
	if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
		return 0;
	}
	return ((parts[0] ?? 0) << 24) | ((parts[1] ?? 0) << 16) | ((parts[2] ?? 0) << 8) | (parts[3] ?? 0);
}

function intToIp(n: number): string {
	const b1 = (n >>> 24) & 255;
	const b2 = (n >>> 16) & 255;
	const b3 = (n >>> 8) & 255;
	const b4 = n & 255;
	return `${b1}.${b2}.${b3}.${b4}`;
}

function getBroadcastAddress(address: string, netmask: string): string | null {
	const ip = ipToInt(address);
	const mask = ipToInt(netmask);
	if (!ip || !mask) return null;
	const broadcast = (ip & mask) | (~mask >>> 0);
	return intToIp(broadcast >>> 0);
}

function resolveBaseUrl(): string {
	if (process.env.LAN_BASE_URL) return process.env.LAN_BASE_URL;
	const ip = firstPrivateIPv4() ?? "127.0.0.1";
	const port = Number(process.env.PORT ?? 3000);
	return `http://${ip}:${port}`;
}

function resolveRelayUrls(baseUrl: string): string[] {
	const explicit = parseRelayUrls(process.env.LAN_RELAY_URLS);
	if (explicit.length > 0) return explicit;

	const urls = [normalizeUrl(baseUrl)];
	const forwarded = process.env.LAN_PORT_FORWARD_BASE_URL?.trim();
	if (forwarded) {
		const normalizedForwarded = normalizeUrl(forwarded);
		if (!urls.includes(normalizedForwarded)) {
			urls.unshift(normalizedForwarded);
		}
	}
	return urls;
}

function withLanMetadata(
	peer: PeerInfo,
	nodeId: string,
	baseUrl: string,
	relayUrls: string[],
): PeerInfo {
	return {
		...peer,
		metadata: {
			...(peer.metadata ?? {}),
			lanNodeId: nodeId,
			relayBaseUrl: baseUrl,
			relayUrls,
		},
	};
}

export class LanDiscovery {
	private readonly nodeId =
		process.env.LAN_NODE_ID ??
		`${os.hostname()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
	private readonly baseUrl = resolveBaseUrl();
	private readonly relayUrls = resolveRelayUrls(this.baseUrl);
	private readonly localPeers = new Map<string, PeerInfo>();
	private readonly remoteNodes = new Map<string, RemoteNode>();
	private readonly broadcastTargets = new Set<string>();
	private socket: dgram.Socket | null = null;
	private heartbeatTimer: NodeJS.Timeout | null = null;
	private cleanupTimer: NodeJS.Timeout | null = null;
	private started = false;

	start(): void {
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

	upsertLocalPeer(peer: PeerInfo): void {
		this.localPeers.set(peer.peerId, peer);
		this.sendHeartbeat();
	}

	removeLocalPeer(peerId: string): void {
		this.localPeers.delete(peerId);
		this.sendHeartbeat();
	}

	setLocalPeers(peers: PeerInfo[]): void {
		this.localPeers.clear();
		for (const peer of peers) {
			this.localPeers.set(peer.peerId, peer);
		}
		this.sendHeartbeat();
	}

	getAllPeers(localPeers: PeerInfo[]): PeerInfo[] {
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

	resolvePeer(peerId: string): PeerLocation {
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

	async forwardSignal(relayUrls: string[], signal: WebRTCSignal): Promise<void> {
		const payload: RelayPayload = {
			type: "signal",
			token: RELAY_TOKEN,
			signal,
		};
		await this.relayToAny(relayUrls, payload);
	}

	async forwardMessage(
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

	isRelayTokenValid(token: string): boolean {
		return token === RELAY_TOKEN;
	}

	private async sendRelay(baseUrl: string, payload: RelayPayload): Promise<void> {
		const candidates = [baseUrl];
		let lastError: unknown = null;

		for (const candidate of candidates) {
			try {
				const target = new URL("/api/p2p/relay", candidate).toString();
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
		}

		throw lastError instanceof Error
			? lastError
			: new Error("Relay request failed");
	}

	async relayToAny(relayUrls: string[], payload: RelayPayload): Promise<void> {
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

	private cleanupStaleNodes(): void {
		const now = Date.now();
		for (const [nodeId, node] of this.remoteNodes.entries()) {
			if (now - node.lastSeen > STALE_NODE_MS) {
				this.remoteNodes.delete(nodeId);
			}
		}
	}
}

const globalForLan = globalThis as { __lanDiscovery?: LanDiscovery };

export const lanDiscovery = globalForLan.__lanDiscovery ?? new LanDiscovery();

if (!globalForLan.__lanDiscovery) {
	globalForLan.__lanDiscovery = lanDiscovery;
	lanDiscovery.start();
}