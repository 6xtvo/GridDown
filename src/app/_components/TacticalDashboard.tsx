"use client";

import { useEffect, useState } from "react";
import MapGL, { Layer, Marker, Source } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { UrgencyBoard } from "./UrgencyBoard"; // <-- P2P Board
import { api } from "@/trpc/react"; // <-- Added TRPC API

// Base Location
const BASE_LOCATION = { lat: 51.5007, lng: -0.1246 };

// Helper Formulas
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
	const R = 6371;
	const dLat = (lat2 - lat1) * (Math.PI / 180);
	const dLon = (lon2 - lon1) * (Math.PI / 180);
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(lat1 * (Math.PI / 180)) *
			Math.cos(lat2 * (Math.PI / 180)) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return (R * c).toFixed(1);
}

// Define dynamic Incident Type
export type Incident = {
	id: string | number;
	priority: string;
	time: string;
	msg: string;
	lat: number;
	lng: number;
	loc: string;
	author: string;
};

type RouteState = {
	geojson: GeoJSON.LineString;
	durationMinutes: number;
};

export function TacticalDashboard() {
	const [mounted, setMounted] = useState(false);

	// App State
	const [profile, setProfile] = useState<{
		username: string;
		profession: string;
		age: string;
	} | null>(null);
	
    // Removed static initialization. Now starts empty and pulls from network.
	const [localIncidents, setLocalIncidents] = useState<Incident[]>([]);

	// UI State
	const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
	const [isReportModalOpen, setIsReportModalOpen] = useState(false);
	const [hoveredId, setHoveredId] = useState<number | string | null>(null);
	const [selectedIncidentId, setSelectedIncidentId] = useState<number | string | null>(null);
	const [activeRoute, setActiveRoute] = useState<RouteState | null>(null);
	const [isRouting, setIsRouting] = useState(false);
	const [now, setNow] = useState<Date | null>(null);

	// --- P2P Network Hook ---
	// Polls for peers and their metadata to populate the feed
	const { data: peers } = api.p2p.listPeers.useQuery(undefined, {
		refetchInterval: 3000,
		enabled: mounted,
	});

	// Initialize Clock & LocalStorage
	useEffect(() => {
		setMounted(true);
		setNow(new Date());
		const timer = setInterval(() => setNow(new Date()), 1000);

		const savedProfile = localStorage.getItem("griddown_profile");
		if (savedProfile) setProfile(JSON.parse(savedProfile));

		const savedIncidents = localStorage.getItem("griddown_incidents");
		if (savedIncidents) setLocalIncidents(JSON.parse(savedIncidents));

		return () => clearInterval(timer);
	}, []);

	// --- Active Feed Computation ---
	// Merges local incidents with real-time P2P incidents broadcasted by UrgencyBoard
	const activeFeed = [...localIncidents];
	if (peers) {
		peers.forEach((p) => {
			const peerIncidents = (p.metadata?.incidents as any[]) || [];
			peerIncidents.forEach((inc) => {
				// Prevent duplicates
				if (!activeFeed.some((existing) => String(existing.id) === String(inc.id))) {
					activeFeed.push({
						id: inc.id,
						priority: inc.priority,
						time: inc.time,
						msg: inc.msg,
						lat: inc.lat,
						lng: inc.lng,
						loc: inc.loc,
						author: inc.peerId || p.peerId || "UNKNOWN",
					});
				}
			});
		});
	}

	// Form Handlers
	const handleCreateProfile = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const newProfile = {
			username: formData.get("username") as string,
			profession: formData.get("profession") as string,
			age: formData.get("age") as string,
		};
		setProfile(newProfile);
		localStorage.setItem("griddown_profile", JSON.stringify(newProfile));
		setIsProfileModalOpen(false);
	};

	const handleMapClick = async (incident: Incident) => {
		setSelectedIncidentId(incident.id);
		setIsRouting(true);
		try {
			const res = await fetch(
				`https://router.project-osrm.org/route/v1/driving/${BASE_LOCATION.lng},${BASE_LOCATION.lat};${incident.lng},${incident.lat}?overview=full&geometries=geojson`,
			);
			const data = await res.json();
			if (data.routes?.[0]) {
				setActiveRoute({
					geojson: data.routes[0].geometry,
					durationMinutes: Math.ceil(data.routes[0].duration / 60),
				});
			}
		} catch (err) {
			console.error("Routing failed:", err);
		} finally {
			setIsRouting(false);
		}
	};

	// Time calculations
	let currentTimeString = "--:--:--";
	let blackoutString = "T+ --D:--H:--M:--S";
	if (now) {
		currentTimeString = now.toLocaleTimeString("en-GB", { hour12: false });
		const blackoutDate = new Date(now.getFullYear(), 4, 12, 3, 47, 0);
		const diffMs = Math.max(0, now.getTime() - blackoutDate.getTime());
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		const diffHours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
		const diffMins = Math.floor((diffMs / 1000 / 60) % 60);
		const diffSecs = Math.floor((diffMs / 1000) % 60);
		blackoutString = `T+ ${diffDays.toString().padStart(2, "0")}D:${diffHours.toString().padStart(2, "0")}H:${diffMins.toString().padStart(2, "0")}M:${diffSecs.toString().padStart(2, "0")}S`;
	}

	if (!mounted) return null;

	return (
		<div className="flex w-full flex-col gap-8">
			{/* --- TACTICAL NAV --- */}
			<nav className="flex w-full items-center justify-between border-b-2 border-red-600 bg-black px-8 py-4">
				<div className="font-sans text-3xl tracking-widest text-red-600 font-seven">
					GRID<span className="text-white">DOWN</span>
				</div>

				{!profile ? (
					<button
						className="border-2 border-red-600 bg-red-600 px-4 py-2 font-seven text-xl tracking-widest text-black shadow-[0_0_15px_rgba(220,38,38,0.5)] transition hover:bg-black hover:text-red-600"
						onClick={() => setIsProfileModalOpen(true)}
						type="button"
					>
						CREATE PROFILE
					</button>
				) : (
					<div className="flex items-center gap-6">
						<div className="text-right font-seven tracking-widest">
							<div className="text-lg text-green-500">
								OP: {profile.username}
							</div>
							<div className="text-xs text-zinc-500">
								ROLE: {profile.profession.toUpperCase()} // Lvl: {profile.age}
							</div>
						</div>
						<button
							className="border border-red-900 px-4 py-2 font-seven tracking-widest text-red-900 transition-colors hover:border-red-500 hover:text-red-500"
							onClick={() => {
								localStorage.clear();
								window.location.reload();
							}}
							type="button"
						>
							SYS_RESET
						</button>
						<button
							className="border-2 border-yellow-500 bg-yellow-500 px-6 py-2 font-seven text-2xl tracking-widest text-black shadow-[0_0_15px_rgba(234,179,8,0.4)] transition hover:bg-black hover:text-yellow-500"
							onClick={() => setIsReportModalOpen(true)}
							type="button"
						>
							REPORT INTEL
						</button>
					</div>
				)}
			</nav>

			{/* --- MODALS --- */}

			{/* 1. Profile Creation Modal */}
			{isProfileModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
					<form
						className="w-full max-w-md border-2 border-red-600 bg-zinc-950 p-6 shadow-[0_0_30px_rgba(220,38,38,0.3)]"
						onSubmit={handleCreateProfile}
					>
						<h2 className="mb-6 font-seven text-3xl tracking-wider text-red-500">
							INITIALIZE OPERATOR
						</h2>
						<div className="space-y-4 font-jetbrains">
							<div>
								<label className="text-xs text-red-500/70">
									{"CALLSIGN / USERNAME"}
								</label>
								<input
									className="w-full border border-red-900 bg-black p-2 uppercase text-white focus:border-red-500 focus:outline-none"
									name="username"
									required
								/>
							</div>
							<div>
								<label className="text-xs text-red-500/70">
									PROFESSION / SKILLSET
								</label>
								<input
									className="w-full border border-red-900 bg-black p-2 uppercase text-white focus:border-red-500 focus:outline-none"
									name="profession"
									placeholder="e.g. Medic, Engineer, Scout"
									required
								/>
							</div>
							<div>
								<label className="text-xs text-red-500/70">AGE CYCLE</label>
								<input
									className="w-full border border-red-900 bg-black p-2 text-white focus:border-red-500 focus:outline-none"
									name="age"
									required
									type="number"
								/>
							</div>
						</div>
						<div className="mt-8 flex justify-end gap-4">
							<button
								className="px-4 py-2 font-seven text-zinc-500 hover:text-white"
								onClick={() => setIsProfileModalOpen(false)}
								type="button"
							>
								CANCEL
							</button>
							<button
								className="border border-red-600 bg-red-600/20 px-6 py-2 font-seven tracking-widest text-red-500 hover:bg-red-600 hover:text-black"
								type="submit"
							>
								AUTHENTICATE
							</button>
						</div>
					</form>
				</div>
			)}

			{/* 2. P2P Urgency Board Floating Window */}
			{isReportModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
					<div className="relative w-full max-w-[95vw] lg:max-w-7xl animate-in fade-in duration-200">
						
						{/* Floating Window Header & Close Button */}
						<div className="flex justify-between items-end mb-2">
							<div className="font-seven text-xl tracking-widest text-yellow-500 animate-pulse">
								// SECURE P2P UPLINK ESTABLISHED
							</div>
							<button
								className="bg-red-900/20 border border-red-600 px-4 py-1 font-seven text-red-500 transition hover:bg-red-600 hover:text-black"
								onClick={() => setIsReportModalOpen(false)}
								type="button"
							>
								CLOSE TRANSMISSION [X]
							</button>
						</div>
						
						{/* Mounted P2P UrgencyBoard Container */}
						<div className="max-h-[85vh] overflow-y-auto border-2 border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
							<UrgencyBoard />
						</div>

					</div>
				</div>
			)}

			{/* --- BACKGROUND LOCAL URGENCY BOARD --- */}
			<div className="flex flex-col border-2 border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.3)] mx-8">
				<div className="flex flex-col items-center justify-between gap-2 bg-red-600 px-4 py-2 font-seven text-black text-xl tracking-wider md:flex-row">
					<span className="text-2xl">{"LOCAL URGENCY BOARD // VOL. 04"}</span>
					<div className="flex w-full items-center justify-between gap-4 border-red-900/30 border-t pt-2 text-sm md:w-auto md:justify-end md:border-t-0 md:pt-0 md:text-lg">
						<div className="flex gap-4">
							<span className="font-bold text-red-950/80">
								SYS: {currentTimeString}
							</span>
							<span className="border-red-900/30 border-l pl-4 font-bold text-red-950/80">
								BOUT: {blackoutString}
							</span>
						</div>
						<div className="flex items-center gap-2 border-red-900/30 border-l pl-4">
							<span className="animate-pulse">●</span>
							<span>LIVE</span>
						</div>
					</div>
				</div>

				<div className="flex h-[600px] flex-col lg:flex-row">
					{/* Main Feed */}
					<div className="flex-1 overflow-y-auto border-red-600 border-b-2 bg-zinc-950 lg:border-r-2 lg:border-b-0">
						<div className="space-y-4 p-4">
                            {/* Empty state when no incidents exist */}
							{activeFeed.length === 0 && (
								<div className="flex h-32 items-center justify-center border border-dashed border-zinc-800 text-zinc-600">
									<p className="font-jetbrains text-xs italic">
										AWAITING INCOMING TRANSMISSIONS...
									</p>
								</div>
							)}

							{activeFeed.map((inc) => (
								<button
									className={`relative cursor-pointer w-full border p-3 transition-colors ${selectedIncidentId === inc.id ? "border-green-500 bg-zinc-900/80" : "border-zinc-800 bg-zinc-900 hover:border-red-600/50"}`}
									key={inc.id}
									onClick={() => handleMapClick(inc)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") handleMapClick(inc);
									}}
									tabIndex={0}
									type="button"
								>
									{inc.priority === "HIGH" && (
										<div className="absolute bottom-0 left-0 top-0 w-1 bg-red-600" />
									)}
									{inc.priority === "MED" && (
										<div className="absolute bottom-0 left-0 top-0 w-1 bg-yellow-500" />
									)}

									<div className="flex justify-between font-seven text-red-600 text-xl tracking-wider">
										<span
											className={`${inc.priority === "MED" ? "text-yellow-500" : ""}`}
										>
											PRIORITY {inc.priority}
										</span>
										<span className="text-zinc-500">{inc.time}</span>
									</div>

									<p className="mt-2 font-jetbrains text-sm text-zinc-300 leading-relaxed text-left">
										{inc.msg}
									</p>

									<div className="mt-3 flex items-center justify-between border-zinc-800 border-t pt-2 font-seven text-xs tracking-widest">
										<span className="text-zinc-500">
											OP: {inc.author} // LOC: {inc.loc}
										</span>
										<span className="text-red-500/70">
											[{inc.lat.toFixed(4)}, {inc.lng.toFixed(4)}]
										</span>
									</div>
								</button>
							))}
						</div>
					</div>

					{/* Map */}
					<div className="relative flex-1 overflow-hidden bg-black">
						<MapGL
							attributionControl={false}
							initialViewState={{
								longitude: -0.1278,
								latitude: 51.5074,
								zoom: 11.5,
								pitch: 45,
							}}
							mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
						>
							{activeRoute && (
								<Source
									data={activeRoute.geojson}
									id="route-source"
									type="geojson"
								>
									<Layer
										id="route-layer"
										layout={{ "line-cap": "round", "line-join": "round" }}
										paint={{
											"line-color": "#22c55e",
											"line-dasharray": [0, 2, 2],
											"line-width": 3,
										}}
										type="line"
									/>
								</Source>
							)}

							<Marker
								anchor="center"
								latitude={BASE_LOCATION.lat}
								longitude={BASE_LOCATION.lng}
							>
								<div className="relative flex h-6 w-6 items-center justify-center">
									<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-40" />
									<div className="relative z-10 h-3 w-3 rounded-full border-2 border-black bg-green-500" />
								</div>
								<div className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap border border-green-500/30 bg-black/80 px-1 font-seven text-[10px] text-green-500">
									HQ_BASE
								</div>
							</Marker>

							{activeFeed.map((inc) => (
								<Marker
									anchor="center"
									key={inc.id}
									latitude={inc.lat}
									longitude={inc.lng}
								>
									{/* biome-ignore lint/a11y/useKeyWithClickEvents: map marker; keyboard nav handled on incident cards */}
									{/* biome-ignore lint/a11y/noStaticElementInteractions: map marker */}
									<div
										className="group relative cursor-pointer"
										onClick={() => handleMapClick(inc)}
										onMouseEnter={() => setHoveredId(inc.id)}
										onMouseLeave={() => setHoveredId(null)}
									>
										<div className="relative flex h-8 w-8 items-center justify-center">
											<span
												className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-30 ${inc.priority === "MED" ? "bg-yellow-500" : "bg-red-600"}`}
											/>
											<div
												className={`relative z-10 h-3 w-3 rotate-45 border border-black ${inc.priority === "MED" ? "bg-yellow-500" : "bg-red-600"}`}
											/>
										</div>

										{hoveredId === inc.id && (
											<div className="pointer-events-none absolute bottom-10 left-1/2 z-50 w-48 -translate-x-1/2 border border-red-600 bg-zinc-950 p-2 shadow-lg shadow-red-900/20">
												<div className="mb-1 border-red-600/30 border-b pb-1 font-seven text-red-500 text-sm">
													DIST:{" "}
													{getDistance(
														BASE_LOCATION.lat,
														BASE_LOCATION.lng,
														inc.lat,
														inc.lng,
													)}{" "}
													KM
												</div>
												<p className="font-jetbrains text-[10px] text-zinc-300 leading-tight">
													{inc.msg}
												</p>
											</div>
										)}
									</div>
								</Marker>
							))}
						</MapGL>

						<div className="pointer-events-none absolute right-4 bottom-4 z-10 border border-red-600 bg-black/80 p-2 text-right font-seven tracking-wider">
							{isRouting ? (
								<span className="animate-pulse text-lg text-yellow-500">
									CALCULATING ROUTE...
								</span>
							) : activeRoute ? (
								<>
									<div className="text-green-500 text-xl">PATH_LOCKED</div>
									<div className="mt-1 text-sm text-zinc-400">
										ETA: {activeRoute.durationMinutes} MIN (DRIVE)
									</div>
								</>
							) : (
								<span className="text-lg text-red-500">
									AWAITING COORD SELECTION
								</span>
							)}
						</div>

						{/* Scanline overlay */}
						<div className="pointer-events-none absolute inset-0 bg-size-[100%_4px,3px_100%] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] opacity-40" />
					</div>
				</div>
			</div>
		</div>
	);
}