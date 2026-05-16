/**
 * useP2P - React hook that wires up the P2P network
 *
 * Usage:
 *   const { sendToPeer, broadcast } = useP2P({
 *     peerId: session.user.id,
 *     onMessage: (msg) => console.log(msg),
 *   });
 */

"use client";

import { useEffect, useRef } from "react";
import { getNetwork } from "@/lib/p2p-network";
import { api } from "@/trpc/react";
import type { P2PMessage } from "@/server/p2p-types";

interface UseP2POptions {
	peerId: string;
	onMessage?: (message: P2PMessage) => void;
}

export function useP2P({ peerId, onMessage }: UseP2POptions) {
	const network = useRef(getNetwork());

	// Get ICE servers and peer list from server
	const { data: iceServers } = api.p2p.getIceServers.useQuery();
	const { data: peers } = api.p2p.listPeers.useQuery(undefined, {
		refetchInterval: 3000, // poll every 3s for new peers
	});

	// Poll for incoming signals every 1s while page is open
	const { data: signals } = api.p2p.getSignals.useQuery(
		{ peerId },
		{ refetchInterval: 1000 },
	);

	// Mutation to send signals through the server
	const sendSignalMutation = api.p2p.sendSignal.useMutation();

	// Register on mount, unregister on unmount
	const registerMutation = api.p2p.register.useMutation();
	const unregisterMutation = api.p2p.unregister.useMutation();

	useEffect(() => {
		if (!peerId) return;
		registerMutation.mutate({ peerId, ip: "browser" });
		return () => {
			unregisterMutation.mutate({ peerId });
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [peerId]);

	// Configure the network when ICE servers are ready
	useEffect(() => {
		if (!peerId || !iceServers) return;
		network.current.configure({
			peerId,
			iceServers,
			sendSignal: (signal) => sendSignalMutation.mutate(signal),
		});
	}, [peerId, iceServers]);

	// Update peer list when it changes
	useEffect(() => {
		if (!peers) return;
		network.current.updatePeers(peers.map((p) => p.peerId));
	}, [peers]);

	// Feed incoming signals into the network
	useEffect(() => {
		if (!signals || signals.length === 0) return;
		network.current.handleSignals(signals);
	}, [signals]);

	// Subscribe to incoming messages
	useEffect(() => {
		if (!onMessage) return;
		return network.current.onMessage(onMessage);
	}, [onMessage]);

	return {
		sendToPeer: (targetPeerId: string, message: P2PMessage) =>
			network.current.sendToPeer(targetPeerId, message),
		broadcast: (message: P2PMessage) =>
			network.current.broadcast(message),
	};
}