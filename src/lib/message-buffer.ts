import type { P2PMessage } from "@/types/p2p";

/**
 * How long a buffered message is retained before being auto-expired.
 */
const MESSAGE_TTL = 300_000; // 5 minutes

/**
 * Buffers inbound application messages keyed by the recipient peer ID.
 * Messages are held until polled or until they expire after {@link MESSAGE_TTL}.
 */
export class MessageBuffer {
	private buffer = new Map<string, P2PMessage[]>();

	/**
	 * Returns a copy of the message with a guaranteed `id`, generating one if absent.
	 * @param {P2PMessage} message - The message to ensure an ID for
	 * @returns {P2PMessage} The message with `id` set
	 */
	private ensureId(message: P2PMessage): P2PMessage {
		return { ...message, id: message.id ?? crypto.randomUUID() };
	}

	/**
	 * Adds a message to the recipient's buffer and schedules its expiry.
	 * @param {string} peerId - The recipient peer ID
	 * @param {P2PMessage} message - The message to buffer
	 */
	public enqueue(peerId: string, message: P2PMessage): void {
		const storedMessage = this.ensureId(message);
		const existing = this.buffer.get(peerId) ?? [];

		existing.push(storedMessage);
		this.buffer.set(peerId, existing);

		setTimeout(() => {
			const messages = this.buffer.get(peerId);

			if (!messages) return;

			const filtered = messages.filter((m) => m.id !== storedMessage.id);

			if (filtered.length === 0) {
				this.buffer.delete(peerId);
			} else {
				this.buffer.set(peerId, filtered);
			}
		}, MESSAGE_TTL);
	}

	/**
	 * Removes and returns up to `count` messages for the given peer, oldest first.
	 * @param {string} peerId - The peer to dequeue messages for
	 * @param {number} count - Maximum number of messages to return
	 * @returns {P2PMessage[]} The dequeued messages, or `[]` if none
	 */
	public dequeue(peerId: string, count: number): P2PMessage[] {
		const messages = this.buffer.get(peerId) ?? [];
		const taken = messages.splice(0, count);

		if (messages.length === 0) {
			this.buffer.delete(peerId);
		} else {
			this.buffer.set(peerId, messages);
		}

		return taken;
	}

	/**
	 * Returns the number of buffered messages waiting for the given peer.
	 * @param {string} peerId - The peer to check
	 * @returns {number} Count of pending messages
	 */
	public pending(peerId: string): number {
		return (this.buffer.get(peerId) ?? []).length;
	}

	/**
	 * Removes all buffered messages for all peers.
	 */
	public clear(): void {
		this.buffer.clear();
	}
}
