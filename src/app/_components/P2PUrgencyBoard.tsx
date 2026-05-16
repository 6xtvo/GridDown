"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/trpc/react";

interface UrgentMessage {
	from: string;
	text: string;
	time: number;
}

export function P2PUrgencyBoard() {
	// Start with empty/placeholder states for safe hydration
	const [myPeerId, setMyPeerId] = useState<string>("CONNECTING...");
	const [isMounted, setIsMounted] = useState(false);
	
	const [messages, setMessages] = useState<UrgentMessage[]>([]);
	const [input, setInput] = useState("");
	const bottomRef = useRef<HTMLDivElement>(null);

	// Mutations
	const register = api.p2p.register.useMutation();
	const unregister = api.p2p.unregister.useMutation();
	const sendMessage = api.p2p.sendMessage.useMutation();

	// 1. Generate ID strictly on the client after mounting
	useEffect(() => {
		setIsMounted(true);
		setMyPeerId(`OP-${Math.random().toString(36).substring(2, 6).toUpperCase()}`);
	}, []);

	// 2. Fetch available peers (poll every 5 seconds)
	const { data: peers } = api.p2p.listPeers.useQuery(undefined, {
		refetchInterval: 5000,
		enabled: isMounted, // Only run once mounted
	});

	// 3. Poll for incoming messages (every 2 seconds)
	const { data: incomingMessages } = api.p2p.getMessages.useQuery(
		{ peerId: myPeerId },
		{ 
			refetchInterval: 2000,
			// Only start polling once registered and mounted with a real ID
			enabled: register.isSuccess && isMounted && myPeerId !== "CONNECTING..."
		}
	);

	// 4. Register on mount (once ID is generated), unregister on dismount
	useEffect(() => {
		if (!isMounted || myPeerId === "CONNECTING...") return;

		register.mutate({ 
			peerId: myPeerId, 
			ip: "client-local", 
			metadata: { role: "operator" } 
		});

		return () => {
			unregister.mutate({ peerId: myPeerId });
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [myPeerId, isMounted]);

	// 5. Catch dequeued messages and append them to local state
	useEffect(() => {
		if (incomingMessages && incomingMessages.length > 0) {
			const formatted = incomingMessages.map((m) => ({
				from: m.from,
				text: String(m.data),
				time: m.timestamp,
			}));
			setMessages((prev) => [...prev, ...formatted]);
		}
	}, [incomingMessages]);

	// Auto-scroll to newest message
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const handleBroadcast = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || !peers) return;

		const textToSend = input.trim();
		setInput("");

		// Optimistically add to our own board
		setMessages((prev) => [...prev, { from: myPeerId, text: textToSend, time: Date.now() }]);

		// Broadcast to all other registered peers
		const otherPeers = peers.filter((p) => p.peerId !== myPeerId);
		
		await Promise.all(
			otherPeers.map((peer) =>
				sendMessage.mutateAsync({
					from: myPeerId,
					to: peer.peerId,
					type: "URGENT_BROADCAST",
					data: textToSend,
				})
			)
		);
	};

	// Prevent server-rendered mismatched HTML by returning a skeleton or null
	// until the client takes over.
	if (!isMounted) {
		return (
			<div className="flex w-full flex-col gap-4 border-2 border-zinc-800 bg-black p-4 font-seven text-zinc-300">
				<div className="flex justify-between border-b border-zinc-800 pb-2 text-sm text-zinc-500">
					<span>INITIALIZING SECURE CHANNEL...</span>
				</div>
			</div>
		);
	}

	return (
		<div className="flex w-full flex-col gap-4 border-2 border-zinc-800 bg-black p-4 font-seven text-zinc-300">
			<div className="flex justify-between border-b border-zinc-800 pb-2 text-sm text-zinc-500">
				<span>OPERATOR ID: {myPeerId}</span>
				<span>ACTIVE NODES: {peers?.length ?? 0}</span>
			</div>

			{/* Message Display */}
			<div className="flex h-64 flex-col gap-2 overflow-y-auto p-2">
				{messages.length === 0 ? (
					<div className="animate-pulse text-zinc-600">AWAITING TRANSMISSIONS...</div>
				) : (
					messages.map((msg, idx) => (
						<div key={idx} className={`${msg.from === myPeerId ? "text-right" : "text-left"}`}>
							<span className={`text-xs ${msg.from === myPeerId ? "text-zinc-500" : "text-red-500"}`}>
								[{new Date(msg.time).toLocaleTimeString()}] {msg.from}
							</span>
							<p className={`text-lg ${msg.from === myPeerId ? "text-zinc-300" : "text-red-400"}`}>
								{msg.text}
							</p>
						</div>
					))
				)}
				<div ref={bottomRef} />
			</div>

			{/* Input Form */}
			<form onSubmit={handleBroadcast} className="flex gap-2 pt-2">
				<input
					type="text"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="ENTER URGENT DIRECTIVE..."
					className="flex-1 border border-zinc-800 bg-zinc-900 px-4 py-2 text-red-500 outline-none focus:border-red-600 focus:bg-black uppercase"
				/>
				<button
					type="submit"
					disabled={!input.trim() || !peers || peers.length <= 1}
					className="border border-red-600 bg-red-900/20 px-6 py-2 text-red-500 transition hover:bg-red-600 hover:text-white disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-700"
				>
					BROADCAST
				</button>
			</form>
		</div>
	);
}