/**
 * Peer Registry
 * Tracks which peers are currently online
 */

import type { PeerInfo } from "@/server/p2p-types";

export class MemoryPeerRegistry {
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
		if (!peer) return;
		this.peers.set(peerId, {
			...peer,
			...partial,
			lastSeen: Date.now(),
		});
	}

	/**
	 * Remove peers that haven't been seen in maxAge ms
	 */
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
