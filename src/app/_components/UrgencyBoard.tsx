"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Map, { Marker, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { api } from "@/trpc/react";

// Pre-defined tactical locations for quick reporting
const LOCATIONS = [
	{ name: "Canary Wharf", lat: 51.5054, lng: -0.0235 },
	{ name: "Soho", lat: 51.5136, lng: -0.1365 },
	{ name: "The Shard", lat: 51.5045, lng: -0.0865 },
	{ name: "Hyde Park", lat: 51.5073, lng: -0.1657 },
	{ name: "King's Cross", lat: 51.5300, lng: -0.1236 }
];

const BASE_LOCATION = { lat: 51.5007, lng: -0.1246 };

export interface IncidentData {
	id: string;
	priority: string;
	time: string;
	msg: string;
	lat: number;
	lng: number;
	loc: string;
	peerId: string; // The poster's ID
}

export function UrgencyBoard() {
	const router = useRouter();
	const [isMounted, setIsMounted] = useState(false);
	const [myPeerId, setMyPeerId] = useState<string>("CONNECTING...");
	
	const [myIncidents, setMyIncidents] = useState<Omit<IncidentData, "peerId">[]>([]);
	const [incomingComms, setIncomingComms] = useState<{from: string, msg: string} | null>(null);

	// Form State
	const [newPriority, setNewPriority] = useState("MED");
	const [newMsg, setNewMsg] = useState("");
	const [newLocIndex, setNewLocIndex] = useState(0);

	// P2P TRPC Hooks
	const register = api.p2p.register.useMutation();
	const { data: peers } = api.p2p.listPeers.useQuery(undefined, {
		refetchInterval: 3000,
		enabled: isMounted,
	});

	// Poll for incoming messages in case someone is trying to contact us about an incident we posted
	const { data: interceptedMessages } = api.p2p.getMessages.useQuery(
		{ peerId: myPeerId },
		{ refetchInterval: 2000, enabled: isMounted && myPeerId !== "CONNECTING..." }
	);

	useEffect(() => {
		setIsMounted(true);
		// Persist ID across navigations
		let storedId = sessionStorage.getItem("operator_id");
		if (!storedId) {
			storedId = `OP-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
			sessionStorage.setItem("operator_id", storedId);
		}
		setMyPeerId(storedId);
	}, []);

	// Auto-Register and sync incidents into the network via metadata
	useEffect(() => {
		if (!isMounted || myPeerId === "CONNECTING...") return;
		register.mutate({
			peerId: myPeerId,
			ip: "client",
			metadata: { incidents: myIncidents }
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [myPeerId, myIncidents]);

	// Listen for someone opening a comm channel with us
	useEffect(() => {
		if (interceptedMessages && interceptedMessages.length > 0) {
			const latest = interceptedMessages[interceptedMessages.length - 1];
			if (latest) {
				setIncomingComms({ from: latest.from, msg: String(latest.data) });
			}
		}
	}, [interceptedMessages]);

	// Extract all incidents from all connected peers
	const globalIncidents: IncidentData[] = peers?.flatMap((p) => {
		const peerIncidents = (p.metadata?.incidents as Omit<IncidentData, "peerId">[]) || [];
		return peerIncidents.map((inc) => ({ ...inc, peerId: p.peerId }));
	}) || [];

	const handleReport = (e: React.FormEvent) => {
		e.preventDefault();
		if (!newMsg.trim()) return;

		const selectedLoc = LOCATIONS[newLocIndex];
		const newInc = {
			id: Math.random().toString(36).substr(2, 9),
			priority: newPriority,
			time: new Date().toLocaleTimeString(),
			msg: newMsg,
			lat: selectedLoc?.lat ?? BASE_LOCATION.lat,
			lng: selectedLoc?.lng ?? BASE_LOCATION.lng,
			loc: selectedLoc?.name ?? "Unknown",
		};

		setMyIncidents((prev) => [newInc, ...prev]);
		setNewMsg("");
	};

	if (!isMounted) return <div className="p-8 text-red-500 font-seven">INITIALIZING SECURE CHANNEL...</div>;

	return (
		<div className="flex flex-col border-2 border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.3)] bg-black">
			{/* Board Header */}
			<div className="flex items-center justify-between bg-red-600 px-4 py-2 font-seven text-2xl tracking-wider text-black">
				<span>LIVE URGENCY BOARD // VOL. 04</span>
				<div className="flex items-center gap-4 text-sm">
					<span>OPERATOR: {myPeerId}</span>
					<span className="animate-pulse">● LIVE NETWORK</span>
				</div>
			</div>

			{/* Incoming Comms Alert */}
			{incomingComms && (
				<div className="bg-red-900 text-white p-4 font-seven flex justify-between items-center border-b-2 border-red-500">
					<div>
						<span className="text-yellow-400 animate-pulse">INCOMING TRANSMISSION INTERCEPTED</span>
						<br />
						<span className="text-sm">FROM: {incomingComms.from} // "{incomingComms.msg}"</span>
					</div>
					<button 
						onClick={() => router.push(`/incident/${incomingComms.from}`)}
						className="border-2 border-yellow-400 text-yellow-400 px-4 py-2 hover:bg-yellow-400 hover:text-black transition"
					>
						OPEN SECURE CHANNEL
					</button>
				</div>
			)}

			<div className="flex h-[600px] flex-col lg:flex-row">
				{/* LEFT: Incident Feed & Form */}
				<div className="flex-1 flex flex-col border-r-2 border-red-600 bg-zinc-950">
					
					{/* Report Form */}
					<form onSubmit={handleReport} className="p-4 border-b border-red-600 bg-zinc-900">
						<div className="font-seven text-red-500 mb-2">REPORT NEW INCIDENT</div>
						<div className="flex flex-col gap-2">
							<input
								className="bg-black border border-zinc-700 text-white p-2 font-jetbrains text-sm outline-none focus:border-red-500"
								placeholder="Situation description..."
								value={newMsg}
								onChange={(e) => setNewMsg(e.target.value)}
							/>
							<div className="flex gap-2">
								<select 
									className="bg-black border border-zinc-700 text-red-400 p-2 font-seven flex-1 outline-none"
									value={newLocIndex}
									onChange={(e) => setNewLocIndex(Number(e.target.value))}
								>
									{LOCATIONS.map((loc, i) => (
										<option key={i} value={i}>{loc.name}</option>
									))}
								</select>
								<select 
									className="bg-black border border-zinc-700 text-red-400 p-2 font-seven outline-none"
									value={newPriority}
									onChange={(e) => setNewPriority(e.target.value)}
								>
									<option value="HIGH">PRIORITY: HIGH</option>
									<option value="MED">PRIORITY: MED</option>
									<option value="LOW">PRIORITY: LOW</option>
								</select>
								<button type="submit" className="bg-red-600/20 border border-red-600 text-red-500 px-4 hover:bg-red-600 hover:text-white font-seven transition">
									BROADCAST
								</button>
							</div>
						</div>
					</form>

					{/* Feed */}
					<div className="flex-1 overflow-y-auto p-4 space-y-4">
						{globalIncidents.length === 0 && (
							<div className="text-zinc-600 font-seven text-center mt-10">NO ACTIVE INCIDENTS ON GRID</div>
						)}
						{globalIncidents.map((inc) => (
							<div 
								key={inc.id} 
								className="border border-zinc-800 bg-black hover:border-red-500 p-3 transition-colors cursor-pointer relative group"
								onClick={() => {
									if (inc.peerId !== myPeerId) {
										router.push(`/incident/${inc.peerId}`);
									}
								}}
							>
								{inc.priority === "HIGH" && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600"></div>}
								<div className="flex justify-between font-seven text-red-600 text-xl tracking-wider">
									<span className={inc.priority === "HIGH" ? "ml-2" : ""}>PRIORITY {inc.priority}</span>
									<span className="text-zinc-500">{inc.time}</span>
								</div>
								<p className="text-zinc-300 font-jetbrains text-sm mt-2 leading-relaxed">{inc.msg}</p>
								<div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-2 font-seven text-xs tracking-widest">
									<span className="text-zinc-500">LOC: {inc.loc}</span>
									<span className="text-red-500/70">OP: {inc.peerId}</span>
								</div>
								
								{/* Hover Overlay */}
								{inc.peerId !== myPeerId && (
									<div className="absolute inset-0 bg-red-900/90 hidden group-hover:flex items-center justify-center font-seven text-white text-xl tracking-widest backdrop-blur-sm">
										CLICK TO OPEN COMMS
									</div>
								)}
							</div>
						))}
					</div>
				</div>

				{/* RIGHT: Tactical Map */}
				<div className="relative flex-1 bg-black overflow-hidden">
					<Map
						initialViewState={{ longitude: -0.1278, latitude: 51.5074, zoom: 11.5, pitch: 45 }}
						mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
						attributionControl={false}
					>
						{globalIncidents.map((inc) => (
							<Marker key={inc.id} longitude={inc.lng} latitude={inc.lat} anchor="center">
								<div className="relative flex items-center justify-center w-8 h-8 cursor-pointer">
									<span className="absolute inline-flex w-full h-full rounded-full bg-red-600 opacity-30 animate-ping"></span>
									<div className="relative z-10 w-3 h-3 bg-red-600 border border-black transform rotate-45"></div>
								</div>
							</Marker>
						))}
					</Map>
					<div className="absolute top-4 left-4 bg-black/80 border border-red-600 p-2 font-seven text-sm tracking-widest text-red-500 pointer-events-none">
						SAT_UPLINK: SECURE<br/>
						ACTIVE INCIDENTS: {globalIncidents.length}
					</div>
					<div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-40"></div>
				</div>
			</div>
		</div>
	);
}