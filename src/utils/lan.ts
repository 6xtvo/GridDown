import os from "node:os";

import type { IPv4Interface } from "@/types/network";
import type { PeerInfo } from "@/types/p2p";

/**
 * Normalizes a URL by removing trailing slashes.
 * @param {string} url The URL to normalize
 * @returns {string} The normalized URL
 */
export function normalizeUrl(url: string): string {
	return url.replace(/\/+$/, "");
}

/**
 * Parses a comma-separated list of relay URLs from an environment variable.
 * @param {string | undefined} value The raw environment variable string
 * @returns {string[]} An array of normalized relay URLs
 */
export function parseRelayUrls(value: string | undefined): string[] {
	if (!value) return [];

	return value
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean)
		.map(normalizeUrl);
}

/**
 * Resolves the base URL at which this node's API is reachable on the LAN.
 * Prefers the `LAN_BASE_URL` environment variable if set, otherwise constructs
 * a URL using the first private IPv4 address and the server port.
 * @returns {string} The resolved base URL
 */
export function resolveBaseUrl(): string {
	if (process.env.LAN_BASE_URL) return process.env.LAN_BASE_URL;

	const ip = firstPrivateIPv4() ?? "127.0.0.1";
	const port = Number(process.env.PORT ?? 3000);

	return `http://${ip}:${port}`;
}

/**
 * Resolves the list of relay URLs this node can offer to peers that need them.
 * Prefers the `LAN_RELAY_URLS` environment variable if set, otherwise uses the
 * base URL and optionally the `LAN_PORT_FORWARD_BASE_URL` if provided.
 * @param {string} baseUrl The base URL to use if no explicit relay URLs are set
 * @returns {string[]} An array of relay URLs
 */
export function resolveRelayUrls(baseUrl: string): string[] {
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

/**
 * Retrieves the first private IPv4 address of the local machine.
 * @returns {string | null} The first private IPv4 address, or null if none found
 * @see https://en.wikipedia.org/wiki/Private_network#Private_IPv4_address_spaces
 */
export function firstPrivateIPv4(): string | null {
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

/**
 * Returns all non-internal IPv4 interfaces on the local machine.
 * Used to determine broadcast addresses for LAN discovery.
 * @returns {IPv4Interface[]} Array of objects containing `address` and `netmask`
 */
export function getIPv4Interfaces(): IPv4Interface[] {
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

/**
 * Converts a dotted-decimal IPv4 address string to a 32-bit integer.
 * Returns `0` for any malformed input.
 * @param {string} ip - IPv4 address (e.g. `"192.168.1.42"`)
 * @returns {number} The address as a 32-bit integer
 */
export function ipToInt(ip: string): number {
	const parts = ip.split(".").map((p) => Number(p));

	if (
		parts.length !== 4 ||
		parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)
	) {
		return 0;
	}

	return (
		((parts[0] ?? 0) << 24) |
		((parts[1] ?? 0) << 16) |
		((parts[2] ?? 0) << 8) |
		(parts[3] ?? 0)
	);
}

/**
 * Converts a 32-bit integer to a dotted-decimal IPv4 address string.
 * @param {number} n - The address as a 32-bit integer
 * @returns {string} IPv4 address (e.g. `"192.168.1.42"`)
 */
export function intToIp(n: number): string {
	const b1 = (n >>> 24) & 255;
	const b2 = (n >>> 16) & 255;
	const b3 = (n >>> 8) & 255;
	const b4 = n & 255;

	return `${b1}.${b2}.${b3}.${b4}`;
}

/**
 * Computes the broadcast address for a given IPv4 address and subnet mask.
 * @param {string} address - IPv4 address (e.g. `"192.168.1.42"`)
 * @param {string} netmask - Subnet mask (e.g. `"255.255.255.0"`)
 * @returns {string | null} The broadcast address, or `null` if either input is invalid
 */
export function getBroadcastAddress(
	address: string,
	netmask: string,
): string | null {
	const ip = ipToInt(address);
	const mask = ipToInt(netmask);
	if (!ip || !mask) return null;
	const broadcast = (ip & mask) | (~mask >>> 0);
	return intToIp(broadcast >>> 0);
}

/**
 * Attaches LAN discovery metadata to a peer, identifying which node it was
 * seen through and how to reach it.
 * @param {PeerInfo} peer - The peer to annotate
 * @param {string} nodeId - The node ID of the server that observed this peer
 * @param {string} baseUrl - The base URL of that node
 * @param {string[]} relayUrls - Relay URLs through which this peer can be reached
 * @returns {PeerInfo} A new `PeerInfo` with `lanNodeId`, `relayBaseUrl`, and `relayUrls` merged into `metadata`
 */
export function withLanMetadata(
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
