import type { WebRTCSignal } from "@/types/network";

/**
 * How long a queued signal is retained before being auto-expired.
 */
const SIGNAL_TTL = 60_000; // 1 minute

/**
 * Stores inbound WebRTC signals (offers, answers, ICE candidates) keyed by
 * the recipient peer ID. Signals are held until the recipient polls for them
 * or until they expire after {@link SIGNAL_TTL}.
 */
export class SignalQueue {
	private queue = new Map<string, WebRTCSignal[]>();

	/**
	 * Returns a copy of the signal with a guaranteed `id`, generating one if absent.
	 * @param {WebRTCSignal} signal - The signal to ensure an ID for
	 * @returns {WebRTCSignal} The signal with `id` set
	 */
	private ensureId(signal: WebRTCSignal): WebRTCSignal {
		return { ...signal, id: signal.id ?? crypto.randomUUID() };
	}

	/**
	 * Adds a signal to the recipient's queue and schedules its expiry.
	 * @param {WebRTCSignal} signal - The signal to enqueue
	 */
	public enqueue(signal: WebRTCSignal): void {
		const storedSignal = this.ensureId(signal);
		const existing = this.queue.get(signal.to) ?? [];

		existing.push(storedSignal);
		this.queue.set(signal.to, existing);

		setTimeout(() => {
			const signals = this.queue.get(signal.to);

			if (!signals) return;

			const filtered = signals.filter((s) => s.id !== storedSignal.id);

			if (filtered.length === 0) {
				this.queue.delete(signal.to);
			} else {
				this.queue.set(signal.to, filtered);
			}
		}, SIGNAL_TTL);
	}

	/**
	 * Removes and returns all queued signals for the given peer.
	 * @param {string} peerId - The peer to dequeue signals for
	 * @returns {WebRTCSignal[]} All pending signals, or `[]` if none
	 */
	public dequeue(peerId: string): WebRTCSignal[] {
		const signals = this.queue.get(peerId) ?? [];
		this.queue.delete(peerId);
		return signals;
	}

	/** Removes all queued signals for all peers. */
	public clear(): void {
		this.queue.clear();
	}
}
