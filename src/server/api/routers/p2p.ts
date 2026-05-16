import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { MemoryPeerRegistry } from "@/server/peer-registry";
import { webrtcManager } from "@/server/webrtc-manager";

// --- NEXT.JS HOT-RELOAD FIX ---
// Attach the registry to globalThis so it doesn't get wiped during development
const globalForP2P = globalThis as unknown as {
	peerRegistry: MemoryPeerRegistry | undefined;
};

function getPeerRegistry(): MemoryPeerRegistry {
	if (!globalForP2P.peerRegistry) {
		globalForP2P.peerRegistry = new MemoryPeerRegistry();
		console.log("[P2P] Peer registry initialized");
	}
	return globalForP2P.peerRegistry;
}
// ------------------------------

export const p2pRouter = createTRPCRouter({
	/**
	 * Register a peer with the network
	 */
	register: publicProcedure
		.input(
			z.object({
				peerId: z.string(),
				ip: z.string(),
				port: z.number().optional(),
				metadata: z.record(z.unknown()).optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const registry = getPeerRegistry();
			await registry.register({
				peerId: input.peerId,
				ip: input.ip,
				port: input.port,
				metadata: input.metadata,
				lastSeen: Date.now(),
			});

			// Register connection in WebRTC manager
			webrtcManager.registerConnection(input.peerId, input.metadata);

			console.log(`[P2P] Peer registered: ${input.peerId} (${input.ip})`);
			const allPeers = await registry.list();
			console.log(`[P2P] Total peers: ${allPeers.length}`);

			return { success: true, peerId: input.peerId };
		}),

	/**
	 * Get list of all peers on the network
	 */
	listPeers: publicProcedure.query(async () => {
		const registry = getPeerRegistry();
		const peers = await registry.list();
		console.log(`[P2P] List peers called - returning ${peers.length} peers`);
		return peers.map((peer) => ({
			peerId: peer.peerId,
			ip: peer.ip,
			port: peer.port,
			metadata: peer.metadata,
		}));
	}),

	/**
	 * Get specific peer information
	 */
	getPeer: publicProcedure
		.input(z.object({ peerId: z.string() }))
		.query(async ({ input }) => {
			const registry = getPeerRegistry();
			const peer = await registry.get(input.peerId);
			return peer || null;
		}),

	/**
	 * Unregister a peer (called when disconnecting)
	 */
	unregister: publicProcedure
		.input(z.object({ peerId: z.string() }))
		.mutation(async ({ input }) => {
			const registry = getPeerRegistry();
			await registry.unregister(input.peerId);
			webrtcManager.closeConnection(input.peerId);
			console.log(`[P2P] Peer unregistered: ${input.peerId}`);
			return { success: true };
		}),

	/**
	 * Send WebRTC signal (offer/answer/ICE candidate)
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
		.mutation(async ({ input }) => {
			webrtcManager.queueSignal({
				from: input.from,
				to: input.to,
				type: input.type,
				data: input.data,
				timestamp: Date.now(),
			});

			console.log(
				`[P2P] Signal queued: ${input.type} from ${input.from} to ${input.to}`,
			);
			return { success: true };
		}),

	/**
	 * Retrieve pending signals for a peer
	 */
	getSignals: publicProcedure
		.input(z.object({ peerId: z.string() }))
		.query(async ({ input }) => {
			const signals = webrtcManager.getSignals(input.peerId);
			if (signals.length > 0) {
				console.log(
					`[P2P] Retrieved ${signals.length} signals for ${input.peerId}`,
				);
			}
			return signals;
		}),

	/**
	 * Store a message from one peer to another
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
		.mutation(async ({ input }) => {
			webrtcManager.storeMessage(input.to, {
				from: input.from,
				type: input.type,
				data: input.data,
				timestamp: Date.now(),
			});

			return { success: true };
		}),

	/**
	 * Retrieve pending messages for a peer
	 */
	getMessages: publicProcedure
		.input(
			z.object({
				peerId: z.string(),
				count: z.number().optional().default(10),
			}),
		)
		.query(async ({ input }) => {
			const messages = webrtcManager.getMessages(input.peerId, input.count);
			return messages;
		}),

	/**
	 * Get pending message count
	 */
	getPendingMessageCount: publicProcedure
		.input(z.object({ peerId: z.string() }))
		.query(async ({ input }) => {
			const count = webrtcManager.hasPendingMessages(input.peerId);
			return { count };
		}),

	/**
	 * Get ICE server configuration
	 */
	getIceServers: publicProcedure.query(async () => {
		const servers = webrtcManager.getIceServers();
		return servers;
	}),

	/**
	 * Cleanup stale peers (call periodically)
	 */
	cleanupStalePeers: publicProcedure
		.input(z.object({ maxAge: z.number().default(600000) })) // Default: 10 minutes
		.mutation(async ({ input }) => {
			const registry = getPeerRegistry();
			const removed = await registry.cleanup(input.maxAge);
			console.log(`[P2P] Cleaned up ${removed} stale peers`);
			return { removed };
		}),
});
