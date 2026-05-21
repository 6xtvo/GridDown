"use client";

import { useEffect, useRef } from "react";
import { getNetwork } from "@/services/p2p-network";
import { api } from "@/trpc/react";
import type { P2PMessage, UseP2POptions } from "@/types/p2p";

/**
 * Wires up the P2P network for a given peer within the React lifecycle.
 *
 * Handles registration, ICE server configuration, peer discovery, signal
 * exchange, and message delivery. The server is only involved during the
 * initial handshake - once WebRTC data channels are open, all traffic is
 * peer-to-peer.
 *
 * @example
 * ```tsx
 * const { sendToPeer, broadcast } = useP2P({
 *   peerId: session.user.id,
 *   onMessage: (msg) => console.log(msg),
 * });
 * ```
 */
export function useP2P({ peerId, onMessage }: UseP2POptions) {
	const network = useRef(getNetwork());

	const { data: iceServers } = api.p2p.getIceServers.useQuery();

	/** Polled every 3 s so newly joined peers are discovered promptly. */
	const { data: peers } = api.p2p.listPeers.useQuery(undefined, {
		refetchInterval: 3_000,
	});

	/**
	 * Polled every 1 s to pick up offers, answers, and ICE candidates queued
	 * by other peers. Becomes a no-op once all data channels are open.
	 */
	const { data: signals } = api.p2p.getSignals.useQuery(
		{ peerId },
		{ refetchInterval: 1_000 },
	);

	const sendSignalMutation = api.p2p.sendSignal.useMutation();
	const registerMutation = api.p2p.register.useMutation();
	const unregisterMutation = api.p2p.unregister.useMutation();

	/**
	 * Register this peer on mount so others can discover it.
	 * Unregisters on unmount (page close / navigation away).
	 */
	useEffect(() => {
		if (!peerId) return;
		registerMutation.mutate({ peerId, ip: "browser" });
		return () => {
			unregisterMutation.mutate({ peerId });
		};
		// Mutations are intentionally excluded - their identity changes on every
		// render but the underlying RPC call is stable.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [peerId]);

	/**
	 * Configure the network once ICE servers are available.
	 * Passes a stable signal sender so the network can route offers/answers
	 * through the tRPC signalling server.
	 */
	useEffect(() => {
		if (!peerId || !iceServers) return;
		network.current.configure({
			peerId,
			iceServers,
			sendSignal: (signal) => sendSignalMutation.mutate(signal),
		});
	}, [peerId, iceServers]);

	/** Keep the network's peer list in sync with the server's. */
	useEffect(() => {
		if (!peers) return;
		network.current.updatePeers(peers.map((p) => p.peerId));
	}, [peers]);

	/** Forward polled signals into the network for processing. */
	useEffect(() => {
		if (!signals?.length) return;
		network.current.handleSignals(signals);
	}, [signals]);

	/**
	 * Subscribe to incoming P2P messages.
	 * The cleanup function returned by `onMessage` deregisters the listener.
	 */
	useEffect(() => {
		if (!onMessage) return;
		return network.current.onMessage(onMessage);
	}, [onMessage]);

	return {
		/**
		 * Send a message to a specific peer.
		 * Queued automatically if the data channel is not yet open.
		 */
		sendToPeer: (targetPeerId: string, message: P2PMessage) =>
			network.current.sendToPeer(targetPeerId, message),

		/** Broadcast a message to all known peers. */
		broadcast: (message: P2PMessage) => network.current.broadcast(message),
	};
}
