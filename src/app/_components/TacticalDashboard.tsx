"use client";

import { useEffect, useState } from "react";
import MapGL, { Layer, Marker, Source } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import Image from "next/image";
import { api } from "@/trpc/react";
import { UrgencyBoard } from "./UrgencyBoard";

const DEFAULT_LOCATION = { lat: 51.5007, lng: -0.1246 };

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
	const R = 6371;
	const dLat = (lat2 - lat1) * (Math.PI / 180);
	const dLon = (lon2 - lon1) * (Math.PI / 180);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1 * (Math.PI / 180)) *
			Math.cos(lat2 * (Math.PI / 180)) *
			Math.sin(dLon / 2) ** 2;
	return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}

export type Incident = {
	id: string | number;
	type: string;
	priority: string;
	time: string;
	msg: string;
	lat: number;
	lng: number;
	loc: string;
	author: string;
};

type RouteState = { geojson: GeoJSON.LineString; durationMinutes: number };

const TYPE_CONFIG: Record<
	string,
	{ color: string; glow: string; label: string; bg: string }
> = {
	REQUEST: {
		color: "#ef4444",
		glow: "rgba(239,68,68,0.4)",
		label: "REQUEST",
		bg: "rgba(239,68,68,0.08)",
	},
	OFFER: {
		color: "#3b82f6",
		glow: "rgba(59,130,246,0.4)",
		label: "OFFER",
		bg: "rgba(59,130,246,0.08)",
	},
	ANNOUNCEMENT: {
		color: "#22c55e",
		glow: "rgba(34,197,94,0.4)",
		label: "ANNOUNCE",
		bg: "rgba(34,197,94,0.08)",
	},
};

const PRIORITY_COLOR: Record<string, string> = {
	HIGH: "#ef4444",
	MED: "#eab308",
	LOW: "#52525b",
};

function TypeBadge({ type }: { type: string }) {
	const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.REQUEST!;
	return (
		<span
			className="inline-flex items-center px-2 py-0.5 text-[9px] tracking-[0.25em] font-bold"
			style={{
				color: cfg.color,
				border: `1px solid ${cfg.color}55`,
				background: cfg.bg,
				boxShadow: `0 0 6px ${cfg.glow}`,
			}}
		>
			{cfg.label}
		</span>
	);
}

export function TacticalDashboard() {
	const [mounted, setMounted] = useState(false);
	const [profile, setProfile] = useState<{
		username: string;
		profession: string;
		age: string;
		lat: number;
		lng: number;
	} | null>(null);
	const [localIncidents, setLocalIncidents] = useState<Incident[]>([]);
	const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
	const [isReportModalOpen, setIsReportModalOpen] = useState(false);
	const [hqSelect, setHqSelect] = useState<{ lat: number; lng: number } | null>(
		null,
	);
	const [hoveredId, setHoveredId] = useState<number | string | null>(null);
	const [selectedIncidentId, setSelectedIncidentId] = useState<
		number | string | null
	>(null);
	const [activeRoute, setActiveRoute] = useState<RouteState | null>(null);
	const [isRouting, setIsRouting] = useState(false);
	const [now, setNow] = useState<Date | null>(null);

	const currentBase =
		profile?.lat && profile?.lng
			? { lat: profile.lat, lng: profile.lng }
			: DEFAULT_LOCATION;

	const { data: peers } = api.p2p.listPeers.useQuery(undefined, {
		refetchInterval: 3000,
		enabled: mounted,
	});

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

	const activeFeed = [...localIncidents];
	if (peers) {
		peers.forEach((p) => {
			const peerIncidents = (p.metadata?.incidents as Incident[]) || [];
			peerIncidents.forEach((inc) => {
				if (!activeFeed.some((e) => String(e.id) === String(inc.id))) {
					activeFeed.push({
						...inc,
						author: (inc as any).peerId || p.peerId || "UNKNOWN",
					});
				}
			});
		});
	}
	const priorityWeight: Record<string, number> = { HIGH: 3, MED: 2, LOW: 1 };
	activeFeed.sort((a, b) => {
		const d =
			(priorityWeight[b.priority] ?? 0) - (priorityWeight[a.priority] ?? 0);
		return d !== 0 ? d : b.time.localeCompare(a.time);
	});

	const handleCreateProfile = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!hqSelect) {
			alert("SYS_ERROR: MUST SET HQ COORDINATES ON MAP");
			return;
		}
		const formData = new FormData(e.currentTarget);
		const newProfile = {
			username: formData.get("username") as string,
			profession: formData.get("profession") as string,
			age: formData.get("age") as string,
			lat: hqSelect.lat,
			lng: hqSelect.lng,
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
				`https://router.project-osrm.org/route/v1/driving/${currentBase.lng},${currentBase.lat};${incident.lng},${incident.lat}?overview=full&geometries=geojson`,
			);
			const data = await res.json();
			if (data.routes?.[0]) {
				setActiveRoute({
					geojson: data.routes[0].geometry,
					durationMinutes: Math.ceil(data.routes[0].duration / 60),
				});
			}
		} catch {
			/* silent */
		} finally {
			setIsRouting(false);
		}
	};

	let currentTimeString = "--:--:--";
	let blackoutString = "T+ --D:--H:--M:--S";
	if (now) {
		currentTimeString = now.toLocaleTimeString("en-GB", { hour12: false });
		const blackoutDate = new Date(now.getFullYear(), 4, 12, 3, 47, 0);
		const diffMs = Math.max(0, now.getTime() - blackoutDate.getTime());
		const d = Math.floor(diffMs / 86400000);
		const h = Math.floor((diffMs / 3600000) % 24);
		const m = Math.floor((diffMs / 60000) % 60);
		const s = Math.floor((diffMs / 1000) % 60);
		blackoutString = `T+ ${String(d).padStart(2, "0")}D:${String(h).padStart(2, "0")}H:${String(m).padStart(2, "0")}M:${String(s).padStart(2, "0")}S`;
	}

	if (!mounted) return null;

	return (
		<>
			<style>{`
				@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
				.td { font-family: 'Share Tech Mono', monospace; }
				@keyframes td-ping { 75%,100%{transform:scale(2);opacity:0} }
				@keyframes td-fadein { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
				@keyframes td-flicker { 0%,100%{opacity:1} 50%{opacity:0.92} 75%{opacity:0.97} }
			`}</style>

			<div className="td flex w-full flex-col">
				{/* ── NAV ──────────────────────────────────────────── */}
				<nav
					className="relative flex w-full items-center justify-between px-6 py-4 overflow-hidden"
					style={{
						background:
							"linear-gradient(180deg, rgba(15,2,2,0.98) 0%, rgba(6,0,0,0.95) 100%)",
						borderBottom: "1px solid rgba(220,38,38,0.2)",
						boxShadow:
							"0 1px 0 rgba(220,38,38,0.06), 0 4px 24px rgba(0,0,0,0.6)",
					}}
				>
					{/* Ambient left glow */}
					<div
						className="pointer-events-none absolute left-0 top-0 bottom-0 w-32 opacity-30"
						style={{
							background:
								"linear-gradient(90deg,rgba(220,38,38,0.15),transparent)",
						}}
					/>

					<div className="flex items-center gap-4 relative z-10">
						<div
							className="flex items-center justify-center w-9 h-9"
							style={{
								border: "1px solid rgba(220,38,38,0.3)",
								boxShadow:
									"0 0 12px rgba(220,38,38,0.15) inset, 0 0 8px rgba(220,38,38,0.1)",
							}}
						>
							<Image
								alt="GridDown Logo"
								className="opacity-90"
								height={22}
								src="/icon.png"
								width={22}
							/>
						</div>
						<div>
							<div
								className="text-2xl tracking-[0.15em]"
								style={{
									color: "#dc2626",
									textShadow: "0 0 20px rgba(220,38,38,0.4)",
									animation: "td-flicker 8s ease-in-out infinite",
								}}
							>
								GRID<span style={{ color: "#f4f4f5" }}>DOWN</span>
							</div>
							<div className="text-[8px] tracking-[0.4em] text-zinc-700 mt-0.5">
								MESH_NETWORK // LOCAL_NODE
							</div>
						</div>
					</div>

					{!profile ? (
						<button
							className="relative z-10 overflow-hidden group transition-all duration-200"
							onClick={() => setIsProfileModalOpen(true)}
							style={{
								border: "1px solid rgba(220,38,38,0.6)",
								background: "rgba(220,38,38,0.08)",
								padding: "8px 20px",
								boxShadow: "0 0 14px rgba(220,38,38,0.15)",
							}}
							type="button"
						>
							<div
								className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
								style={{ background: "rgba(220,38,38,0.12)" }}
							/>
							<span className="relative z-10 text-[11px] tracking-[0.3em] text-red-400 group-hover:text-red-300 transition-colors">
								INITIALIZE OPERATOR
							</span>
						</button>
					) : (
						<div className="relative z-10 flex items-center gap-5">
							<div
								className="px-4 py-2"
								style={{
									border: "1px solid rgba(34,197,94,0.2)",
									background: "rgba(34,197,94,0.04)",
								}}
							>
								<div className="flex items-center gap-2 mb-0.5">
									<span
										className="h-1.5 w-1.5 rounded-full bg-green-400"
										style={{ boxShadow: "0 0 6px rgba(34,197,94,0.8)" }}
									/>
									<span className="text-[11px] tracking-[0.25em] text-green-400">
										OP: {profile.username}
									</span>
								</div>
								<div className="text-[9px] tracking-[0.22em] text-zinc-600">
									{profile.profession.toUpperCase()} // AGE {profile.age}
								</div>
							</div>

							<button
								className="text-[10px] tracking-[0.28em] text-zinc-700 hover:text-red-600 transition-colors duration-200 px-3 py-2"
								onClick={() => {
									localStorage.clear();
									window.location.reload();
								}}
								style={{ border: "1px solid rgba(255,255,255,0.04)" }}
								type="button"
							>
								SYS_RESET
							</button>

							<button
								className="relative overflow-hidden group transition-all duration-200"
								onClick={() => setIsReportModalOpen(true)}
								style={{
									border: "1px solid rgba(234,179,8,0.5)",
									background: "rgba(234,179,8,0.06)",
									padding: "9px 22px",
									boxShadow: "0 0 16px rgba(234,179,8,0.12)",
								}}
								type="button"
							>
								<div
									className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
									style={{ background: "rgba(234,179,8,0.1)" }}
								/>
								<div
									className="pointer-events-none absolute bottom-0 inset-x-0 h-px"
									style={{
										background:
											"linear-gradient(90deg,transparent,rgba(234,179,8,0.5),transparent)",
									}}
								/>
								<span className="relative z-10 text-[11px] tracking-[0.3em] text-yellow-500 group-hover:text-yellow-400 transition-colors">
									ACCESS SYSTEM
								</span>
							</button>
						</div>
					)}
				</nav>

				{/* ── PROFILE MODAL ────────────────────────────────── */}
				{isProfileModalOpen && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
						<form
							className="relative w-full max-w-xl overflow-hidden"
							onSubmit={handleCreateProfile}
							style={{
								background: "rgba(4,1,1,0.98)",
								border: "1px solid rgba(220,38,38,0.3)",
								boxShadow:
									"0 0 0 1px rgba(220,38,38,0.08), 0 0 60px rgba(220,38,38,0.12), 0 32px 80px rgba(0,0,0,0.95)",
								animation: "td-fadein 0.2s ease-out",
							}}
						>
							<div
								className="pointer-events-none absolute top-0 inset-x-0 h-px"
								style={{
									background:
										"linear-gradient(90deg,transparent,rgba(220,38,38,0.6),transparent)",
								}}
							/>
							{/* corners */}
							{[
								"top-0 left-0 border-t border-l",
								"top-0 right-0 border-t border-r",
								"bottom-0 left-0 border-b border-l",
								"bottom-0 right-0 border-b border-r",
							].map((c) => (
								<div
									className={`pointer-events-none absolute h-4 w-4 ${c}`}
									key={c}
									style={{ borderColor: "rgba(220,38,38,0.4)" }}
								/>
							))}

							<div
								className="px-6 py-5"
								style={{ borderBottom: "1px solid rgba(220,38,38,0.1)" }}
							>
								<div className="flex items-center gap-3">
									<div
										className="h-px flex-1"
										style={{
											background:
												"linear-gradient(90deg,rgba(220,38,38,0.4),transparent)",
										}}
									/>
									<span className="text-[11px] tracking-[0.4em] text-red-500">
										INITIALIZE OPERATOR
									</span>
									<div
										className="h-px flex-1"
										style={{
											background:
												"linear-gradient(270deg,rgba(220,38,38,0.4),transparent)",
										}}
									/>
								</div>
							</div>

							<div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
								<div className="space-y-4">
									{[
										{
											label: "CALLSIGN / USERNAME",
											name: "username",
											placeholder: "",
											type: "text",
										},
										{
											label: "PROFESSION / SKILLSET",
											name: "profession",
											placeholder: "e.g. Medic, Engineer, Scout",
											type: "text",
										},
										{
											label: "AGE",
											name: "age",
											placeholder: "",
											type: "number",
										},
									].map((f) => (
										<div key={f.name}>
											<label className="block text-[9px] tracking-[0.3em] text-zinc-600 mb-1.5">
												{f.label}
											</label>
											<input
												className="w-full bg-transparent px-3 py-2 text-[11px] tracking-widest text-zinc-200 outline-none uppercase transition-all duration-150 placeholder:text-zinc-800"
												name={f.name}
												onBlur={(e) => {
													e.currentTarget.style.border =
														"1px solid rgba(255,255,255,0.07)";
													e.currentTarget.style.boxShadow = "none";
												}}
												onFocus={(e) => {
													e.currentTarget.style.border =
														"1px solid rgba(220,38,38,0.4)";
													e.currentTarget.style.boxShadow =
														"0 0 10px rgba(220,38,38,0.08)";
												}}
												placeholder={f.placeholder}
												required
												style={{
													border: "1px solid rgba(255,255,255,0.07)",
												}}
												type={f.type}
											/>
										</div>
									))}
								</div>

								<div className="flex flex-col gap-2">
									<label className="text-[9px] tracking-[0.3em] text-zinc-600">
										SET HQ COORDINATES
									</label>
									<div
										className="relative flex-1 overflow-hidden"
										style={{
											border: "1px solid rgba(220,38,38,0.15)",
											minHeight: "160px",
										}}
									>
										<MapGL
											attributionControl={false}
											initialViewState={{
												longitude: DEFAULT_LOCATION.lng,
												latitude: DEFAULT_LOCATION.lat,
												zoom: 10,
											}}
											mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
											onClick={(e) =>
												setHqSelect({ lat: e.lngLat.lat, lng: e.lngLat.lng })
											}
										>
											{hqSelect && (
												<Marker
													anchor="center"
													latitude={hqSelect.lat}
													longitude={hqSelect.lng}
												>
													<div className="relative flex h-5 w-5 items-center justify-center">
														<span
															className="absolute h-full w-full rounded-full bg-green-500 opacity-40"
															style={{ animation: "td-ping 1.5s infinite" }}
														/>
														<span className="relative h-2 w-2 rounded-full bg-green-400" />
													</div>
												</Marker>
											)}
										</MapGL>
										{!hqSelect && (
											<div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] tracking-[0.3em] text-red-900">
												CLICK TO SET HQ
											</div>
										)}
									</div>
									{hqSelect && (
										<div className="text-[9px] tracking-[0.25em] text-green-600">
											LOCKED [{hqSelect.lat.toFixed(4)},{" "}
											{hqSelect.lng.toFixed(4)}]
										</div>
									)}
								</div>
							</div>

							<div
								className="flex justify-end gap-3 px-6 py-4"
								style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
							>
								<button
									className="px-5 py-2 text-[10px] tracking-[0.28em] text-zinc-600 hover:text-zinc-400 transition-colors"
									onClick={() => setIsProfileModalOpen(false)}
									type="button"
								>
									ABORT
								</button>
								<button
									className="px-6 py-2 text-[10px] tracking-[0.3em] transition-all duration-200"
									disabled={!hqSelect}
									style={{
										border: hqSelect
											? "1px solid rgba(220,38,38,0.5)"
											: "1px solid rgba(220,38,38,0.12)",
										color: hqSelect ? "#f87171" : "rgba(220,38,38,0.2)",
										background: hqSelect
											? "rgba(220,38,38,0.08)"
											: "transparent",
										boxShadow: hqSelect
											? "0 0 12px rgba(220,38,38,0.1)"
											: "none",
										cursor: hqSelect ? "pointer" : "not-allowed",
									}}
									type="submit"
								>
									AUTHENTICATE
								</button>
							</div>
						</form>
					</div>
				)}

				{/* ── SYSTEM MODAL ─────────────────────────────────── */}
				{isReportModalOpen && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 p-4 backdrop-blur-md">
						<div
							className="relative w-full max-w-[95vw] lg:max-w-7xl"
							style={{ animation: "td-fadein 0.2s ease-out" }}
						>
							<div className="mb-3 flex items-center justify-between px-1">
								<div className="flex items-center gap-3">
									<span
										className="h-1.5 w-1.5 rounded-full bg-yellow-400"
										style={{
											boxShadow: "0 0 8px rgba(234,179,8,0.8)",
											animation: "td-ping 2s infinite",
										}}
									/>
									<span className="text-[10px] tracking-[0.35em] text-yellow-500">
										SECURE P2P UPLINK ESTABLISHED
									</span>
								</div>
								<button
									className="flex items-center gap-2 px-4 py-1.5 text-[10px] tracking-[0.25em] transition-all duration-150"
									onClick={() => setIsReportModalOpen(false)}
									style={{
										border: "1px solid rgba(220,38,38,0.3)",
										color: "rgba(220,38,38,0.7)",
										background: "rgba(220,38,38,0.05)",
									}}
									type="button"
								>
									CLOSE [X]
								</button>
							</div>
							<div
								className="max-h-[85vh] overflow-y-auto"
								style={{
									border: "1px solid rgba(234,179,8,0.25)",
									boxShadow:
										"0 0 0 1px rgba(234,179,8,0.06), 0 0 40px rgba(234,179,8,0.08)",
								}}
							>
								<UrgencyBoard />
							</div>
						</div>
					</div>
				)}

				{/* ── URGENCY BOARD ────────────────────────────────── */}
				<div
					className="mx-4 my-4 flex flex-col"
					style={{
						border: "1px solid rgba(220,38,38,0.2)",
						boxShadow:
							"0 0 30px rgba(220,38,38,0.06), 0 0 0 1px rgba(220,38,38,0.04)",
					}}
				>
					{/* Board header */}
					<div
						className="relative flex flex-col gap-3 overflow-hidden px-5 py-4 md:flex-row md:items-center md:justify-between"
						style={{
							background:
								"linear-gradient(135deg, rgba(220,38,38,0.12) 0%, rgba(0,0,0,0) 50%)",
							borderBottom: "1px solid rgba(220,38,38,0.15)",
						}}
					>
						<div
							className="pointer-events-none absolute top-0 inset-x-0 h-px"
							style={{
								background:
									"linear-gradient(90deg,rgba(220,38,38,0.5),rgba(220,38,38,0.2),transparent)",
							}}
						/>

						<div className="flex items-center gap-4">
							<div
								className="px-3 py-1"
								style={{
									border: "1px solid rgba(220,38,38,0.3)",
									background: "rgba(220,38,38,0.06)",
								}}
							>
								<span className="text-[11px] tracking-[0.35em] text-red-500">
									LOCAL URGENCY BOARD
								</span>
							</div>
							<span className="text-[9px] tracking-[0.3em] text-zinc-700">
								VOL. 04
							</span>
						</div>

						<div className="flex items-center gap-6">
							<div>
								<div className="text-[9px] tracking-[0.3em] text-zinc-700">
									SYS_TIME
								</div>
								<div className="text-[11px] tracking-[0.2em] text-zinc-400">
									{currentTimeString}
								</div>
							</div>
							<div className="h-6 w-px bg-zinc-900" />
							<div>
								<div className="text-[9px] tracking-[0.3em] text-zinc-700">
									BLACKOUT
								</div>
								<div className="text-[11px] tracking-[0.12em] text-zinc-500">
									{blackoutString}
								</div>
							</div>
							<div className="h-6 w-px bg-zinc-900" />
							<div className="flex items-center gap-2">
								<span
									className="h-1.5 w-1.5 rounded-full bg-red-500"
									style={{
										animation: "td-ping 2s infinite",
										boxShadow: "0 0 6px rgba(220,38,38,0.8)",
									}}
								/>
								<span className="text-[10px] tracking-[0.3em] text-red-500">
									LIVE
								</span>
							</div>
						</div>
					</div>

					{/* Board body */}
					<div className="flex h-150 flex-col lg:flex-row">
						{/* Feed */}
						<div
							className="flex-1 overflow-y-auto"
							style={{ borderRight: "1px solid rgba(220,38,38,0.1)" }}
						>
							<div className="p-3 space-y-2">
								{activeFeed.length === 0 && (
									<div
										className="flex h-40 items-center justify-center"
										style={{ border: "1px dashed rgba(255,255,255,0.04)" }}
									>
										<span className="text-[10px] tracking-[0.3em] text-zinc-800">
											AWAITING TRANSMISSIONS...
										</span>
									</div>
								)}
								{activeFeed.map((inc) => {
									const cfg = TYPE_CONFIG[inc.type] ?? TYPE_CONFIG.REQUEST!;
									const isSelected = selectedIncidentId === inc.id;
									return (
										<button
											className="relative w-full text-left group transition-all duration-150"
											key={inc.id}
											onClick={() => handleMapClick(inc)}
											style={{
												background: isSelected
													? "rgba(220,38,38,0.05)"
													: "rgba(255,255,255,0.01)",
												border: isSelected
													? `1px solid ${cfg.color}35`
													: "1px solid rgba(255,255,255,0.04)",
												boxShadow: isSelected ? `0 0 16px ${cfg.glow}` : "none",
											}}
											type="button"
										>
											{/* Left accent bar */}
											<div
												className="absolute top-0 bottom-0 left-0 w-0.5 transition-opacity duration-150"
												style={{
													background: cfg.color,
													boxShadow: `0 0 8px ${cfg.glow}`,
													opacity: isSelected ? 1 : 0.3,
												}}
											/>

											<div className="px-4 py-3 pl-5">
												<div className="flex items-center justify-between mb-2">
													<div className="flex items-center gap-2">
														<TypeBadge type={inc.type} />
														<span
															className="text-[9px] tracking-[0.25em]"
															style={{
																color:
																	PRIORITY_COLOR[inc.priority] ?? "#52525b",
															}}
														>
															{inc.type === "OFFER"
																? "N/A"
																: `P-${inc.priority}`}
														</span>
													</div>
													<span className="text-[9px] tracking-[0.18em] text-zinc-700">
														{inc.time}
													</span>
												</div>

												<p className="text-[11px] leading-relaxed text-zinc-400 mb-2">
													{inc.msg}
												</p>

												<div
													className="flex items-center justify-between"
													style={{
														borderTop: "1px solid rgba(255,255,255,0.03)",
														paddingTop: "8px",
													}}
												>
													<span className="text-[9px] tracking-[0.18em] text-zinc-700 truncate">
														OP: {inc.author} // {inc.loc}
													</span>
													<span
														className="text-[9px] tracking-[0.12em] shrink-0 ml-2"
														style={{ color: cfg.color + "80" }}
													>
														[{inc.lat.toFixed(3)}, {inc.lng.toFixed(3)}]
													</span>
												</div>
											</div>

											{/* Hover overlay */}
											<div
												className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
												style={{
													background: `linear-gradient(135deg, ${cfg.glow.replace("0.4", "0.03")} 0%, transparent 100%)`,
												}}
											/>
										</button>
									);
								})}
							</div>
						</div>

						{/* Map */}
						<div className="relative flex-1 overflow-hidden bg-black">
							<MapGL
								attributionControl={false}
								initialViewState={{
									longitude: currentBase.lng,
									latitude: currentBase.lat,
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
									latitude={currentBase.lat}
									longitude={currentBase.lng}
								>
									<div className="relative flex h-6 w-6 items-center justify-center">
										<span
											className="absolute h-full w-full rounded-full bg-green-500 opacity-30"
											style={{ animation: "td-ping 2s infinite" }}
										/>
										<div
											className="relative z-10 h-3 w-3 rounded-full bg-green-500 border-2 border-black"
											style={{ boxShadow: "0 0 8px rgba(34,197,94,0.8)" }}
										/>
									</div>
									<div
										className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 text-[8px] tracking-[0.2em] text-green-500"
										style={{
											border: "1px solid rgba(34,197,94,0.25)",
											background: "rgba(0,0,0,0.9)",
										}}
									>
										HQ_BASE
									</div>
								</Marker>

								{activeFeed.map((inc) => {
									const cfg = TYPE_CONFIG[inc.type] ?? TYPE_CONFIG.REQUEST!;
									return (
										<Marker
											anchor="center"
											key={inc.id}
											latitude={inc.lat}
											longitude={inc.lng}
										>
											<div
												className="relative flex h-8 w-8 cursor-pointer items-center justify-center group"
												onClick={() => handleMapClick(inc)}
												onMouseEnter={() => setHoveredId(inc.id)}
												onMouseLeave={() => setHoveredId(null)}
											>
												<span
													className="absolute inline-flex h-full w-full rounded-full opacity-25"
													style={{
														background: cfg.color,
														animation: "td-ping 2s infinite",
													}}
												/>
												<div
													className="relative z-10 h-3 w-3 rotate-45"
													style={{
														background: cfg.color,
														boxShadow: `0 0 8px ${cfg.glow}`,
														border: "1px solid rgba(0,0,0,0.5)",
														transform:
															selectedIncidentId === inc.id
																? "rotate(45deg) scale(1.5)"
																: "rotate(45deg)",
													}}
												/>

												{hoveredId === inc.id && (
													<div
														className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 z-50 w-44 p-2"
														style={{
															background: "rgba(4,1,1,0.97)",
															border: `1px solid ${cfg.color}35`,
															boxShadow: `0 0 16px ${cfg.glow}`,
														}}
													>
														<div
															className="text-[9px] tracking-[0.25em] mb-1.5 pb-1"
															style={{
																color: cfg.color,
																borderBottom: `1px solid ${cfg.color}20`,
															}}
														>
															DIST:{" "}
															{getDistance(
																currentBase.lat,
																currentBase.lng,
																inc.lat,
																inc.lng,
															)}{" "}
															KM
														</div>
														<p className="text-[10px] text-zinc-400 leading-snug">
															{inc.msg}
														</p>
													</div>
												)}
											</div>
										</Marker>
									);
								})}
							</MapGL>

							{/* Route HUD */}
							<div
								className="absolute right-3 bottom-3 z-10 px-3 py-2 text-right"
								style={{
									background: "rgba(4,1,1,0.92)",
									border: "1px solid rgba(220,38,38,0.18)",
									boxShadow: "0 0 16px rgba(0,0,0,0.6)",
								}}
							>
								{isRouting ? (
									<span
										className="text-[10px] tracking-[0.25em] text-yellow-500"
										style={{ animation: "td-flicker 1.5s infinite" }}
									>
										CALCULATING ROUTE...
									</span>
								) : activeRoute ? (
									<>
										<div
											className="text-[11px] tracking-[0.25em] text-green-400 mb-0.5"
											style={{ textShadow: "0 0 8px rgba(34,197,94,0.4)" }}
										>
											PATH_LOCKED
										</div>
										<div className="text-[9px] tracking-[0.2em] text-zinc-600">
											ETA: {activeRoute.durationMinutes} MIN
										</div>
									</>
								) : (
									<span className="text-[10px] tracking-[0.22em] text-zinc-700">
										AWAITING SELECTION
									</span>
								)}
							</div>

							{/* Scanline */}
							<div
								className="pointer-events-none absolute inset-0"
								style={{
									backgroundImage:
										"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.06) 3px,rgba(0,0,0,0.06) 4px)",
									mixBlendMode: "multiply",
								}}
							/>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
