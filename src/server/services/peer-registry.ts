import type { PeerInfo } from "@/types/p2p";

/**
 * Registry of connected (online) peers (map of peer id -> peer info).
 * On page load, peers are registered, and unregisted on page unload.
 * Implements cleanup of stale peers that haven't been inactive for a certain amount of time.
 * No persistence, resets on server restart.
 */
export class PeerRegistry {
	private readonly peers = new Map<string, PeerInfo>();

	/**
	 * Registers a peer to the map with its `PeerInfo`.
	 * @param {PeerInfo} peer Peer information to register
	 */
	public async register(peer: PeerInfo): Promise<void> {
		this.peers.set(peer.peerId, {
			...peer,
			lastSeen: Date.now(),
		});
	}

	/**
	 * Unregisters a peer from the map.
	 * @param {string} peerId ID of the peer to unregister
	 */
	public async unregister(peerId: string): Promise<void> {
		this.peers.delete(peerId);
	}

	/**
	 * Retrieves information about a specific peer.
	 * @param {string} peerId ID of the peer to retrieve
	 * @returns {Promise<PeerInfo | null>} The peer information or null if not found
	 */
	public async get(peerId: string): Promise<PeerInfo | null> {
		return this.peers.get(peerId) ?? null;
	}

	/**
	 * Returns the registry map as a an array of peers (`PeerInfo[]`).
	 * @returns {Promise<PeerInfo[]>} Array of all registered peers
	 */
	public async list(): Promise<PeerInfo[]> {
		return [...this.peers.values()];
	}

	/**
	 * Updates information for a specific peer.
	 * @param {string} peerId ID of the peer to update
	 * @param {Partial<PeerInfo>} partial Partial peer information to update
	 * @returns {Promise<void>}
	 */
	public async update(
		peerId: string,
		partial: Partial<PeerInfo>,
	): Promise<void> {
		const peer = this.peers.get(peerId);

		if (!peer) return;

		this.peers.set(peerId, {
			...peer,
			...partial,
			lastSeen: Date.now(),
		});
	}

	/**
	 * Remove peers that haven't been seen in `maxAge`ms.
	 * @param {number} maxAge Maximum age of peers to keep
	 * @returns {Promise<number>} Number of peers removed
	 */
	public async cleanup(maxAge: number): Promise<number> {
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
