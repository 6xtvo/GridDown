"use client";

import { useEffect, useRef, useState } from "react";
import MapGL, { Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { api } from "@/trpc/react";

export interface IncidentData {
	id: string;
	type: string;
	priority: string;
	time: string;
	msg: string;
	lat: number;
	lng: number;
	loc: string;
	peerId: string;
}

const TYPE_CFG: Record<string, { color: string; glow: string; bg: string }> = {
	REQUEST: {
		color: "#ef4444",
		glow: "rgba(239,68,68,0.35)",
		bg: "rgba(239,68,68,0.07)",
	},
	OFFER: {
		color: "#3b82f6",
		glow: "rgba(59,130,246,0.35)",
		bg: "rgba(59,130,246,0.07)",
	},
	ANNOUNCEMENT: {
		color: "#22c55e",
		glow: "rgba(34,197,94,0.35)",
		bg: "rgba(34,197,94,0.07)",
	},
};

const PRIORITY_COLOR: Record<string, string> = {
	HIGH: "#ef4444",
	MED: "#eab308",
	LOW: "#52525b",
};

export function UrgencyBoard() {
	const [isMounted, setIsMounted] = useState(false);
	const [myPeerId, setMyPeerId] = useState("CONNECTING...");
	const [myIncidents, setMyIncidents] = useState<
		Omit<IncidentData, "peerId">[]
	>([]);
	const [incomingComms, setIncomingComms] = useState<{
		from: string;
		incidentId: string;
		msg: string;
	} | null>(null);
	const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
	const [chatLogs, setChatLogs] = useState<
		Record<string, { from: string; text: string; img?: string; time: number }[]>
	>({});
	const [chatInput, setChatInput] = useState("");
	const [attachedImage, setAttachedImage] = useState<string | null>(null);
	const [newType, setNewType] = useState("REQUEST");
	const [newPriority, setNewPriority] = useState("MED");
	const [newMsg, setNewMsg] = useState("");
	const [selectedLocation, setSelectedLocation] = useState<{
		lat: number;
		lng: number;
	} | null>(null);

	const chatBottomRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const register = api.p2p.register.useMutation();
	const sendMessage = api.p2p.sendMessage.useMutation();
	const { data: peers } = api.p2p.listPeers.useQuery(undefined, {
		refetchInterval: 3000,
		enabled: isMounted,
	});
	const { data: interceptedMessages } = api.p2p.getMessages.useQuery(
		{ peerId: myPeerId },
		{
			refetchInterval: 2000,
			enabled: isMounted && myPeerId !== "CONNECTING...",
		},
	);

	useEffect(() => {
		setIsMounted(true);
		let id = localStorage.getItem("operator_id");
		if (!id) {
			id = `OP-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
			localStorage.setItem("operator_id", id);
		}
		setMyPeerId(id);
		const savedInc = localStorage.getItem("griddown_my_incidents");
		if (savedInc) setMyIncidents(JSON.parse(savedInc));
		const savedChats = localStorage.getItem("griddown_chat_logs");
		if (savedChats) setChatLogs(JSON.parse(savedChats));
	}, []);

	useEffect(() => {
		if (isMounted)
			localStorage.setItem("griddown_chat_logs", JSON.stringify(chatLogs));
	}, [chatLogs, isMounted]);
	useEffect(() => {
		if (isMounted)
			localStorage.setItem(
				"griddown_my_incidents",
				JSON.stringify(myIncidents),
			);
	}, [myIncidents, isMounted]);

	useEffect(() => {
		if (!isMounted || myPeerId === "CONNECTING...") return;
		const sync = () =>
			register.mutate({
				peerId: myPeerId,
				ip: "client",
				metadata: { incidents: myIncidents },
			});
		sync();
		const hb = setInterval(sync, 5000);
		return () => clearInterval(hb);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [myPeerId, myIncidents]);

	useEffect(() => {
		chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [chatLogs, activeIncidentId]);

	useEffect(() => {
		if (!interceptedMessages?.length) return;
		setChatLogs((prev) => {
			const updated = { ...prev };
			let changed = false;
			interceptedMessages.forEach((m) => {
				try {
					const p = JSON.parse(String(m.data));
					if (p.type !== "INCIDENT_CHAT") return;
					const room = p.data.incidentId;
					if (!updated[room]) updated[room] = [];
					if (!updated[room].some((x) => x.time === m.timestamp)) {
						updated[room].push({
							from: m.from,
							text: p.data.text,
							img: p.data.img,
							time: m.timestamp,
						});
						changed = true;
					}
				} catch {
					/**/
				}
			});
			return changed ? updated : prev;
		});
		const latest = interceptedMessages[interceptedMessages.length - 1];
		if (latest) {
			try {
				const p = JSON.parse(String(latest.data));
				if (
					p.type === "INCIDENT_CHAT" &&
					p.data.incidentId !== activeIncidentId
				) {
					setIncomingComms({
						from: latest.from,
						incidentId: p.data.incidentId,
						msg: "NEW COMMS IN INCIDENT ROOM",
					});
				}
			} catch {
				/**/
			}
		}
	}, [interceptedMessages, activeIncidentId]);

	const getActiveFeed = (): IncidentData[] => {
		const other: IncidentData[] =
			peers
				?.filter((p) => p.peerId !== myPeerId)
				?.flatMap((p) =>
					((p.metadata?.incidents as Omit<IncidentData, "peerId">[]) || []).map(
						(inc) => ({ ...inc, peerId: p.peerId }),
					),
				) ?? [];
		const mine: IncidentData[] = myIncidents.map((inc) => ({
			...inc,
			peerId: myPeerId,
		}));
		const combined = [...mine, ...other];
		return Array.from(new Map(combined.map((i) => [i.id, i])).values()).sort(
			(a, b) => b.time.localeCompare(a.time),
		);
	};

	const activeFeed = getActiveFeed();
	const activeIncDetail = activeFeed.find((i) => i.id === activeIncidentId);

	const handleReport = (e: React.FormEvent) => {
		e.preventDefault();
		if (!newMsg.trim() || !selectedLocation) return;
		setMyIncidents((prev) => [
			{
				id: Math.random().toString(36).substr(2, 9),
				type: newType,
				priority: newType === "OFFER" ? "LOW" : newPriority,
				time: new Date().toLocaleTimeString(),
				msg: newMsg,
				lat: selectedLocation.lat,
				lng: selectedLocation.lng,
				loc: `COORD: [${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}]`,
			},
			...prev,
		]);
		setNewMsg("");
		setSelectedLocation(null);
	};

	const handleResolve = (id: string) => {
		setMyIncidents((prev) => prev.filter((i) => i.id !== id));
		if (activeIncidentId === id) setActiveIncidentId(null);
	};

	const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			const r = new FileReader();
			r.onloadend = () => setAttachedImage(r.result as string);
			r.readAsDataURL(file);
		}
	};

	const handleSendMessage = async (e: React.FormEvent) => {
		e.preventDefault();
		if ((!chatInput.trim() && !attachedImage) || !activeIncidentId) return;
		const payload = JSON.stringify({
			type: "INCIDENT_CHAT",
			data: {
				incidentId: activeIncidentId,
				text: chatInput,
				img: attachedImage,
			},
		});
		setChatLogs((prev) => ({
			...prev,
			[activeIncidentId]: [
				...(prev[activeIncidentId] || []),
				{
					from: myPeerId,
					text: chatInput,
					img: attachedImage || undefined,
					time: Date.now(),
				},
			],
		}));
		if (peers) {
			await Promise.all(
				peers
					.filter((p) => p.peerId !== myPeerId)
					.map((p) =>
						sendMessage.mutateAsync({
							from: myPeerId,
							to: p.peerId,
							type: "DIRECT_MESSAGE",
							data: payload,
						}),
					),
			);
		}
		setChatInput("");
		setAttachedImage(null);
	};

	if (!isMounted)
		return (
			<div
				className="flex h-40 items-center justify-center bg-[#020101]"
				style={{ fontFamily: "'Share Tech Mono',monospace" }}
			>
				<div className="flex items-center gap-3">
					<span
						className="h-1.5 w-1.5 rounded-full bg-red-500"
						style={{
							animation: "ub-ping 1.5s infinite",
							boxShadow: "0 0 6px rgba(220,38,38,0.8)",
						}}
					/>
					<span className="text-[10px] tracking-[0.35em] text-red-700">
						INITIALIZING SECURE CHANNEL...
					</span>
				</div>
			</div>
		);

	return (
		<>
			<style>{`
				@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
				.ub { font-family: 'Share Tech Mono', monospace; }
				@keyframes ub-ping { 75%,100%{transform:scale(2);opacity:0} }
				@keyframes ub-flicker { 0%,100%{opacity:1} 50%{opacity:0.85} }
			`}</style>

			<div
				className="ub flex flex-col"
				style={{
					background: "#020101",
					border: "1px solid rgba(220,38,38,0.18)",
				}}
			>
				{/* Board header */}
				<div
					className="relative flex items-center justify-between overflow-hidden px-5 py-3"
					style={{
						background:
							"linear-gradient(135deg, rgba(220,38,38,0.15) 0%, rgba(0,0,0,0) 60%)",
						borderBottom: "1px solid rgba(220,38,38,0.15)",
					}}
				>
					<div
						className="pointer-events-none absolute top-0 inset-x-0 h-px"
						style={{
							background:
								"linear-gradient(90deg,rgba(220,38,38,0.6),rgba(220,38,38,0.2),transparent)",
						}}
					/>
					<div className="flex items-center gap-3">
						<span
							className="text-[12px] tracking-[0.3em] text-red-500"
							style={{
								textShadow: "0 0 12px rgba(220,38,38,0.4)",
								animation: "ub-flicker 6s ease-in-out infinite",
							}}
						>
							LIVE URGENCY BOARD
						</span>
						<span className="text-[9px] tracking-[0.25em] text-zinc-700">
							VOL. 04
						</span>
					</div>
					<div className="flex items-center gap-5 text-[10px] tracking-[0.22em]">
						<span className="text-zinc-600">
							OPERATOR: <span className="text-zinc-400">{myPeerId}</span>
						</span>
						<div className="flex items-center gap-1.5">
							<span
								className="h-1.5 w-1.5 rounded-full bg-red-500"
								style={{
									animation: "ub-ping 2s infinite",
									boxShadow: "0 0 6px rgba(220,38,38,0.8)",
								}}
							/>
							<span className="text-red-600">LIVE NETWORK</span>
						</div>
					</div>
				</div>

				{/* Incoming comms alert */}
				{incomingComms && (
					<div
						className="flex items-center justify-between px-5 py-3"
						style={{
							background: "rgba(234,179,8,0.04)",
							borderBottom: "1px solid rgba(234,179,8,0.2)",
							boxShadow: "0 0 20px rgba(234,179,8,0.05) inset",
						}}
					>
						<div>
							<span
								className="text-[11px] tracking-[0.28em] text-yellow-400"
								style={{ animation: "ub-flicker 1.5s ease-in-out infinite" }}
							>
								INCOMING TRANSMISSION INTERCEPTED
							</span>
							<div className="mt-0.5 text-[9px] tracking-[0.22em] text-zinc-600">
								FROM: {incomingComms.from} // {incomingComms.msg}
							</div>
						</div>
						<button
							className="px-4 py-1.5 text-[10px] tracking-[0.28em] transition-all duration-150"
							onClick={() => {
								setActiveIncidentId(incomingComms.incidentId);
								setIncomingComms(null);
							}}
							style={{
								border: "1px solid rgba(234,179,8,0.4)",
								color: "rgba(234,179,8,0.9)",
								background: "rgba(234,179,8,0.05)",
							}}
						>
							OPEN ROOM →
						</button>
					</div>
				)}

				<div className="flex h-150 flex-col lg:flex-row">
					{/* Left: form + feed */}
					<div
						className="flex flex-1 flex-col"
						style={{ borderRight: "1px solid rgba(220,38,38,0.1)" }}
					>
						{/* Transmit form */}
						<div
							className="px-4 py-4"
							style={{
								borderBottom: "1px solid rgba(255,255,255,0.04)",
								background: "rgba(255,255,255,0.01)",
							}}
						>
							<div className="mb-3 flex items-center justify-between">
								<span className="text-[10px] tracking-[0.35em] text-red-600">
									BROADCAST INTEL
								</span>
								{!selectedLocation ? (
									<span
										className="text-[9px] tracking-[0.25em] text-yellow-600"
										style={{ animation: "ub-flicker 2s ease-in-out infinite" }}
									>
										AWAITING MAP COORD...
									</span>
								) : (
									<span className="text-[9px] tracking-[0.25em] text-green-500">
										TARGET LOCKED ✓
									</span>
								)}
							</div>
							<form className="flex flex-col gap-2" onSubmit={handleReport}>
								<input
									className="w-full bg-transparent px-3 py-2 text-[11px] text-zinc-300 outline-none placeholder:text-zinc-700 transition-all duration-150"
									onBlur={(e) => {
										e.currentTarget.style.borderColor =
											"rgba(255,255,255,0.06)";
									}}
									onChange={(e) => setNewMsg(e.target.value)}
									onFocus={(e) => {
										e.currentTarget.style.borderColor = "rgba(220,38,38,0.3)";
									}}
									placeholder="Situation description..."
									style={{ border: "1px solid rgba(255,255,255,0.06)" }}
									value={newMsg}
								/>
								<div className="flex gap-2">
									<select
										className="flex-1 bg-transparent px-2 py-2 text-[10px] tracking-[0.18em] outline-none transition-all duration-150"
										onChange={(e) => setNewType(e.target.value)}
										style={{
											border: "1px solid rgba(255,255,255,0.06)",
											color: "rgba(220,38,38,0.8)",
										}}
										value={newType}
									>
										<option className="bg-zinc-950" value="REQUEST">
											REQUEST
										</option>
										<option className="bg-zinc-950" value="OFFER">
											OFFER
										</option>
										<option className="bg-zinc-950" value="ANNOUNCEMENT">
											ANNOUNCE
										</option>
									</select>
									<select
										className="bg-transparent px-2 py-2 text-[10px] tracking-[0.18em] outline-none transition-all duration-150"
										disabled={newType === "OFFER"}
										onChange={(e) => setNewPriority(e.target.value)}
										style={{
											border: "1px solid rgba(255,255,255,0.06)",
											color:
												newType === "OFFER"
													? "rgba(100,100,100,0.4)"
													: "rgba(220,38,38,0.7)",
											cursor: newType === "OFFER" ? "not-allowed" : "pointer",
										}}
										value={newType === "OFFER" ? "LOW" : newPriority}
									>
										<option className="bg-zinc-950" value="HIGH">
											P-HIGH
										</option>
										<option className="bg-zinc-950" value="MED">
											P-MED
										</option>
										<option className="bg-zinc-950" value="LOW">
											P-LOW
										</option>
									</select>
									<button
										className="px-5 py-2 text-[10px] tracking-[0.3em] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-30"
										disabled={!selectedLocation || !newMsg.trim()}
										style={{
											border: "1px solid rgba(220,38,38,0.4)",
											color: "#f87171",
											background: "rgba(220,38,38,0.06)",
										}}
										type="submit"
									>
										TRANSMIT
									</button>
								</div>
							</form>
						</div>

						{/* Feed */}
						<div className="flex-1 overflow-y-auto p-3 space-y-1.5">
							{activeFeed.length === 0 && (
								<div
									className="flex h-32 items-center justify-center"
									style={{ border: "1px dashed rgba(255,255,255,0.04)" }}
								>
									<span className="text-[10px] tracking-[0.3em] text-zinc-800">
										NO ACTIVE INCIDENTS
									</span>
								</div>
							)}
							{activeFeed.map((inc) => {
								const cfg = TYPE_CFG[inc.type] ?? TYPE_CFG.REQUEST!;
								const isActive = activeIncidentId === inc.id;
								return (
									<div
										className="relative group cursor-pointer transition-all duration-150"
										key={inc.id}
										onClick={() => setActiveIncidentId(inc.id)}
										style={{
											background: isActive ? cfg.bg : "rgba(255,255,255,0.01)",
											border: `1px solid ${isActive ? cfg.color + "30" : "rgba(255,255,255,0.04)"}`,
											boxShadow: isActive ? `0 0 12px ${cfg.glow}` : "none",
										}}
									>
										<div
											className="absolute top-0 bottom-0 left-0 w-0.5"
											style={{
												background: cfg.color,
												boxShadow: `0 0 6px ${cfg.glow}`,
												opacity: isActive ? 1 : 0.3,
											}}
										/>

										<div className="px-3 py-2.5 pl-4">
											<div className="flex items-center justify-between mb-1.5">
												<div className="flex items-center gap-2">
													<span
														className="px-1.5 py-0.5 text-[8px] tracking-[0.2em]"
														style={{
															color: cfg.color,
															border: `1px solid ${cfg.color}40`,
															background: cfg.bg,
														}}
													>
														{inc.type}
													</span>
													<span
														className="text-[9px] tracking-[0.18em]"
														style={{
															color: PRIORITY_COLOR[inc.priority] ?? "#52525b",
														}}
													>
														{inc.type === "OFFER" ? "N/A" : `P-${inc.priority}`}
													</span>
												</div>
												<span className="text-[9px] tracking-widest text-zinc-700">
													{inc.time}
												</span>
											</div>

											<p className="text-[10px] leading-relaxed text-zinc-400 mb-2">
												{inc.msg}
											</p>

											<div
												className="flex items-center justify-between"
												style={{
													borderTop: "1px solid rgba(255,255,255,0.03)",
													paddingTop: "6px",
												}}
											>
												<span className="text-[8px] tracking-[0.18em] text-zinc-700 truncate">
													{inc.loc}
												</span>
												{inc.peerId === myPeerId ? (
													<button
														className="text-[8px] tracking-[0.22em] px-2 py-1 transition-all duration-150"
														onClick={(e) => {
															e.stopPropagation();
															handleResolve(inc.id);
														}}
														style={{
															border: "1px solid rgba(34,197,94,0.3)",
															color: "rgba(34,197,94,0.8)",
															background: "rgba(34,197,94,0.05)",
														}}
													>
														RESOLVE
													</button>
												) : (
													<span
														className="text-[8px] tracking-[0.18em]"
														style={{ color: cfg.color + "70" }}
													>
														OP: {inc.peerId}
													</span>
												)}
											</div>
										</div>

										{/* Hover overlay */}
										<div
											className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-[10px] tracking-[0.3em]"
											style={{
												background: "rgba(4,1,1,0.88)",
												backdropFilter: "blur(2px)",
												color: cfg.color,
											}}
										>
											OPEN SECURE ROOM →
										</div>
									</div>
								);
							})}
						</div>
					</div>

					{/* Right: map or chat */}
					<div className="relative flex flex-1 flex-col overflow-hidden">
						{activeIncidentId ? (
							<div className="flex h-full flex-col bg-[#020101]">
								{/* Chat header */}
								<div
									className="flex items-center justify-between px-4 py-3"
									style={{
										background: "rgba(220,38,38,0.04)",
										borderBottom: "1px solid rgba(220,38,38,0.12)",
									}}
								>
									<div>
										<div className="flex items-center gap-2 mb-0.5">
											<span
												className="h-1.5 w-1.5 rounded-full bg-green-400"
												style={{ boxShadow: "0 0 6px rgba(34,197,94,0.8)" }}
											/>
											<span className="text-[10px] tracking-[0.3em] text-red-500">
												INCIDENT ROOM SECURED
											</span>
										</div>
										<div className="text-[9px] tracking-[0.2em] text-zinc-700">
											{activeIncDetail?.loc ?? "COORD: UNKNOWN"}
										</div>
									</div>
									<button
										className="px-3 py-1 text-[9px] tracking-[0.25em] text-zinc-600 hover:text-zinc-400 transition-colors"
										onClick={() => setActiveIncidentId(null)}
										style={{ border: "1px solid rgba(255,255,255,0.05)" }}
									>
										CLOSE [X]
									</button>
								</div>

								{/* Messages */}
								<div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
									{(chatLogs[activeIncidentId] || []).length === 0 ? (
										<div className="flex h-24 items-center justify-center">
											<span className="text-[10px] tracking-[0.3em] text-zinc-800">
												ROOM ACTIVE. AWAITING TRANSMISSIONS...
											</span>
										</div>
									) : (
										(chatLogs[activeIncidentId] || []).map((msg, idx) => {
											const isMe = msg.from === myPeerId;
											return (
												<div
													className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
													key={idx}
												>
													<span
														className={`mb-1 text-[8px] tracking-[0.22em] ${isMe ? "text-zinc-600" : "text-red-700"}`}
													>
														{msg.from} [
														{new Date(msg.time).toLocaleTimeString()}]
													</span>
													<div
														className="max-w-[80%] px-3 py-2"
														style={{
															border: isMe
																? "1px solid rgba(255,255,255,0.07)"
																: "1px solid rgba(220,38,38,0.2)",
															background: isMe
																? "rgba(255,255,255,0.03)"
																: "rgba(220,38,38,0.05)",
														}}
													>
														{msg.text && (
															<p className="text-[11px] leading-relaxed text-zinc-300">
																{msg.text}
															</p>
														)}
														{msg.img && (
															<img
																alt="Attachment"
																className="mt-2 h-auto max-w-full"
																src={msg.img}
																style={{
																	border: "1px solid rgba(255,255,255,0.06)",
																}}
															/>
														)}
													</div>
												</div>
											);
										})
									)}
									<div ref={chatBottomRef} />
								</div>

								{/* Input */}
								<div
									className="px-3 pb-3 pt-2 flex flex-col gap-2"
									style={{ borderTop: "1px solid rgba(220,38,38,0.1)" }}
								>
									{attachedImage && (
										<div
											className="relative inline-block self-start p-1"
											style={{ border: "1px solid rgba(255,255,255,0.07)" }}
										>
											<img
												alt="Preview"
												className="h-14 w-auto opacity-60"
												src={attachedImage}
											/>
											<button
												className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-700 text-[9px] text-black font-bold"
												onClick={() => setAttachedImage(null)}
											>
												×
											</button>
										</div>
									)}
									<form className="flex gap-2" onSubmit={handleSendMessage}>
										<input
											accept="image/*"
											className="hidden"
											onChange={handleImageUpload}
											ref={fileInputRef}
											type="file"
										/>
										<button
											className="px-3 py-2 text-[9px] tracking-[0.2em] text-zinc-600 hover:text-zinc-400 transition-colors"
											onClick={() => fileInputRef.current?.click()}
											style={{ border: "1px solid rgba(255,255,255,0.05)" }}
											type="button"
										>
											[IMG]
										</button>
										<input
											className="flex-1 bg-transparent px-3 py-2 text-[11px] text-green-400 outline-none placeholder:text-zinc-800 transition-all duration-150"
											onBlur={(e) => {
												e.currentTarget.style.borderColor =
													"rgba(255,255,255,0.06)";
											}}
											onChange={(e) => setChatInput(e.target.value)}
											onFocus={(e) => {
												e.currentTarget.style.borderColor =
													"rgba(34,197,94,0.3)";
											}}
											placeholder="BROADCAST TO ROOM..."
											style={{ border: "1px solid rgba(255,255,255,0.06)" }}
											type="text"
											value={chatInput}
										/>
										<button
											className="px-5 py-2 text-[10px] tracking-[0.28em] transition-all duration-150 disabled:opacity-30"
											disabled={!chatInput.trim() && !attachedImage}
											style={{
												border: "1px solid rgba(34,197,94,0.35)",
												color: "rgba(34,197,94,0.9)",
												background: "rgba(34,197,94,0.05)",
											}}
											type="submit"
										>
											SEND
										</button>
									</form>
								</div>
							</div>
						) : (
							/* Map */
							<div className="relative h-full w-full cursor-crosshair">
								<MapGL
									attributionControl={false}
									initialViewState={{
										longitude: -0.1278,
										latitude: 51.5074,
										zoom: 11.5,
										pitch: 45,
									}}
									interactive
									mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
									onClick={(e) =>
										setSelectedLocation({
											lat: e.lngLat.lat,
											lng: e.lngLat.lng,
										})
									}
								>
									{activeFeed.map((inc) => {
										const cfg = TYPE_CFG[inc.type] ?? TYPE_CFG.REQUEST!;
										return (
											<Marker
												anchor="center"
												key={inc.id}
												latitude={inc.lat}
												longitude={inc.lng}
											>
												<div
													className="relative flex h-7 w-7 cursor-pointer items-center justify-center"
													onClick={(e) => {
														e.stopPropagation();
														setActiveIncidentId(inc.id);
													}}
												>
													<span
														className="absolute inline-flex h-full w-full rounded-full"
														style={{
															background: cfg.color,
															opacity: 0.2,
															animation: "ub-ping 2s infinite",
														}}
													/>
													<div
														className="relative z-10 h-3 w-3 rotate-45"
														style={{
															background: cfg.color,
															border: "1px solid rgba(0,0,0,0.5)",
															boxShadow: `0 0 8px ${cfg.glow}`,
															transform:
																activeIncidentId === inc.id
																	? "rotate(45deg) scale(1.5)"
																	: "rotate(45deg)",
														}}
													/>
												</div>
											</Marker>
										);
									})}
									{selectedLocation && (
										<Marker
											anchor="center"
											latitude={selectedLocation.lat}
											longitude={selectedLocation.lng}
										>
											<div className="relative flex h-7 w-7 items-center justify-center">
												<span
													className="absolute h-full w-full rounded-full bg-green-500 opacity-30"
													style={{ animation: "ub-ping 1.5s infinite" }}
												/>
												<div
													className="relative z-10 h-3 w-3 rounded-full bg-green-400"
													style={{
														boxShadow: "0 0 8px rgba(34,197,94,0.8)",
														border: "1px solid rgba(0,0,0,0.5)",
													}}
												/>
											</div>
											<div
												className="absolute top-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 text-[8px] tracking-[0.2em] text-green-500"
												style={{
													border: "1px solid rgba(34,197,94,0.3)",
													background: "rgba(0,0,0,0.9)",
												}}
											>
												TARGET_LOCKED
											</div>
										</Marker>
									)}
								</MapGL>

								{/* Map HUD */}
								<div
									className="pointer-events-none absolute top-3 left-3 z-10 px-3 py-2"
									style={{
										background: "rgba(4,1,1,0.92)",
										border: "1px solid rgba(220,38,38,0.2)",
										boxShadow: "0 0 12px rgba(0,0,0,0.6)",
									}}
								>
									<div className="text-[9px] tracking-[0.3em] text-red-700 mb-0.5">
										SAT_UPLINK: SECURE
									</div>
									<div className="text-[9px] tracking-[0.22em] text-zinc-600">
										INCIDENTS: {activeFeed.length}
									</div>
								</div>

								{!selectedLocation && (
									<div
										className="pointer-events-none absolute top-3 right-3 z-10 px-3 py-2"
										style={{
											background: "rgba(234,179,8,0.05)",
											border: "1px solid rgba(234,179,8,0.25)",
											animation: "ub-flicker 2.5s ease-in-out infinite",
										}}
									>
										<span className="text-[9px] tracking-[0.28em] text-yellow-600">
											CLICK MAP TO SET COORD
										</span>
									</div>
								)}

								{/* Scanlines */}
								<div
									className="pointer-events-none absolute inset-0"
									style={{
										backgroundImage:
											"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.07) 3px,rgba(0,0,0,0.07) 4px)",
										mixBlendMode: "multiply",
									}}
								/>
							</div>
						)}
					</div>
				</div>
			</div>
		</>
	);
}
