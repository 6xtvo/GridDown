/**
 * P2P tRPC Router
 * Handles peer registration, WebRTC signalling, and message passing.
 *
 * How it works:
 * 1. Each client registers itself with register()
 * 2. Clients discover each other via listPeers()
 * 3. WebRTC offer/answer/ICE signals are exchanged via sendSignal() / getSignals()
 * 4. Once WebRTC is connected, messages go peer-to-peer (not through server)
 * 5. If WebRTC fails, messages fall back to sendMessage() / getMessages()
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { MemoryPeerRegistry } from "@/server/peer-registry";
import { webrtcManager } from "@/server/webrtc-manager";

// Persist registry across Next.js hot reloads
const globalForP2P = globalThis as { __peerRegistry?: MemoryPeerRegistry };

function getRegistry(): MemoryPeerRegistry {
	if (!globalForP2P.__peerRegistry) {
		globalForP2P.__peerRegistry = new MemoryPeerRegistry();
	}
	return globalForP2P.__peerRegistry;
}

export const p2pRouter = createTRPCRouter({
	/**
	 * Register yourself as an online peer.
	 * Call this on page load, pass your WebRTC peer ID.
	 */
	register: publicProcedure
		.input(
			z.object({
				peerId: z.string(),
				ip: z.string().default("unknown"),
				port: z.number().optional(),
				metadata: z.record(z.unknown()).optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const registry = getRegistry();
			await registry.register({
				peerId: input.peerId,
				ip: input.ip,
				port: input.port,
				metadata: input.metadata,
				lastSeen: Date.now(),
			});
			webrtcManager.registerConnection(input.peerId, input.metadata);
			return { success: true, peerId: input.peerId };
		}),

	/**
	 * Unregister when leaving the page.
	 */
	unregister: publicProcedure
		.input(z.object({ peerId: z.string() }))
		.mutation(async ({ input }) => {
			const registry = getRegistry();
			await registry.unregister(input.peerId);
			webrtcManager.closeConnection(input.peerId);
			return { success: true };
		}),

	/**
	 * Get all online peers.
	 * Poll this to discover who to connect to.
	 */
	listPeers: publicProcedure.query(async () => {
		const registry = getRegistry();
		const peers = await registry.list();
		return peers.map((peer) => ({
			peerId: peer.peerId,
			ip: peer.ip,
			port: peer.port,
			metadata: peer.metadata,
		}));
	}),

	/**
	 * Send a WebRTC signal (offer / answer / ICE candidate) to another peer.
	 * The other peer picks it up via getSignals().
	 */
	sendSignal: publicProcedure
		.input(
			z.object({
				from: z.string(),
				to: z.string(),
				type: z.enum(["offer", "answer", "ice-candidate"]),
				data: z.record(z.unknown()),
			}),
		)
		.mutation(({ input }) => {
			webrtcManager.queueSignal({
				from: input.from,
				to: input.to,
				type: input.type,
				data: input.data,
				timestamp: Date.now(),
			});
			return { success: true };
		}),

	/**
	 * Retrieve pending signals addressed to you.
	 * Poll this every ~1s while connecting.
	 */
	getSignals: publicProcedure
		.input(z.object({ peerId: z.string() }))
		.query(({ input }) => {
			return webrtcManager.getSignals(input.peerId);
		}),

	/**
	 * Server-side message fallback.
	 * Used when WebRTC connection fails.
	 */
	sendMessage: publicProcedure
		.input(
			z.object({
				from: z.string(),
				to: z.string(),
				type: z.string(),
				data: z.unknown(),
			}),
		)
		.mutation(({ input }) => {
			webrtcManager.storeMessage(input.to, {
				from: input.from,
				type: input.type,
				data: input.data,
				timestamp: Date.now(),
			});
			return { success: true };
		}),

	/**
	 * Retrieve messages sent to you via the server fallback.
	 */
	getMessages: publicProcedure
		.input(
			z.object({
				peerId: z.string(),
				count: z.number().min(1).max(50).default(10),
			}),
		)
		.query(({ input }) => {
			return webrtcManager.getMessages(input.peerId, input.count);
		}),

	/**
	 * Get ICE server config (STUN/TURN servers).
	 * Call this before creating a WebRTC connection.
	 */
	getIceServers: publicProcedure.query(() => {
		return webrtcManager.getIceServers();
	}),

	/**
	 * Clean up stale peers. Call this periodically (e.g. every 10 minutes).
	 */
	cleanupStalePeers: publicProcedure
		.input(z.object({ maxAge: z.number().default(600_000) }))
		.mutation(async ({ input }) => {
			const registry = getRegistry();
			const removed = await registry.cleanup(input.maxAge);
			return { removed };
		}),

	getPeer: publicProcedure
		.input(z.object({ peerId: z.string() }))
		.query(async ({ input }) => {
			const registry = getRegistry();
			const peer = await registry.get(input.peerId);
			return peer ?? null;
		}),
});
