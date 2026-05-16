"use client";

import { useState, useEffect, useRef } from "react";
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
	const [myIncidents, setMyIncidents] = useState<Omit<IncidentData, "peerId">[]>([]);
	const [incomingComms, setIncomingComms] = useState<{from: string, incidentId: string, msg: string} | null>(null);

	// Chat State - Now keyed by Incident ID instead of Peer ID!
	const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
	const [chatLogs, setChatLogs] = useState<Record<string, { from: string; text: string; img?: string; time: number }[]>>({});
	const [chatInput, setChatInput] = useState("");
	const [attachedImage, setAttachedImage] = useState<string | null>(null);
	
	const chatBottomRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Form State
	const [newType, setNewType] = useState("REQUEST");
	const [newPriority, setNewPriority] = useState("MED");
	const [newMsg, setNewMsg] = useState("");
	const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number} | null>(null);

	// P2P TRPC Hooks
	const register = api.p2p.register.useMutation();
	const sendMessage = api.p2p.sendMessage.useMutation();
	const { data: peers } = api.p2p.listPeers.useQuery(undefined, {
		refetchInterval: 3000,
		enabled: isMounted,
	});

	const { data: interceptedMessages } = api.p2p.getMessages.useQuery(
		{ peerId: myPeerId },
		{ refetchInterval: 2000, enabled: isMounted && myPeerId !== "CONNECTING..." }
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
		if (isMounted) localStorage.setItem("griddown_chat_logs", JSON.stringify(chatLogs));
	}, [chatLogs, isMounted]);

	useEffect(() => {
		if (isMounted) localStorage.setItem("griddown_my_incidents", JSON.stringify(myIncidents));
	}, [myIncidents, isMounted]);

	// --- 2. HEARTBEAT ---
	useEffect(() => {
		if (!isMounted || myPeerId === "CONNECTING...") return;
		const syncData = () => {
			register.mutate({
				peerId: myPeerId,
				ip: "client",
				metadata: { incidents: myIncidents }
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
							
							const exists = updated[roomId].some(msg => msg.time === m.timestamp);
							if (!exists) {
								updated[roomId].push({
									from: m.from,
									text: parsed.data.text,
									img: parsed.data.img,
									time: m.timestamp
								});
								hasNew = true;
							}
						}
					} catch(e) {
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
					if (parsed.type === "INCIDENT_CHAT" && parsed.data.incidentId !== activeIncidentId) {
						setIncomingComms({ 
							from: latest.from, 
							incidentId: parsed.data.incidentId, 
							msg: "NEW COMMS IN INCIDENT ROOM" 
						});
					}
				} catch(e) {}
			}
		}
	}, [interceptedMessages, activeIncidentId]);


	// --- 4. FEED DEDUPLICATION ---
	const getActiveFeed = () => {
		const otherIncidents: IncidentData[] = peers
			?.filter(p => p.peerId !== myPeerId)
			?.flatMap((p) => {
				const peerIncidents = (p.metadata?.incidents as Omit<IncidentData, "peerId">[]) || [];
				return peerIncidents.map((inc) => ({ ...inc, peerId: p.peerId }));
			}) || [];

		const myMappedIncidents: IncidentData[] = myIncidents.map(inc => ({ ...inc, peerId: myPeerId }));
		const combined = [...myMappedIncidents, ...otherIncidents];
		return Array.from(new Map(combined.map(item => [item.id, item])).values());
	};

	const activeFeed = getActiveFeed();
	const activeIncDetail = activeFeed.find(inc => inc.id === activeIncidentId);

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
			data: { incidentId: activeIncidentId, text: chatInput, img: attachedImage } 
		});

		// Optimistic UI update
		setChatLogs((prev) => ({
			...prev,
			[activeIncidentId]: [...(prev[activeIncidentId] || []), { from: myPeerId, text: chatInput, img: attachedImage || undefined, time: Date.now() }]
		}));

		// Broadcast message to ALL connected peers, so anyone watching the room gets it
		if (peers) {
			const otherPeers = peers.filter(p => p.peerId !== myPeerId);
			await Promise.all(
				otherPeers.map(peer => 
					sendMessage.mutateAsync({
						from: myPeerId,
						to: peer.peerId,
						type: "DIRECT_MESSAGE", 
						data: payload
					})
				)
			);
		}

		setChatInput("");
		setAttachedImage(null);
	};

	// Styling Helpers
	const getTypeColor = (type: string) => {
		if (type === "OFFER") return "bg-blue-500 text-blue-500 border-blue-500";
		if (type === "ANNOUNCEMENT") return "bg-emerald-500 text-emerald-500 border-emerald-500";
		return "bg-red-600 text-red-500 border-red-600";
	};

	if (!isMounted) return <div className="p-8 text-red-500 font-seven">INITIALIZING SECURE CHANNEL...</div>;

	return (
		<div className="flex flex-col border-2 border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.3)] bg-black text-white">
			
			<div className="flex items-center justify-between bg-red-600 px-4 py-2 font-seven text-2xl tracking-wider text-black">
				<span>LIVE URGENCY BOARD // VOL. 04</span>
				<div className="flex items-center gap-4 text-sm font-bold">
					<span>OPERATOR: {myPeerId}</span>
					<span className="animate-pulse">● LIVE NETWORK</span>
				</div>
			</div>

			{incomingComms && (
				<div className="bg-red-950/80 text-white p-4 font-seven flex justify-between items-center border-b-2 border-red-500">
					<div>
						<span className="text-yellow-400 animate-pulse">INCOMING TRANSMISSION INTERCEPTED</span>
						<br />
						<span className="text-sm">FROM: {incomingComms.from} // "{incomingComms.msg}"</span>
					</div>
					<button 
						onClick={() => {
							setActiveIncidentId(incomingComms.incidentId);
							setIncomingComms(null);
						}}
						className="border-2 border-yellow-400 text-yellow-400 px-4 py-2 hover:bg-yellow-400 hover:text-black transition tracking-widest"
					>
						OPEN SECURE ROOM
					</button>
				</div>
			)}

			<div className="flex h-[600px] flex-col lg:flex-row">
				<div className="flex-1 flex flex-col border-r-2 border-red-600 bg-zinc-950">
					<form onSubmit={handleReport} className="p-4 border-b border-red-600 bg-zinc-900">
						<div className="font-seven text-red-500 mb-2 flex justify-between items-center">
							<span>BROADCAST INTEL</span>
							{!selectedLocation ? (
								<span className="text-yellow-500 text-sm animate-pulse tracking-widest">AWAITING MAP SELECTION...</span>
							) : (
								<span className="text-green-500 text-sm tracking-widest">TARGET LOCKED</span>
							)}
						</div>
						
						<div className="flex flex-col gap-2">
							<input
								className="bg-black border border-zinc-700 text-white p-2 font-jetbrains text-sm outline-none focus:border-red-500"
								placeholder="Situation description..."
								value={newMsg}
								onChange={(e) => setNewMsg(e.target.value)}
							/>
							<div className="flex gap-2">
								<select 
									className="bg-black border border-zinc-700 text-red-400 p-2 font-seven flex-1 outline-none focus:border-red-500"
									value={newType}
									onChange={(e) => setNewType(e.target.value)}
								>
									<option value="REQUEST">TYPE: REQUEST</option>
									<option value="OFFER">TYPE: OFFER</option>
									<option value="ANNOUNCEMENT">TYPE: ANNOUNCEMENT</option>
								</select>
								
								<select 
									className={`bg-black border p-2 font-seven outline-none transition-opacity ${newType === "OFFER" ? "border-zinc-800 text-zinc-600 opacity-50 cursor-not-allowed" : "border-zinc-700 text-red-400 focus:border-red-500"}`}
									value={newType === "OFFER" ? "LOW" : newPriority}
									onChange={(e) => setNewPriority(e.target.value)}
									disabled={newType === "OFFER"}
								>
									<option value="HIGH">PRIORITY: HIGH</option>
									<option value="MED">PRIORITY: MED</option>
									<option value="LOW">PRIORITY: LOW</option>
								</select>
								
								<button 
									type="submit" 
									disabled={!selectedLocation || !newMsg.trim()}
									className="bg-red-600/20 border border-red-600 text-red-500 px-4 tracking-widest hover:bg-red-600 hover:text-white font-seven transition disabled:opacity-50 disabled:cursor-not-allowed"
								>
									TRANSMIT
								</button>
							</div>
						</div>
					</form>

					<div className="flex-1 overflow-y-auto p-4 space-y-4">
						{activeFeed.length === 0 && (
							<div className="text-zinc-600 font-seven text-center mt-10 tracking-widest">NO ACTIVE INCIDENTS ON GRID</div>
						)}
						{activeFeed.map((inc) => {
							const colorClass = getTypeColor(inc.type);
							const bgClass = colorClass.split(' ')[0]; 
							const textClass = colorClass.split(' ')[1]; 
							
							return (
								<div 
									key={inc.id} 
									className={`border border-zinc-800 bg-black hover:border-zinc-600 p-3 transition-colors cursor-pointer relative group ${activeIncidentId === inc.id ? "bg-zinc-900 border-zinc-500" : ""}`}
									onClick={() => setActiveIncidentId(inc.id)}
								>
									<div className={`absolute left-0 top-0 bottom-0 w-1 ${bgClass}`}></div>

									<div className="flex justify-between font-seven text-xl tracking-wider">
										<div className="flex items-center gap-3">
											<span className={`ml-2 px-2 py-0.5 text-xs text-black ${bgClass}`}>
												{inc.type}
											</span>
											<span className={inc.priority === "HIGH" ? "text-red-500" : inc.priority === "MED" ? "text-yellow-500" : "text-zinc-500"}>
												PRIORITY {inc.type === "OFFER" ? "N/A" : inc.priority}
											</span>
										</div>
										<span className="text-zinc-500">{inc.time}</span>
									</div>
									
									<p className="text-zinc-300 font-jetbrains text-sm mt-3 leading-relaxed">{inc.msg}</p>
									
									<div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-2 font-seven text-xs tracking-widest">
										<span className="text-zinc-500">{inc.loc}</span>
										{inc.peerId === myPeerId ? (
											<button 
												onClick={(e) => { e.stopPropagation(); handleResolve(inc.id); }}
												className="bg-green-900/30 border border-green-600 text-green-500 px-3 py-1 hover:bg-green-600 hover:text-black transition z-10 relative"
											>
												MARK RESOLVED
											</button>
										) : (
											<span className={`${textClass} opacity-80`}>OP: {inc.peerId}</span>
										)}
									</div>
									
									{/* Now ANYONE can join any room! */}
									<div className="absolute inset-0 bg-zinc-900/90 hidden group-hover:flex items-center justify-center font-seven text-white text-xl tracking-widest backdrop-blur-sm">
										CLICK TO OPEN SECURE ROOM
									</div>
								</div>
							);
						})}
					</div>
				</div>

				<div className="relative flex-1 bg-black overflow-hidden flex flex-col">
					{activeIncidentId ? (
						<div className="flex flex-col h-full bg-zinc-950 relative z-10">
							<div className="flex justify-between items-center bg-zinc-900 border-b border-red-600 p-3 font-seven tracking-widest">
								<div>
									<span className="text-red-500">INCIDENT ROOM SECURED</span>
									<div className="text-xs text-zinc-500 mt-1">LOC: {activeIncDetail ? activeIncDetail.loc : "UNKNOWN COORD"}</div>
								</div>
								<div className="flex items-center gap-4">
									<span className="text-green-500 animate-pulse text-sm">LIVE</span>
									<button onClick={() => setActiveIncidentId(null)} className="text-zinc-500 hover:text-white text-xs border border-zinc-700 px-2 py-1">CLOSE [X]</button>
								</div>
							</div>
							
							<div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 font-jetbrains text-sm">
								{(chatLogs[activeIncidentId] || []).length === 0 ? (
									<div className="text-zinc-600 italic font-seven tracking-widest">ROOM CREATED. AWAITING TRANSMISSIONS...</div>
								) : (
									(chatLogs[activeIncidentId] || []).map((msg, idx) => (
										<div key={idx} className={`${msg.from === myPeerId ? "self-end text-right" : "self-start text-left"} max-w-[80%]`}>
											<span className={`text-[10px] block mb-1 font-seven tracking-widest ${msg.from === myPeerId ? "text-zinc-500" : "text-red-500"}`}>
												{msg.from} [{new Date(msg.time).toLocaleTimeString()}]
											</span>
											<div className={`inline-block p-3 border ${msg.from === myPeerId ? "bg-zinc-900 border-zinc-700 text-zinc-300" : "bg-red-950/30 border-red-900 text-red-200"}`}>
												{msg.text && <p>{msg.text}</p>}
												{msg.img && <img src={msg.img} alt="Attachment" className="mt-2 max-w-full h-auto border border-zinc-800 rounded-sm" />}
											</div>
										</div>
									))
								)}
								<div ref={chatBottomRef} />
							</div>

							<div className="p-3 border-t border-red-900 bg-black flex flex-col gap-2">
								{attachedImage && (
									<div className="relative inline-block self-start border border-zinc-700 p-1 bg-zinc-900">
										<img src={attachedImage} alt="Preview" className="h-16 w-auto opacity-70" />
										<button onClick={() => setAttachedImage(null)} className="absolute -top-2 -right-2 bg-red-600 text-black font-bold text-xs rounded-full w-5 h-5 flex items-center justify-center">X</button>
									</div>
								)}
								<form onSubmit={handleSendMessage} className="flex gap-2">
									<input 
										type="file" 
										accept="image/*" 
										className="hidden" 
										ref={fileInputRef} 
										onChange={handleImageUpload} 
									/>
									<button 
										type="button" 
										onClick={() => fileInputRef.current?.click()} 
										className="border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-400 hover:text-white font-seven tracking-widest"
									>
										[ATTACH]
									</button>
									<input
										type="text"
										value={chatInput}
										onChange={(e) => setChatInput(e.target.value)}
										placeholder="BROADCAST TO ROOM..."
										className="flex-1 border border-zinc-700 bg-zinc-900 px-4 py-2 text-green-500 outline-none focus:border-green-500 font-jetbrains"
									/>
									<button 
										type="submit" 
										disabled={!chatInput.trim() && !attachedImage} 
										className="border border-green-600 bg-green-900/20 px-6 py-2 text-green-500 transition hover:bg-green-600 hover:text-black disabled:opacity-50 font-seven tracking-widest"
									>
										SEND
									</button>
								</form>
							</div>
						</div>
					) : (
						<div className="w-full h-full cursor-crosshair relative">
							<MapGL
								initialViewState={{ longitude: -0.1278, latitude: 51.5074, zoom: 11.5, pitch: 45 }}
								mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
								attributionControl={false}
								interactive={true}
								onClick={(e) => setSelectedLocation({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
							>
								{activeFeed.map((inc) => {
									const bgClass = getTypeColor(inc.type).split(' ')[0];
									return (
										<Marker key={inc.id} longitude={inc.lng} latitude={inc.lat} anchor="center">
											<div 
												onClick={(e) => { e.stopPropagation(); setActiveIncidentId(inc.id); }}
												className="relative flex items-center justify-center w-8 h-8 cursor-pointer group"
											>
												<span className={`absolute inline-flex w-full h-full rounded-full opacity-30 animate-ping ${bgClass}`}></span>
												<div className={`relative z-10 w-3 h-3 border border-black transform rotate-45 ${bgClass} ${activeIncidentId === inc.id ? "scale-150 border-white" : ""}`}></div>
											</div>
										</Marker>
									)
								})}

								{selectedLocation && (
									<Marker longitude={selectedLocation.lng} latitude={selectedLocation.lat} anchor="center">
										<div className="relative flex items-center justify-center w-8 h-8">
											<span className="absolute inline-flex w-full h-full rounded-full bg-green-500 opacity-60 animate-ping"></span>
											<div className="relative z-10 w-4 h-4 rounded-full border-2 border-green-500 bg-transparent flex items-center justify-center">
												<div className="w-1 h-1 bg-green-500 rounded-full"></div>
											</div>
										</div>
										<div className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-green-950/80 border border-green-500 px-1 font-seven text-[10px] text-green-500">
											TARGET_LOCKED
										</div>
									</Marker>
								)}
							</MapGL>
							
							<div className="absolute top-4 left-4 bg-black/80 border border-red-600 p-2 font-seven text-sm tracking-widest text-red-500 pointer-events-none z-10">
								SAT_UPLINK: SECURE<br/>
								ACTIVE INCIDENTS: {activeFeed.length}
							</div>

							{!selectedLocation && (
								<div className="absolute top-4 right-4 bg-yellow-900/80 border border-yellow-500 p-2 font-seven text-sm tracking-widest text-yellow-500 pointer-events-none animate-pulse z-10">
									CLICK MAP TO DESIGNATE COORD
								</div>
							)}

							<div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-40"></div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}