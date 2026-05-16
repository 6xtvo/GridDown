"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/trpc/react";

interface DirectMessage {
	from: string;
	text: string;
	time: number;
}

export default function IncidentChatPage() {
	const params = useParams();
	const router = useRouter();
	const targetPeerId = params.peerId as string;
	
	const [isMounted, setIsMounted] = useState(false);
	const [myPeerId, setMyPeerId] = useState("CONNECTING...");
	const [input, setInput] = useState("");
	const [messages, setMessages] = useState<DirectMessage[]>([]);
	const bottomRef = useRef<HTMLDivElement>(null);

	const register = api.p2p.register.useMutation();
	const sendMessage = api.p2p.sendMessage.useMutation();

	// Check if the target peer is still online
	const { data: targetPeer } = api.p2p.getPeer.useQuery(
		{ peerId: targetPeerId },
		{ refetchInterval: 5000, enabled: isMounted }
	);

	// Poll for direct messages addressed to us
	const { data: incomingMessages } = api.p2p.getMessages.useQuery(
		{ peerId: myPeerId },
		{ refetchInterval: 1500, enabled: isMounted && myPeerId !== "CONNECTING..." }
	);

	useEffect(() => {
		setIsMounted(true);
		// Retrieve the exact same ID we had on the UrgencyBoard
		const storedId = sessionStorage.getItem("operator_id");
		if (storedId) {
			setMyPeerId(storedId);
		} else {
			// Fallback (should rarely happen)
			const newId = `OP-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
			sessionStorage.setItem("operator_id", newId);
			setMyPeerId(newId);
		}
	}, []);

	// Keep registration alive
	useEffect(() => {
		if (!isMounted || myPeerId === "CONNECTING...") return;
		register.mutate({ peerId: myPeerId, ip: "client" });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [myPeerId]);

	// Dequeue messages and append
	useEffect(() => {
		if (incomingMessages && incomingMessages.length > 0) {
			// Filter to only messages from the person we are talking to
			const relevantMessages = incomingMessages
				.filter(m => m.from === targetPeerId)
				.map((m) => ({
					from: m.from,
					text: String(m.data),
					time: m.timestamp,
				}));

			if (relevantMessages.length > 0) {
				setMessages((prev) => [...prev, ...relevantMessages]);
			}
		}
	}, [incomingMessages, targetPeerId]);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const handleSend = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim()) return;

		const textToSend = input.trim();
		setInput("");

		// Optimistic UI update
		setMessages((prev) => [...prev, { from: myPeerId, text: textToSend, time: Date.now() }]);

		await sendMessage.mutateAsync({
			from: myPeerId,
			to: targetPeerId,
			type: "DIRECT_MESSAGE",
			data: textToSend,
		});
	};

	if (!isMounted) return <div className="min-h-screen bg-black" />;

	return (
		<main className="flex min-h-screen flex-col items-center bg-black text-white p-8">
			<div className="w-full max-w-4xl flex flex-col gap-4 border-2 border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.3)] bg-zinc-950 p-4">
				
				{/* Header */}
				<div className="flex justify-between items-center border-b border-red-600 pb-4">
					<button 
						onClick={() => router.push("/")}
						className="text-zinc-500 hover:text-red-500 font-seven transition flex items-center gap-2"
					>
						◄ RETURN TO GRID
					</button>
					<div className="font-seven text-right">
						<div className="text-xl text-red-500">ENCRYPTED COMMS: {targetPeerId}</div>
						<div className={`text-sm ${targetPeer ? "text-green-500" : "text-red-600 animate-pulse"}`}>
							{targetPeer ? "TARGET LOCK: ACQUIRED" : "TARGET OFFLINE / AWAITING PING..."}
						</div>
					</div>
				</div>

				{/* Chat Log */}
				<div className="h-96 overflow-y-auto flex flex-col gap-3 p-4 font-jetbrains border border-zinc-800 bg-black relative">
					<div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20"></div>
					
					{messages.length === 0 && (
						<div className="text-center font-seven text-zinc-600 pt-10">
							NO MESSAGES TRANSMITTED. YOU ARE ENCRYPTED.
						</div>
					)}
					
					{messages.map((msg, idx) => {
						const isMe = msg.from === myPeerId;
						return (
							<div key={idx} className={`flex flex-col max-w-[80%] ${isMe ? "self-end items-end" : "self-start items-start"}`}>
								<span className="font-seven text-[10px] text-zinc-500 tracking-widest">
									{isMe ? "YOU" : msg.from} // {new Date(msg.time).toLocaleTimeString()}
								</span>
								<div className={`p-3 mt-1 border ${isMe ? "border-zinc-700 bg-zinc-900 text-zinc-300" : "border-red-900 bg-red-950/50 text-red-400"}`}>
									{msg.text}
								</div>
							</div>
						);
					})}
					<div ref={bottomRef} />
				</div>

				{/* Input */}
				<form onSubmit={handleSend} className="flex gap-2">
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="TRANSMIT DIRECT MESSAGE..."
						className="flex-1 bg-black border border-red-900 px-4 py-3 text-red-500 font-jetbrains focus:outline-none focus:border-red-500"
					/>
					<button
						type="submit"
						disabled={!input.trim()}
						className="bg-red-900/20 border border-red-600 px-8 font-seven text-xl text-red-500 hover:bg-red-600 hover:text-white transition disabled:opacity-50"
					>
						SEND
					</button>
				</form>

			</div>
		</main>
	);
}