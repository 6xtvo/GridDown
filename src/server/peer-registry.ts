/**
 * Peer Registry - Abstract base class
 * Supports multiple backends (memory, database, etc.)
 */

import type { PrismaClient } from "@prisma/client";
import type { PeerInfo } from "@/server/p2p-types";

export abstract class PeerRegistry {
	abstract register(peer: PeerInfo): Promise<void>;

	abstract unregister(peerId: string): Promise<void>;

	abstract get(peerId: string): Promise<PeerInfo | null>;

	abstract list(): Promise<PeerInfo[]>;

	abstract update(peerId: string, partial: Partial<PeerInfo>): Promise<void>;

	/**
	 * Remove peers older than maxAge (ms)
	 */
	abstract cleanup(maxAge: number): Promise<number>;
}

/**
 * In-memory peer registry implementation
 * Perfect for development and small deployments
 */
export class MemoryPeerRegistry extends PeerRegistry {
	private readonly peers = new Map<string, PeerInfo>();

	async register(peer: PeerInfo): Promise<void> {
		this.peers.set(peer.peerId, {
			...peer,
			lastSeen: Date.now(),
		});
	}

	async unregister(peerId: string): Promise<void> {
		this.peers.delete(peerId);
	}

	async get(peerId: string): Promise<PeerInfo | null> {
		return this.peers.get(peerId) ?? null;
	}

	async list(): Promise<PeerInfo[]> {
		return [...this.peers.values()];
	}

	async update(peerId: string, partial: Partial<PeerInfo>): Promise<void> {
		const peer = this.peers.get(peerId);

		if (!peer) {
			return;
		}

		this.peers.set(peerId, {
			...peer,
			...partial,
			lastSeen: Date.now(),
		});
	}

	async cleanup(maxAge: number): Promise<number> {
		const now = Date.now();

		let removed = 0;

		for (const [peerId, peer] of this.peers) {
			if (now - peer.lastSeen > maxAge) {
				this.peers.delete(peerId);
				removed++;
			}
		}

		return removed;
	}
}

/**
 * Database-backed peer registry using Prisma
 * Persistent storage across server restarts
 */
export class DatabasePeerRegistry extends PeerRegistry {
	constructor(private readonly prisma: PrismaClient) {
		super();
	}

	async register(peer: PeerInfo): Promise<void> {
		await this.prisma.peer.upsert({
			where: {
				peerId: peer.peerId,
			},

			update: {
				ip: peer.ip,
				port: peer.port,
				metadata: peer.metadata ?? undefined,
				lastSeen: new Date(),
			},

			create: {
				peerId: peer.peerId,
				ip: peer.ip,
				port: peer.port,
				metadata: peer.metadata ?? undefined,
				lastSeen: new Date(),
			},
		});
	}

	async unregister(peerId: string): Promise<void> {
		try {
			await this.prisma.peer.delete({
				where: {
					peerId,
				},
			});
		} catch {
			// Ignore not-found errors
		}
	}

	async get(peerId: string): Promise<PeerInfo | null> {
		const peer = await this.prisma.peer.findUnique({
			where: {
				peerId,
			},
		});

		if (!peer) {
			return null;
		}

		return {
			peerId: peer.peerId,
			ip: peer.ip,
			port: peer.port,
			metadata: typeof peer.metadata === "object" ? peer.metadata : undefined,
			lastSeen: peer.lastSeen.getTime(),
		};
	}

	async list(): Promise<PeerInfo[]> {
		const peers = await this.prisma.peer.findMany();

		// @ts-expect-error
		return peers.map((peer) => ({
			peerId: peer.peerId,
			ip: peer.ip,
			port: peer.port,
			metadata: typeof peer.metadata === "object" ? peer.metadata : undefined,
			lastSeen: peer.lastSeen.getTime(),
		}));
	}

	async update(peerId: string, partial: Partial<PeerInfo>): Promise<void> {
		try {
			await this.prisma.peer.update({
				where: {
					peerId,
				},

				data: {
					...(partial.ip !== undefined && {
						ip: partial.ip,
					}),

					...(partial.port !== undefined && {
						port: partial.port,
					}),

					...(partial.metadata !== undefined && {
						metadata: partial.metadata,
					}),

					lastSeen: new Date(),
				},
			});
		} catch {
			// Ignore not-found errors
		}
	}

	async cleanup(maxAge: number): Promise<number> {
		const cutoff = new Date(Date.now() - maxAge);

		const result = await this.prisma.peer.deleteMany({
			where: {
				lastSeen: {
					lt: cutoff,
				},
			},
		});

		return result.count;
	}
}

/**
 * Registry factory
 */
export function createPeerRegistry(
	type: "memory" | "database" = "memory",
	prisma?: PrismaClient,
): PeerRegistry {
	if (type === "database") {
		if (!prisma) {
			throw new Error("Prisma client required for database registry");
		}

		return new DatabasePeerRegistry(prisma);
	}

	return new MemoryPeerRegistry();
}
