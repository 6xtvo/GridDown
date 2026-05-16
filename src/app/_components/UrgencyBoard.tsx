"use client";

import { useEffect, useRef, useState } from "react";
import MapGL, { Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { api } from "@/trpc/react";

const BASE_LOCATION = { lat: 51.5007, lng: -0.1246 };

export interface IncidentData {
	id: string;
	type: string; // "REQUEST" | "OFFER" | "ANNOUNCEMENT"
	priority: string;
	time: string;
	msg: string;
	lat: number;
	lng: number;
	loc: string;
	peerId: string;
}

export function UrgencyBoard() {
	const [isMounted, setIsMounted] = useState(false);
	const [myPeerId, setMyPeerId] = useState<string>("CONNECTING...");

	// Network State
	const [myIncidents, setMyIncidents] = useState<
		Omit<IncidentData, "peerId">[]
	>([]);
	const [incomingComms, setIncomingComms] = useState<{
		from: string;
		incidentId: string;
		msg: string;
	} | null>(null);

	// Chat State - Now keyed by Incident ID instead of Peer ID!
	const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
	const [chatLogs, setChatLogs] = useState<
		Record<string, { from: string; text: string; img?: string; time: number }[]>
	>({});
	const [chatInput, setChatInput] = useState("");
	const [attachedImage, setAttachedImage] = useState<string | null>(null);

	const chatBottomRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Form State
	const [newType, setNewType] = useState("REQUEST");
	const [newPriority, setNewPriority] = useState("MED");
	const [newMsg, setNewMsg] = useState("");
	const [selectedLocation, setSelectedLocation] = useState<{
		lat: number;
		lng: number;
	} | null>(null);

	// P2P TRPC Hooks
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

	// --- 1. INITIALIZATION & STORAGE ---
	useEffect(() => {
		setIsMounted(true);

		let storedId = localStorage.getItem("operator_id");
		if (!storedId) {
			storedId = `OP-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
			localStorage.setItem("operator_id", storedId);
		}
		setMyPeerId(storedId);

		const savedIncidents = localStorage.getItem("griddown_my_incidents");
		if (savedIncidents) setMyIncidents(JSON.parse(savedIncidents));

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

	// --- 2. HEARTBEAT ---
	useEffect(() => {
		if (!isMounted || myPeerId === "CONNECTING...") return;
		const syncData = () => {
			register.mutate({
				peerId: myPeerId,
				ip: "client",
				metadata: { incidents: myIncidents },
			});
		};
		syncData();
		const heartbeat = setInterval(syncData, 5000);
		return () => clearInterval(heartbeat);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [myPeerId, myIncidents]);

	useEffect(() => {
		chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [chatLogs, activeIncidentId]);

	// --- 3. MESSAGE PROCESSING (GROUP CHAT UPDATE) ---
	useEffect(() => {
		if (interceptedMessages && interceptedMessages.length > 0) {
			setChatLogs((prev) => {
				const updated = { ...prev };
				let hasNew = false;

				interceptedMessages.forEach((m) => {
					try {
						const parsed = JSON.parse(String(m.data));
						// Only process if it's an INCIDENT_CHAT
						if (parsed.type === "INCIDENT_CHAT") {
							const roomId = parsed.data.incidentId;
							if (!updated[roomId]) updated[roomId] = [];

							const exists = updated[roomId].some(
								(msg) => msg.time === m.timestamp,
							);
							if (!exists) {
								updated[roomId].push({
									from: m.from,
									text: parsed.data.text,
									img: parsed.data.img,
									time: m.timestamp,
								});
								hasNew = true;
							}
						}
					} catch (e) {
						console.error("Failed to parse incoming payload");
					}
				});
				return hasNew ? updated : prev;
			});

			// Trigger comms alert if message is for a different incident room
			const latest = interceptedMessages[interceptedMessages.length - 1];
			if (latest) {
				try {
					const parsed = JSON.parse(String(latest.data));
					if (
						parsed.type === "INCIDENT_CHAT" &&
						parsed.data.incidentId !== activeIncidentId
					) {
						setIncomingComms({
							from: latest.from,
							incidentId: parsed.data.incidentId,
							msg: "NEW COMMS IN INCIDENT ROOM",
						});
					}
				} catch (e) {}
			}
		}
	}, [interceptedMessages, activeIncidentId]);

	// --- 4. FEED DEDUPLICATION & SORTING ---
	const getActiveFeed = () => {
		const otherIncidents: IncidentData[] =
			peers
				?.filter((p) => p.peerId !== myPeerId)
				?.flatMap((p) => {
					const peerIncidents =
						(p.metadata?.incidents as Omit<IncidentData, "peerId">[]) || [];
					return peerIncidents.map((inc) => ({ ...inc, peerId: p.peerId }));
				}) || [];

		const myMappedIncidents: IncidentData[] = myIncidents.map((inc) => ({
			...inc,
			peerId: myPeerId,
		}));
		const combined = [...myMappedIncidents, ...otherIncidents];

		// 1. Deduplicate by Incident ID to eliminate ghosts
		const uniqueFeed = Array.from(
			new Map(combined.map((item) => [item.id, item])).values(),
		);

		// 2. Sort by Recent (Newest First)
		uniqueFeed.sort((a, b) => b.time.localeCompare(a.time));

		return uniqueFeed;
	};

	const activeFeed = getActiveFeed();
	const activeIncDetail = activeFeed.find((inc) => inc.id === activeIncidentId);

	// --- INCIDENT HANDLERS ---
	const handleReport = (e: React.FormEvent) => {
		e.preventDefault();
		if (!newMsg.trim() || !selectedLocation) return;

		const newInc = {
			id: Math.random().toString(36).substr(2, 9),
			type: newType,
			priority: newType === "OFFER" ? "LOW" : newPriority,
			time: new Date().toLocaleTimeString(),
			msg: newMsg,
			lat: selectedLocation.lat,
			lng: selectedLocation.lng,
			loc: `COORD: [${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}]`,
		};

		setMyIncidents((prev) => [newInc, ...prev]);
		setNewMsg("");
		setSelectedLocation(null);
	};

	const handleResolve = (id: string) => {
		setMyIncidents((prev) => prev.filter((inc) => inc.id !== id));
		if (activeIncidentId === id) setActiveIncidentId(null);
	};

	// --- CHAT LOGIC ---
	const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onloadend = () => setAttachedImage(reader.result as string);
			reader.readAsDataURL(file);
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

		// Optimistic UI update
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

		// Broadcast message to ALL connected peers, so anyone watching the room gets it
		if (peers) {
			const otherPeers = peers.filter((p) => p.peerId !== myPeerId);
			await Promise.all(
				otherPeers.map((peer) =>
					sendMessage.mutateAsync({
						from: myPeerId,
						to: peer.peerId,
						type: "DIRECT_MESSAGE",
						data: payload,
					}),
				),
			);
		}

		setChatInput("");
		setAttachedImage(null);
	};

	// Styling Helpers
	const getTypeColor = (type: string) => {
		if (type === "OFFER") return "bg-blue-500 text-blue-500 border-blue-500";
		if (type === "ANNOUNCEMENT")
			return "bg-emerald-500 text-emerald-500 border-emerald-500";
		return "bg-red-600 text-red-500 border-red-600";
	};

	if (!isMounted)
		return (
			<div className="p-8 font-seven text-red-500">
				INITIALIZING SECURE CHANNEL...
			</div>
		);

	return (
		<div className="flex flex-col border-2 border-red-600 bg-black text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]">
			<div className="flex items-center justify-between bg-red-600 px-4 py-2 font-seven text-2xl text-black tracking-wider">
				<span>LIVE URGENCY BOARD // VOL. 04</span>
				<div className="flex items-center gap-4 font-bold text-sm">
					<span>OPERATOR: {myPeerId}</span>
					<span className="animate-pulse">● LIVE NETWORK</span>
				</div>
			</div>

			{incomingComms && (
				<div className="flex items-center justify-between border-red-500 border-b-2 bg-red-950/80 p-4 font-seven text-white">
					<div>
						<span className="animate-pulse text-yellow-400">
							INCOMING TRANSMISSION INTERCEPTED
						</span>
						<br />
						<span className="text-sm">
							FROM: {incomingComms.from} // "{incomingComms.msg}"
						</span>
					</div>
					<button
						className="border-2 border-yellow-400 px-4 py-2 text-yellow-400 tracking-widest transition hover:bg-yellow-400 hover:text-black"
						onClick={() => {
							setActiveIncidentId(incomingComms.incidentId);
							setIncomingComms(null);
						}}
					>
						OPEN SECURE ROOM
					</button>
				</div>
			)}

			<div className="flex h-150 flex-col lg:flex-row">
				<div className="flex flex-1 flex-col border-red-600 border-r-2 bg-zinc-950">
					<form
						className="border-red-600 border-b bg-zinc-900 p-4"
						onSubmit={handleReport}
					>
						<div className="mb-2 flex items-center justify-between font-seven text-red-500">
							<span>BROADCAST INTEL</span>
							{!selectedLocation ? (
								<span className="animate-pulse text-sm text-yellow-500 tracking-widest">
									AWAITING MAP SELECTION...
								</span>
							) : (
								<span className="text-green-500 text-sm tracking-widest">
									TARGET LOCKED
								</span>
							)}
						</div>

						<div className="flex flex-col gap-2">
							<input
								className="border border-zinc-700 bg-black p-2 font-jetbrains text-sm text-white outline-none focus:border-red-500"
								onChange={(e) => setNewMsg(e.target.value)}
								placeholder="Situation description..."
								value={newMsg}
							/>
							<div className="flex gap-2">
								<select
									className="flex-1 border border-zinc-700 bg-black p-2 font-seven text-red-400 outline-none focus:border-red-500"
									onChange={(e) => setNewType(e.target.value)}
									value={newType}
								>
									<option value="REQUEST">TYPE: REQUEST</option>
									<option value="OFFER">TYPE: OFFER</option>
									<option value="ANNOUNCEMENT">TYPE: ANNOUNCEMENT</option>
								</select>

								<select
									className={`border bg-black p-2 font-seven outline-none transition-opacity ${newType === "OFFER" ? "cursor-not-allowed border-zinc-800 text-zinc-600 opacity-50" : "border-zinc-700 text-red-400 focus:border-red-500"}`}
									disabled={newType === "OFFER"}
									onChange={(e) => setNewPriority(e.target.value)}
									value={newType === "OFFER" ? "LOW" : newPriority}
								>
									<option value="HIGH">PRIORITY: HIGH</option>
									<option value="MED">PRIORITY: MED</option>
									<option value="LOW">PRIORITY: LOW</option>
								</select>

								<button
									className="border border-red-600 bg-red-600/20 px-4 font-seven text-red-500 tracking-widest transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
									disabled={!selectedLocation || !newMsg.trim()}
									type="submit"
								>
									TRANSMIT
								</button>
							</div>
						</div>
					</form>

					<div className="flex-1 space-y-4 overflow-y-auto p-4">
						{activeFeed.length === 0 && (
							<div className="mt-10 text-center font-seven text-zinc-600 tracking-widest">
								NO ACTIVE INCIDENTS ON GRID
							</div>
						)}
						{activeFeed.map((inc) => {
							const colorClass = getTypeColor(inc.type);
							const bgClass = colorClass.split(" ")[0];
							const textClass = colorClass.split(" ")[1];

							return (
								<div
									className={`group relative cursor-pointer border border-zinc-800 bg-black p-3 transition-colors hover:border-zinc-600 ${activeIncidentId === inc.id ? "border-zinc-500 bg-zinc-900" : ""}`}
									key={inc.id}
									onClick={() => setActiveIncidentId(inc.id)}
								>
									<div
										className={`absolute top-0 bottom-0 left-0 w-1 ${bgClass}`}
									></div>

									<div className="flex justify-between font-seven text-xl tracking-wider">
										<div className="flex items-center gap-3">
											<span
												className={`ml-2 px-2 py-0.5 text-black text-xs ${bgClass}`}
											>
												{inc.type}
											</span>
											<span
												className={
													inc.priority === "HIGH"
														? "text-red-500"
														: inc.priority === "MED"
															? "text-yellow-500"
															: "text-zinc-500"
												}
											>
												PRIORITY {inc.type === "OFFER" ? "N/A" : inc.priority}
											</span>
										</div>
										<span className="text-zinc-500">{inc.time}</span>
									</div>

									<p className="mt-3 font-jetbrains text-sm text-zinc-300 leading-relaxed">
										{inc.msg}
									</p>

									<div className="mt-3 flex items-center justify-between border-zinc-800 border-t pt-2 font-seven text-xs tracking-widest">
										<span className="text-zinc-500">{inc.loc}</span>
										{inc.peerId === myPeerId ? (
											<button
												className="relative z-10 border border-green-600 bg-green-900/30 px-3 py-1 text-green-500 transition hover:bg-green-600 hover:text-black"
												onClick={(e) => {
													e.stopPropagation();
													handleResolve(inc.id);
												}}
											>
												MARK RESOLVED
											</button>
										) : (
											<span className={`${textClass} opacity-80`}>
												OP: {inc.peerId}
											</span>
										)}
									</div>

									{/* Now ANYONE can join any room! */}
									<div className="absolute inset-0 hidden items-center justify-center bg-zinc-900/90 font-seven text-white text-xl tracking-widest backdrop-blur-sm group-hover:flex">
										CLICK TO OPEN SECURE ROOM
									</div>
								</div>
							);
						})}
					</div>
				</div>

				<div className="relative flex flex-1 flex-col overflow-hidden bg-black">
					{activeIncidentId ? (
						<div className="relative z-10 flex h-full flex-col bg-zinc-950">
							<div className="flex items-center justify-between border-red-600 border-b bg-zinc-900 p-3 font-seven tracking-widest">
								<div>
									<span className="text-red-500">INCIDENT ROOM SECURED</span>
									<div className="mt-1 text-xs text-zinc-500">
										LOC:{" "}
										{activeIncDetail ? activeIncDetail.loc : "UNKNOWN COORD"}
									</div>
								</div>
								<div className="flex items-center gap-4">
									<span className="animate-pulse text-green-500 text-sm">
										LIVE
									</span>
									<button
										className="border border-zinc-700 px-2 py-1 text-xs text-zinc-500 hover:text-white"
										onClick={() => setActiveIncidentId(null)}
									>
										CLOSE [X]
									</button>
								</div>
							</div>

							<div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 font-jetbrains text-sm">
								{(chatLogs[activeIncidentId] || []).length === 0 ? (
									<div className="font-seven text-zinc-600 italic tracking-widest">
										ROOM CREATED. AWAITING TRANSMISSIONS...
									</div>
								) : (
									(chatLogs[activeIncidentId] || []).map((msg, idx) => (
										<div
											className={`${msg.from === myPeerId ? "self-end text-right" : "self-start text-left"} max-w-[80%]`}
											key={idx}
										>
											<span
												className={`mb-1 block font-seven text-[10px] tracking-widest ${msg.from === myPeerId ? "text-zinc-500" : "text-red-500"}`}
											>
												{msg.from} [{new Date(msg.time).toLocaleTimeString()}]
											</span>
											<div
												className={`inline-block border p-3 ${msg.from === myPeerId ? "border-zinc-700 bg-zinc-900 text-zinc-300" : "border-red-900 bg-red-950/30 text-red-200"}`}
											>
												{msg.text && <p>{msg.text}</p>}
												{msg.img && (
													<img
														alt="Attachment"
														className="mt-2 h-auto max-w-full rounded-sm border border-zinc-800"
														src={msg.img}
													/>
												)}
											</div>
										</div>
									))
								)}
								<div ref={chatBottomRef} />
							</div>

							<div className="flex flex-col gap-2 border-red-900 border-t bg-black p-3">
								{attachedImage && (
									<div className="relative inline-block self-start border border-zinc-700 bg-zinc-900 p-1">
										<img
											alt="Preview"
											className="h-16 w-auto opacity-70"
											src={attachedImage}
										/>
										<button
											className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 font-bold text-black text-xs"
											onClick={() => setAttachedImage(null)}
										>
											X
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
										className="border border-zinc-700 bg-zinc-900 px-3 py-2 font-seven text-zinc-400 tracking-widest hover:text-white"
										onClick={() => fileInputRef.current?.click()}
										type="button"
									>
										[ATTACH]
									</button>
									<input
										className="flex-1 border border-zinc-700 bg-zinc-900 px-4 py-2 font-jetbrains text-green-500 outline-none focus:border-green-500"
										onChange={(e) => setChatInput(e.target.value)}
										placeholder="BROADCAST TO ROOM..."
										type="text"
										value={chatInput}
									/>
									<button
										className="border border-green-600 bg-green-900/20 px-6 py-2 font-seven text-green-500 tracking-widest transition hover:bg-green-600 hover:text-black disabled:opacity-50"
										disabled={!chatInput.trim() && !attachedImage}
										type="submit"
									>
										SEND
									</button>
								</form>
							</div>
						</div>
					) : (
						<div className="relative h-full w-full cursor-crosshair">
							<MapGL
								attributionControl={false}
								initialViewState={{
									longitude: -0.1278,
									latitude: 51.5074,
									zoom: 11.5,
									pitch: 45,
								}}
								interactive={true}
								mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
								onClick={(e) =>
									setSelectedLocation({ lat: e.lngLat.lat, lng: e.lngLat.lng })
								}
							>
								{activeFeed.map((inc) => {
									const bgClass = getTypeColor(inc.type).split(" ")[0];
									return (
										<Marker
											anchor="center"
											key={inc.id}
											latitude={inc.lat}
											longitude={inc.lng}
										>
											<div
												className="group relative flex h-8 w-8 cursor-pointer items-center justify-center"
												onClick={(e) => {
													e.stopPropagation();
													setActiveIncidentId(inc.id);
												}}
											>
												<span
													className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-30 ${bgClass}`}
												></span>
												<div
													className={`relative z-10 h-3 w-3 rotate-45 transform border border-black ${bgClass} ${activeIncidentId === inc.id ? "scale-150 border-white" : ""}`}
												></div>
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
										<div className="relative flex h-8 w-8 items-center justify-center">
											<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60"></span>
											<div className="relative z-10 flex h-4 w-4 items-center justify-center rounded-full border-2 border-green-500 bg-transparent">
												<div className="h-1 w-1 rounded-full bg-green-500"></div>
											</div>
										</div>
										<div className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap border border-green-500 bg-green-950/80 px-1 font-seven text-[10px] text-green-500">
											TARGET_LOCKED
										</div>
									</Marker>
								)}
							</MapGL>

							<div className="pointer-events-none absolute top-4 left-4 z-10 border border-red-600 bg-black/80 p-2 font-seven text-red-500 text-sm tracking-widest">
								SAT_UPLINK: SECURE
								<br />
								ACTIVE INCIDENTS: {activeFeed.length}
							</div>

							{!selectedLocation && (
								<div className="pointer-events-none absolute top-4 right-4 z-10 animate-pulse border border-yellow-500 bg-yellow-900/80 p-2 font-seven text-sm text-yellow-500 tracking-widest">
									CLICK MAP TO DESIGNATE COORD
								</div>
							)}

							<div className="pointer-events-none absolute inset-0 bg-size-[100%_4px,3px_100%] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] opacity-40"></div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
