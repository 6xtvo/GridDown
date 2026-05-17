"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import MapGL, { Layer, Marker, Source } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { z } from "zod";
import { api } from "@/trpc/react";

// ─── Constants ────────────────────────────────────────────────────────────────
const SKILL_OPTIONS = [
	"Medic",
	"Field Surgery",
	"Triage",
	"Engineer",
	"Electrical",
	"Plumbing",
	"Structural",
	"Radio Operator",
	"Navigation",
	"Logistics",
	"Security",
	"Search & Rescue",
	"Firefighting",
	"Water Purification",
	"Food Distribution",
	"Counselling",
	"Translator",
	"Driver",
	"Drone Operator",
	"IT / Comms",
] as const;

type Skill = (typeof SKILL_OPTIONS)[number];

const DEFAULT_LOCATION = { lat: 51.5007, lng: -0.1246 };

const PRIORITY_DOT: Record<string, string> = {
	HIGH: "#ef4444",
	MED: "#f59e0b",
	LOW: "#52525b",
};

const TYPE_LABEL: Record<string, string> = {
	REQUEST: "REQUEST",
	OFFER: "OFFER",
	ANNOUNCE: "ANNOUNCEMENT",
};

const TYPE_COLOR: Record<string, string> = {
	REQUEST: "#ef4444",
	OFFER: "#3b82f6",
	ANNOUNCE: "#22c55e",
};

const PRIORITY_WEIGHT: Record<string, number> = { HIGH: 3, MED: 2, LOW: 1 };

// ─── Zod schema ───────────────────────────────────────────────────────────────
const profileSchema = z.object({
	username: z
		.string()
		.min(2, "Min 2 characters")
		.max(20, "Max 20 characters")
		.regex(/^[A-Z0-9-_]+$/i, "Letters, numbers, hyphens only"),
	age: z
		.number({ invalid_type_error: "Enter a number" })
		.int("Whole numbers only")
		.min(16, "Must be 16 or older")
		.max(99, "Must be under 100"),
	skills: z.array(z.string()).min(1, "Select at least one skill"),
});

type ProfileErrors = Partial<
	Record<keyof z.infer<typeof profileSchema>, string>
>;

// ─── Types ────────────────────────────────────────────────────────────────────
export type Incident = {
	id: string;
	type: "REQUEST" | "OFFER" | "ANNOUNCE";
	priority: "HIGH" | "MED" | "LOW";
	msg: string;
	lat: number;
	lng: number;
	loc: string;
	author: string;
	time: string;
	votes?: Record<string, 1 | -1>;
};

type VoteValue = 1 | -1;

// msgId for exact dedup; image for optional photo attachments
type ChatMsg = {
	from: string;
	image?: string | null;
	text: string;
	time: number;
	msgId: string;
};

type RouteState = { geojson: GeoJSON.LineString; eta: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLon / 2) ** 2;
	return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}

function timeAgo(dateStr: string): string {
	const now = Date.now();
	const parsed = new Date(`${new Date().toDateString()} ${dateStr}`).getTime();
	const diff = Math.floor((now - parsed) / 1000);
	if (diff < 60) return "just now";
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
	return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function TacticalDashboard() {
	const [mounted, setMounted] = useState(false);
	const [profile, setProfile] = useState<{
		username: string;
		role: string;
		lat: number;
		lng: number;
	} | null>(null);
	const [showOnboard, setShowOnboard] = useState(false);
	const [hqDraft, setHqDraft] = useState<{ lat: number; lng: number } | null>(
		null,
	);

	const [chatImage, setChatImage] = useState<string | null>(null);
	const chatFileRef = useRef<HTMLInputElement>(null);

	const [incidents, setIncidents] = useState<Incident[]>([]);
	const [incidentVotes, setIncidentVotes] = useState<
		Record<string, Record<string, VoteValue>>
	>({});
	const [selected, setSelected] = useState<string | null>(null);
	const [route, setRoute] = useState<RouteState | null>(null);
	const [routing, setRouting] = useState(false);

	const [rightPanel, setRightPanel] = useState<"map" | "chat">("map");
	const [chatLogs, setChatLogs] = useState<Record<string, ChatMsg[]>>({});
	const [chatInput, setChatInput] = useState("");
	const chatBottomRef = useRef<HTMLDivElement>(null);

	const [postMsg, setPostMsg] = useState("");
	const [postType, setPostType] = useState<Incident["type"]>("REQUEST");
	const [postPriority, setPostPriority] = useState<Incident["priority"]>("MED");
	const [postCoord, setPostCoord] = useState<{
		lat: number;
		lng: number;
	} | null>(null);
	const [postStep, setPostStep] = useState<"form" | "map">("form");

	const [obUsername, setObUsername] = useState("");
	const [obAge, setObAge] = useState("");
	const [obSkills, setObSkills] = useState<Skill[]>([]);
	const [obErrors, setObErrors] = useState<ProfileErrors>({});
	const [skillSearch, setSkillSearch] = useState("");

	const base = profile ?? DEFAULT_LOCATION;

	// ─── tRPC ─────────────────────────────────────────────────────────────────
	const { data: peers } = api.p2p.listPeers.useQuery(undefined, {
		refetchInterval: 3000,
		enabled: mounted,
	});
	const register = api.p2p.register.useMutation();
	const sendMessage = api.p2p.sendMessage.useMutation();
	const { data: incomingMessages } = api.p2p.getMessages.useQuery(
		{ peerId: profile?.username ?? "" },
		{ refetchInterval: 2000, enabled: mounted && !!profile },
	);

	// ─── Chat helpers ─────────────────────────────────────────────────────────
	const getChatMessageId = (
		room: string,
		message: { msgId?: string; time: number; from: string; text: string },
		index = 0,
	) =>
		message.msgId ??
		`${room}:${message.time}:${message.from}:${message.text}:${index}`;

	const normalizeChatThread = (room: string, messages: ChatMsg[]) =>
		messages.map((message, index) => ({
			...message,
			msgId: getChatMessageId(room, message, index),
		}));

	const readPersistedChats = () => {
		const savedChat = localStorage.getItem("gd_chats");
		if (!savedChat) return {} as Record<string, ChatMsg[]>;
		const parsed = JSON.parse(savedChat) as Record<string, ChatMsg[]>;
		return Object.fromEntries(
			Object.entries(parsed).map(([room, messages]) => [
				room,
				normalizeChatThread(room, messages),
			]),
		) as Record<string, ChatMsg[]>;
	};

	function getVoteTotals(votes?: Record<string, VoteValue>) {
		const values = Object.values(votes ?? {});
		return {
			upvotes: values.filter((vote) => vote === 1).length,
			downvotes: values.filter((vote) => vote === -1).length,
		};
	}

	function mergeVotes(
		...voteGroups: Array<Record<string, VoteValue> | undefined>
	) {
		return voteGroups.reduce<Record<string, VoteValue>>((acc, group) => {
			if (!group) return acc;
			return { ...acc, ...group };
		}, {});
	}

	function mergeIncidentSnapshots(base: Incident[], snapshots: Incident[]) {
		const merged = new Map<string, Incident>();
		const upsert = (incident: Incident) => {
			const existing = merged.get(incident.id);
			if (!existing) {
				merged.set(incident.id, {
					...incident,
					votes: { ...(incident.votes ?? {}) },
				});
				return;
			}

			merged.set(incident.id, {
				...existing,
				...incident,
				votes: {
					...(existing.votes ?? {}),
					...(incident.votes ?? {}),
				},
			});
		};

		base.forEach(upsert);
		snapshots.forEach(upsert);
		return [...merged.values()];
	}

	function incidentsAreEqual(left: Incident[], right: Incident[]) {
		if (left.length !== right.length) return false;
		const rightById = new Map(right.map((incident) => [incident.id, incident]));

		for (const incident of left) {
			const other = rightById.get(incident.id);
			if (!other) return false;
			if (
				incident.type !== other.type ||
				incident.priority !== other.priority ||
				incident.msg !== other.msg ||
				incident.lat !== other.lat ||
				incident.lng !== other.lng ||
				incident.loc !== other.loc ||
				incident.author !== other.author ||
				incident.time !== other.time
			) {
				return false;
			}

			const leftVotes = incident.votes ?? {};
			const rightVotes = other.votes ?? {};
			const leftVoteEntries = Object.entries(leftVotes);
			const rightVoteEntries = Object.entries(rightVotes);
			if (leftVoteEntries.length !== rightVoteEntries.length) return false;
			for (const [peerId, vote] of leftVoteEntries) {
				if (rightVotes[peerId] !== vote) return false;
			}
		}

		return true;
	}

	useEffect(() => {
		setMounted(true);
		const saved = localStorage.getItem("gd_profile");
		if (saved) setProfile(JSON.parse(saved));
		else setShowOnboard(true);
		const savedInc = localStorage.getItem("gd_incidents");
		if (savedInc) setIncidents(JSON.parse(savedInc));
		const savedChat = localStorage.getItem("gd_chats");
		if (savedChat) {
			const parsed = JSON.parse(savedChat) as Record<string, ChatMsg[]>;
			const normalized = Object.fromEntries(
				Object.entries(parsed).map(([room, messages]) => [
					room,
					normalizeChatThread(room, messages),
				]),
			) as Record<string, ChatMsg[]>;
			setChatLogs(normalized);
		}
	}, []);

	// Register presence whenever state changes
	useEffect(() => {
		if (!mounted || !profile) return;
		register.mutate({
			peerId: profile.username,
			ip: "client",
			metadata: { incidents, chatLogs, incidentVotes },
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [incidents, chatLogs, incidentVotes, profile]);

	// Ingest incoming direct messages
	useEffect(() => {
		if (!incomingMessages?.length || !profile) return;
		setChatLogs((prev) => {
			const updated = { ...prev };
			let changed = false;
			incomingMessages.forEach((m) => {
				if (m.from === profile.username) return; // skip own messages
				try {
					const p = JSON.parse(String(m.data));
					if (p.type !== "INCIDENT_CHAT") return;
					const room = p.data.incidentId as string;
					const msgId = getChatMessageId(
						room,
						{
							msgId: typeof p.data.msgId === "string" ? p.data.msgId : m.id,
							time: m.timestamp,
							from: m.from,
							text: String(p.data.text ?? ""),
						},
						updated[room]?.length ?? 0,
					);
					if (!updated[room]) updated[room] = [];
					if (!updated[room].some((x) => x.msgId === msgId)) {
						updated[room].push({
							from: m.from,
							text: p.data.text,
							image: p.data.image,
							time: m.timestamp,
							msgId,
						});
						changed = true;
					}
				} catch {
					/* malformed message — ignore */
				}
			});
			if (changed) {
				localStorage.setItem("gd_chats", JSON.stringify(updated));
				return updated;
			}
			return prev;
		});
	}, [incomingMessages, profile]);

	useEffect(() => {
		if (!incomingMessages?.length || !profile) return;

		setIncidentVotes((prev) => {
			let changed = false;
			const next = { ...prev };

			for (const message of incomingMessages) {
				if (message.from === profile.username) continue;

				try {
					const payload = JSON.parse(String(message.data)) as {
						type?: string;
						data?: {
							incidentId?: string;
							vote?: VoteValue;
							voterId?: string;
						};
					};

					if (payload.type !== "INCIDENT_VOTE") continue;

					const incidentId = payload.data?.incidentId;
					if (!incidentId) continue;

					const voterId = payload.data?.voterId ?? message.from;
					const vote = payload.data?.vote === -1 ? -1 : 1;

					const existing = next[incidentId] ?? {};
					if (existing[voterId] === vote) continue;

					next[incidentId] = {
						...existing,
						[voterId]: vote,
					};
					changed = true;
				} catch {
					/* */
				}
			}

			return changed ? next : prev;
		});
	}, [incomingMessages, profile]);

	useEffect(() => {
		if (!peers || !profile) return;

		const peerSnapshots = peers.flatMap((peer) =>
			((peer.metadata?.incidents as Incident[]) ?? []).map((incident) => ({
				...incident,
				author: peer.peerId,
			})),
		);

		setIncidents((prev) => {
			const merged = mergeIncidentSnapshots(prev, peerSnapshots);
			if (incidentsAreEqual(prev, merged)) return prev;
			localStorage.setItem("gd_incidents", JSON.stringify(merged));
			return merged;
		});

		setIncidentVotes((prev) => {
			let changed = false;
			const next = { ...prev };

			for (const peer of peers) {
				const peerVotes = peer.metadata?.incidentVotes as
					| Record<string, Record<string, VoteValue>>
					| undefined;
				if (!peerVotes) continue;

				for (const [incidentId, votes] of Object.entries(peerVotes)) {
					const mergedVotes = mergeVotes(next[incidentId], votes);
					const currentVotes = next[incidentId] ?? {};
					if (
						Object.keys(currentVotes).length ===
							Object.keys(mergedVotes).length &&
						Object.entries(mergedVotes).every(
							([peerId, vote]) => currentVotes[peerId] === vote,
						)
					) {
						continue;
					}

					next[incidentId] = mergedVotes;
					changed = true;
				}
			}

			if (!changed) return prev;
			return next;
		});
	}, [peers, profile]);

	// Merge chat history from peer metadata; skip self to avoid duplicates
	useEffect(() => {
		if (!peers || !profile) return;
		setChatLogs((prev) => {
			let changed = false;
			const merged = { ...prev };
			peers
				.filter((p) => p.peerId !== profile.username)
				.forEach((p) => {
					const peerChats = (p.metadata?.chatLogs ?? {}) as Record<
						string,
						ChatMsg[]
					>;
					Object.entries(peerChats).forEach(([roomId, msgs]) => {
						const room = normalizeChatThread(roomId, merged[roomId] ?? []);
						const peerThread = normalizeChatThread(roomId, msgs);
						const dedupedRoom = [...room];
						peerThread.forEach((msg) => {
							if (!dedupedRoom.some((x) => x.msgId === msg.msgId)) {
								dedupedRoom.push(msg);
								changed = true;
							}
						});
						merged[roomId] = dedupedRoom;
					});
				});
			if (changed) {
				localStorage.setItem("gd_chats", JSON.stringify(merged));
				return merged;
			}
			return prev;
		});
	}, [peers, profile]);

	// Scroll chat to bottom on new messages
	useEffect(() => {
		chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [chatLogs, selected, rightPanel]);

	// Build merged feed
	let feed: Incident[] = [...incidents];
	if (peers) {
		const peerSnapshots = peers.flatMap((p) =>
			((p.metadata?.incidents as Incident[]) ?? []).map((inc) => ({
				...inc,
				author: p.peerId,
			})),
		);
		feed = mergeIncidentSnapshots(feed, peerSnapshots);
	}
	const w: Record<string, number> = { HIGH: 3, MED: 2, LOW: 1 };
	feed.sort((a, b) => {
		const pDiff =
			(PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0);
		if (pDiff !== 0) return pDiff;
		return (
			parseFloat(haversine(base.lat, base.lng, a.lat, a.lng)) -
			parseFloat(haversine(base.lat, base.lng, b.lat, b.lng))
		);
	});

	const selectedInc = feed.find((i) => i.id === selected) ?? null;
	const activeChat = selected ? (chatLogs[selected] ?? []) : [];
	const getVisibleVotes = (incident: Incident) => ({
		...mergeVotes(incident.votes, incidentVotes[incident.id]),
	});

	const handleVote = async (incident: Incident, vote: VoteValue) => {
		if (!profile) return;

		flushSync(() => {
			setIncidentVotes((prev) => ({
				...prev,
				[incident.id]: {
					...(prev[incident.id] ?? {}),
					[profile.username]: vote,
				},
			}));
			setIncidents((prev) => {
				const updated = prev.map((item) =>
					item.id === incident.id
						? {
								...item,
								votes: {
									...(item.votes ?? {}),
									[profile.username]: vote,
								},
							}
						: item,
				);
				localStorage.setItem("gd_incidents", JSON.stringify(updated));
				return updated;
			});
		});

		if (incident.author === profile.username) return;

		const recipients = Array.from(
			new Set(
				[...(peers ?? []).map((peer) => peer.peerId), incident.author].filter(
					(peerId) => peerId && peerId !== profile.username,
				),
			),
		);

		await Promise.all(
			recipients.map((to) =>
				sendMessage.mutateAsync({
					from: profile.username,
					to,
					type: "DIRECT_MESSAGE",
					data: JSON.stringify({
						type: "INCIDENT_VOTE",
						data: {
							incidentId: incident.id,
							vote,
							voterId: profile.username,
						},
					}),
				}),
			),
		);
	};

	const handleSelect = async (inc: Incident) => {
		if (selected === inc.id && rightPanel === "map") {
			setSelected(null);
			setRoute(null);
			return;
		}
		setSelected(inc.id);
		setRightPanel("map");
		setRoute(null);
		setRouting(true);
		try {
			const r = await fetch(
				`https://router.project-osrm.org/route/v1/driving/${base.lng},${base.lat};${inc.lng},${inc.lat}?overview=full&geometries=geojson`,
			);
			const d = await r.json();
			if (d.routes?.[0])
				setRoute({
					geojson: d.routes[0].geometry,
					eta: Math.ceil(d.routes[0].duration / 60),
				});
		} catch {
			/* routing failed — silent */
		} finally {
			setRouting(false);
		}
	};

	const openChat = (incId: string) => {
		setSelected(incId);
		setRightPanel("chat");
	};

	const handleSendChat = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selected || !profile) return;
		if (!chatInput.trim() && !chatImage) return;

		const text = chatInput.trim();
		const image = chatImage ?? undefined;
		setChatInput("");
		setChatImage(null);
		const now = Date.now();
		const msgId = Math.random().toString(36).slice(2, 11);

		setChatLogs((prev) => {
			const updated = {
				...prev,
				[selected]: [
					...(prev[selected] ?? []),
					{ from: profile.username, text, time: now, msgId, image },
				],
			};
			localStorage.setItem("gd_chats", JSON.stringify(updated));
			return updated;
		});

		if (peers && (text || image)) {
			const payload = JSON.stringify({
				type: "INCIDENT_CHAT",
				data: { incidentId: selected, text, image: image ?? null, msgId },
			});
			const uniquePeers = peers
				.filter((p) => p.peerId !== profile.username)
				.filter(
					(p, i, arr) => arr.findIndex((x) => x.peerId === p.peerId) === i,
				);
			await Promise.all(
				uniquePeers.map((p) =>
					sendMessage.mutateAsync({
						from: profile.username,
						to: p.peerId,
						type: "DIRECT_MESSAGE",
						data: payload,
					}),
				),
			);
		}
	};

	const handlePost = (e: React.FormEvent) => {
		e.preventDefault();
		if (!postMsg.trim() || !postCoord) return;
		const newInc: Incident = {
			id: Math.random().toString(36).slice(2, 9),
			type: postType,
			priority: postType === "OFFER" ? "LOW" : postPriority,
			msg: postMsg.trim(),
			lat: postCoord.lat,
			lng: postCoord.lng,
			loc: `${postCoord.lat.toFixed(3)}, ${postCoord.lng.toFixed(3)}`,
			author: profile?.username ?? "ANON",
			time: new Date().toLocaleTimeString(),
		};
		const updated = [newInc, ...incidents];
		setIncidents(updated);
		localStorage.setItem("gd_incidents", JSON.stringify(updated));
		setPostMsg("");
		setPostCoord(null);
		setPostStep("form");
	};

	const handleResolve = (id: string) => {
		const remaining = incidents.filter((i) => i.id !== id);
		setIncidents(remaining);
		localStorage.setItem("gd_incidents", JSON.stringify(remaining));
		setSelected(null);
		setRoute(null);
		setRightPanel("map");
		setChatLogs((prev) => {
			const withoutResolved = { ...prev };
			delete withoutResolved[id];
			localStorage.setItem("gd_chats", JSON.stringify(withoutResolved));
			return withoutResolved;
		});
	};

	const handleSaveProfile = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!hqDraft) return;
		const parsed = profileSchema.safeParse({
			username: obUsername,
			age: obAge === "" ? undefined : Number(obAge),
			skills: obSkills,
		});
		if (!parsed.success) {
			const errs: ProfileErrors = {};
			parsed.error.errors.forEach((err) => {
				const key = err.path[0] as keyof ProfileErrors;
				if (!errs[key]) errs[key] = err.message;
			});
			setObErrors(errs);
			return;
		}
		setObErrors({});
		const p = {
			username: parsed.data.username.toUpperCase(),
			role: parsed.data.skills.slice(0, 2).join(" / "),
			lat: hqDraft.lat,
			lng: hqDraft.lng,
		};
		setProfile(p);
		localStorage.setItem("gd_profile", JSON.stringify(p));
		setShowOnboard(false);
	};

	if (!mounted) return null;

	// ─── Render ───────────────────────────────────────────────────────────────
	return (
		<>
			<style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap');
        .gd { font-family: 'IBM Plex Mono', monospace; }
        @keyframes gd-pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes gd-in { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:none} }
        .gd-live { animation: gd-pulse 2s ease-in-out infinite; }
        .gd-in { animation: gd-in 0.18s ease-out both; }
        .gd-row { transition: background 0.1s; cursor: pointer; }
        .gd-row:hover { background: rgba(255,255,255,0.025); }
        .gd-row.active { background: rgba(255,255,255,0.04); }
      `}</style>

			<div className="gd flex h-screen flex-col overflow-hidden bg-[#0c0c0c] text-white">
				{/* ── Header ──────────────────────────────────────────────────────── */}
				<header className="flex shrink-0 items-center justify-between border-b border-white/6 px-6 py-3.5">
					<div className="flex items-center gap-4">
						<span className="text-base font-medium tracking-widest text-red-500">
							GRIDDOWN
						</span>

						<div className="flex items-center gap-1.5">
							<span className="gd-live h-1.5 w-1.5 rounded-full bg-red-500" />
							<span className="text-[10px] tracking-[0.2em] text-white/40">
								{feed.length} {feed.length === 1 ? "TASK" : "TASKS"}
							</span>
						</div>

						<div className="h-3 w-px bg-white/8" />

						<div className="flex items-center gap-1.5">
							<span
								className="gd-live h-1.5 w-1.5 rounded-full bg-green-400"
								style={{ boxShadow: "0 0 4px rgba(74,222,128,0.5)" }}
							/>
							<span className="text-[10px] tracking-[0.2em] text-white/40">
								{(peers?.length ?? 0) + (profile ? 1 : 0)} ONLINE
							</span>
						</div>

						<div className="h-3 w-px bg-white/8" />

						<span className="text-[10px] tracking-[0.2em] text-white/40">
							{
								feed.filter(
									(i) => i.type === "REQUEST" && i.priority === "HIGH",
								).length
							}{" "}
							HIGH PRIORITY
						</span>
					</div>

					<div className="flex items-center gap-5">
						{profile ? (
							<>
								<span className="text-[11px] text-white/50">
									<span className="text-white/60">{profile.username}</span>
									{" · "}
									{profile.role}
								</span>
								<button
									className="text-[10px] tracking-widest text-white/35 transition-colors hover:text-red-500"
									onClick={() => {
										localStorage.removeItem("gd_profile");
										window.location.reload();
									}}
								>
									RESET
								</button>
							</>
						) : (
							<button
								className="border border-white/10 px-4 py-1.5 text-[10px] tracking-[0.2em] text-white/40 transition-colors hover:border-red-800/50 hover:text-red-500"
								onClick={() => setShowOnboard(true)}
							>
								SET PROFILE
							</button>
						)}
					</div>
				</header>

				{/* ── Body ────────────────────────────────────────────────────────── */}
				<div className="flex flex-1 overflow-hidden">
					{/* ── Left panel: post form + feed ──────────────────────────────── */}
					<div className="flex w-96 shrink-0 flex-col border-r border-white/6">
						{/* Post form */}
						<div className="shrink-0 border-b border-white/6 p-4">
							{postStep === "form" ? (
								<div className="flex flex-col gap-3">
									<textarea
										className="w-full resize-none bg-transparent px-3 py-2.5 text-[11px] leading-relaxed text-white/70 outline-none placeholder:text-white/20 transition-colors focus:bg-white/3"
										onChange={(e) => setPostMsg(e.target.value)}
										placeholder="Describe the situation..."
										rows={2}
										style={{ border: "1px solid rgba(255,255,255,0.2)" }}
										value={postMsg}
									/>
									<div className="flex flex-col gap-1.5">
										<div className="flex items-center gap-1.5">
											{(["REQUEST", "OFFER", "ANNOUNCE"] as const).map((t) => (
												<button
													className="px-2 py-1 text-[9px] tracking-widest transition-colors"
													key={t}
													onClick={() => setPostType(t)}
													style={{
														border: `1px solid ${postType === t ? TYPE_COLOR[t] + "55" : "rgba(255,255,255,0.2)"}`,
														color:
															postType === t
																? TYPE_COLOR[t]
																: "rgba(255,255,255,0.75)",
														background:
															postType === t
																? TYPE_COLOR[t] + "0f"
																: "transparent",
													}}
												>
													{TYPE_LABEL[t]}
												</button>
											))}
											<button
												className="ml-auto px-3 py-1 text-[10px] tracking-widest transition-all disabled:opacity-25"
												disabled={!postMsg.trim()}
												onClick={() => setPostStep("map")}
												style={{
													border: "1px solid rgba(239,68,68,0.35)",
													color: "#f87171",
													background: "rgba(239,68,68,0.06)",
												}}
											>
												POST →
											</button>
										</div>
										{postType === "REQUEST" && (
											<div className="flex items-center gap-1.5">
												{(["HIGH", "MED", "LOW"] as const).map((p) => (
													<button
														className="px-2 py-1 text-[9px] tracking-widest transition-colors"
														key={p}
														onClick={() => setPostPriority(p)}
														style={{
															border: `1px solid ${postPriority === p ? PRIORITY_DOT[p] + "55" : "rgba(255,255,255,0.2)"}`,
															color:
																postPriority === p
																	? PRIORITY_DOT[p]
																	: "rgba(255,255,255,0.75)",
															background:
																postPriority === p
																	? PRIORITY_DOT[p] + "0f"
																	: "transparent",
														}}
													>
														{p}
													</button>
												))}
											</div>
										)}
									</div>
								</div>
							) : (
								<div className="flex items-center justify-between">
									<span className="text-[10px] tracking-[0.2em] text-amber-400/70">
										{postCoord
											? `✓ ${postCoord.lat.toFixed(3)}, ${postCoord.lng.toFixed(3)}`
											: "CLICK MAP TO PIN"}
									</span>
									<div className="flex gap-3">
										<button
											className="text-[10px] tracking-widest text-white/20 transition-colors hover:text-white/50"
											onClick={() => {
												setPostStep("form");
												setPostCoord(null);
											}}
										>
											BACK
										</button>
										{postCoord && (
											<button
												className="px-3 py-1 text-[10px] tracking-widest"
												onClick={handlePost as any}
												style={{
													border: "1px solid rgba(34,197,94,0.4)",
													color: "#4ade80",
													background: "rgba(34,197,94,0.06)",
												}}
											>
												SEND
											</button>
										)}
									</div>
								</div>
							)}
						</div>

						{/* Feed */}
						<div className="flex-1 overflow-y-auto">
							{feed.length === 0 && (
								<div className="flex h-32 items-center justify-center">
									<span className="text-[10px] tracking-[0.3em] text-white/15">
										NO TRANSMISSIONS
									</span>
								</div>
							)}
							{feed.map((inc, i) => (
								<div
									className={`gd-row gd-in border-b border-white/4 ${selected === inc.id ? "active" : ""}`}
									key={inc.id}
									onClick={() => handleSelect(inc)}
									style={{ animationDelay: `${i * 25}ms` }}
								>
									<div className="px-4 py-3.5">
										<div className="flex items-start gap-2.5">
											{/* Priority dot */}
											<span
												className="mt-1.25 h-1.5 w-1.5 shrink-0 rounded-full"
												style={{ background: PRIORITY_DOT[inc.priority] }}
											/>
											<div className="min-w-0 flex-1">
												{/* Type label + message */}
												<div className="mb-1 flex items-center gap-2">
													<span
														className="shrink-0 text-[9px] tracking-widest"
														style={{ color: TYPE_COLOR[inc.type] + "bb" }}
													>
														{TYPE_LABEL[inc.type]}
													</span>
													<span className="truncate text-[11px] leading-relaxed text-white/70">
														{inc.msg}
													</span>
												</div>
												{/* Meta row */}
												<div className="flex items-center gap-3">
													<span className="text-[9px] text-white/40">
														{inc.author}
													</span>
													<span className="text-[9px] text-white/35">
														{timeAgo(inc.time)}
													</span>
													<div className="ml-auto flex items-center gap-2">
														<span
															className="shrink-0 text-[9px] tracking-widest"
															style={{
																color: PRIORITY_DOT[inc.priority],
																opacity: 0.8,
															}}
														>
															{inc.priority}
														</span>
														<span className="text-[9px] text-white/40">
															{haversine(base.lat, base.lng, inc.lat, inc.lng)}
															km
														</span>
														{(() => {
															const visibleVotes = getVisibleVotes(inc);
															const { upvotes, downvotes } =
																getVoteTotals(visibleVotes);
															const currentVote =
																profile?.username && visibleVotes
																	? visibleVotes[profile.username]
																	: undefined;

															return (
																<>
																	<button
																		className="rounded border px-2 py-0.5 text-[9px]"
																		onClick={(e) => {
																			e.stopPropagation();
																			void handleVote(inc, 1);
																		}}
																		style={{
																			borderColor: "rgba(34,197,94,0.18)",
																			color:
																				currentVote === 1
																					? "#4ade80"
																					: "rgba(74,222,128,0.65)",
																			background: "rgba(34,197,94,0.04)",
																		}}
																		type="button"
																	>
																		▲ {upvotes}
																	</button>
																	<button
																		className="rounded border px-2 py-0.5 text-[9px]"
																		onClick={(e) => {
																			e.stopPropagation();
																			void handleVote(inc, -1);
																		}}
																		style={{
																			borderColor: "rgba(239,68,68,0.18)",
																			color:
																				currentVote === -1
																					? "#f87171"
																					: "rgba(248,113,113,0.65)",
																			background: "rgba(239,68,68,0.04)",
																		}}
																		type="button"
																	>
																		▼ {downvotes}
																	</button>
																</>
															);
														})()}
													</div>
												</div>
											</div>
										</div>

										{/* Expanded actions */}
										{selected === inc.id && (
											<div className="gd-in mt-3 flex items-center gap-2 pl-4">
												{routing && (
													<span className="gd-live text-[9px] text-amber-400/60">
														routing…
													</span>
												)}
												{route && !routing && (
													<span className="text-[9px] text-green-400/70">
														ETA {route.eta} min
													</span>
												)}
												<div className="ml-auto flex gap-2">
													<button
														className="px-2.5 py-1 text-[9px] tracking-widest text-white/50 transition-colors hover:text-white/60"
														onClick={(e) => {
															e.stopPropagation();
															openChat(inc.id);
														}}
														style={{
															border: "1px solid rgba(255,255,255,0.2)",
														}}
													>
														CHAT
													</button>
													{inc.author === profile?.username && (
														<button
															className="px-2.5 py-1 text-[9px] tracking-widest transition-colors"
															onClick={(e) => {
																e.stopPropagation();
																handleResolve(inc.id);
															}}
															style={{
																border: "1px solid rgba(34,197,94,0.25)",
																color: "rgba(74,222,128,0.55)",
															}}
														>
															RESOLVE
														</button>
													)}
												</div>
											</div>
										)}
									</div>
								</div>
							))}
						</div>
					</div>

					{/* ── Right panel: map or chat ───────────────────────────────────── */}
					<div className="relative flex flex-1 flex-col overflow-hidden">
						{rightPanel === "chat" && selectedInc ? (
							/* Chat view */
							<div className="flex h-full flex-col">
								<div className="flex shrink-0 items-center justify-between border-b border-white/6 px-5 py-3.5">
									<div>
										<div className="flex items-center gap-2.5">
											<span
												className="text-[9px] tracking-widest"
												style={{ color: TYPE_COLOR[selectedInc.type] }}
											>
												{TYPE_LABEL[selectedInc.type]}
											</span>
											<span className="max-w-sm truncate text-[12px] text-white/60">
												{selectedInc.msg}
											</span>
										</div>
										<p className="mt-0.5 text-[9px] text-white/40">
											{selectedInc.loc} · {selectedInc.author}
										</p>
									</div>
									<button
										className="px-3 py-1.5 text-[10px] tracking-widest text-white/50 transition-colors hover:text-white/55"
										onClick={() => setRightPanel("map")}
										style={{ border: "1px solid rgba(255,255,255,0.2)" }}
									>
										← MAP
									</button>
								</div>

								<div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
									{activeChat.length === 0 && (
										<div className="flex h-24 items-center justify-center">
											<span className="text-[10px] tracking-[0.25em] text-white/50">
												NO MESSAGES YET
											</span>
										</div>
									)}
									{activeChat.map((msg, idx) => {
										const isMe = msg.from === profile?.username;
										return (
											<div
												className={`gd-in flex flex-col ${isMe ? "items-end" : "items-start"}`}
												key={idx}
											>
												<span className="mb-1 text-[9px] text-white/25">
													{msg.from} · {new Date(msg.time).toLocaleTimeString()}
												</span>
												<div
													className="max-w-[78%] px-3.5 py-2.5 text-[11px] leading-relaxed"
													style={{
														background: isMe
															? "rgba(255,255,255,0.04)"
															: "rgba(239,68,68,0.06)",
														border: isMe
															? "1px solid rgba(255,255,255,0.2)"
															: "1px solid rgba(239,68,68,0.15)",
														color: "rgba(255,255,255,0.65)",
													}}
												>
													{msg.image && (
														<img
															alt=""
															className="mb-2 max-w-full"
															src={msg.image}
															style={{
																maxHeight: 200,
																border: "1px solid rgba(255,255,255,0.06)",
															}}
														/>
													)}
													{msg.text && <span>{msg.text}</span>}
												</div>
											</div>
										);
									})}
									<div ref={chatBottomRef} />
								</div>

								<form
									className="flex shrink-0 flex-col gap-2 border-t border-white/6 p-3"
									onSubmit={handleSendChat}
								>
									{chatImage && (
										<div className="relative w-fit">
											<img
												alt="attachment"
												className="max-h-24 max-w-[200px] object-cover"
												src={chatImage}
												style={{ border: "1px solid rgba(255,255,255,0.08)" }}
											/>
											<button
												className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#0c0c0c] text-[9px] text-white/40 hover:text-white/70"
												onClick={() => setChatImage(null)}
												style={{ border: "1px solid rgba(255,255,255,0.1)" }}
												type="button"
											>
												✕
											</button>
										</div>
									)}
									<div className="flex items-center gap-2">
										<button
											className="shrink-0 px-2 py-2.5 text-[10px] text-white/20 transition-colors hover:text-white/50"
											onClick={() => chatFileRef.current?.click()}
											style={{ border: "1px solid rgba(255,255,255,0.2)" }}
											type="button"
										>
											＋
										</button>
										<input
											accept="image/*"
											className="hidden"
											onChange={(e) => {
												const file = e.target.files?.[0];
												if (!file) return;
												const reader = new FileReader();
												reader.onload = () =>
													setChatImage(reader.result as string);
												reader.readAsDataURL(file);
											}}
											ref={chatFileRef}
											type="file"
										/>
										<input
											className="flex-1 bg-transparent px-3 py-2.5 text-[11px] text-white/70 outline-none placeholder:text-white/20 transition-colors focus:bg-white/3"
											onChange={(e) => setChatInput(e.target.value)}
											placeholder="Send a message..."
											style={{ border: "1px solid rgba(255,255,255,0.2)" }}
											value={chatInput}
										/>
										<button
											className="px-4 py-2.5 text-[10px] tracking-widest transition-all disabled:opacity-25"
											disabled={!chatInput.trim() && !chatImage}
											style={{
												border: "1px solid rgba(239,68,68,0.35)",
												color: "#f87171",
												background: "rgba(239,68,68,0.06)",
											}}
											type="submit"
										>
											SEND
										</button>
									</div>
								</form>
							</div>
						) : (
							/* Map view */
							<div className="relative h-full w-full">
								<MapGL
									attributionControl={false}
									initialViewState={{
										longitude: base.lng,
										latitude: base.lat,
										zoom: 11.5,
										pitch: 30,
									}}
									mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
									onClick={(e) => {
										if (postStep === "map")
											setPostCoord({ lat: e.lngLat.lat, lng: e.lngLat.lng });
									}}
									style={{
										cursor: postStep === "map" ? "crosshair" : "default",
									}}
								>
									{/* Route line */}
									{route && (
										<Source data={route.geojson} id="route" type="geojson">
											<Layer
												id="route-line"
												layout={{ "line-cap": "round", "line-join": "round" }}
												paint={{
													"line-color": "#22c55e",
													"line-width": 2,
													"line-opacity": 0.6,
												}}
												type="line"
											/>
										</Source>
									)}

									{/* Own location marker */}
									<Marker
										anchor="center"
										latitude={base.lat}
										longitude={base.lng}
									>
										<div className="relative flex h-5 w-5 items-center justify-center">
											<span className="absolute inset-0 rounded-full bg-green-500/15 gd-live" />
											<span
												className="h-2 w-2 rounded-full bg-green-400"
												style={{ boxShadow: "0 0 6px rgba(74,222,128,0.5)" }}
											/>
										</div>
									</Marker>

									{/* Incident markers */}
									{feed.map((inc) => {
										const color = TYPE_COLOR[inc.type] ?? "#ef4444";
										const isActive = selected === inc.id;
										return (
											<Marker
												anchor="center"
												key={inc.id}
												latitude={inc.lat}
												longitude={inc.lng}
											>
												<button
													className="relative flex items-center justify-center"
													onClick={() => handleSelect(inc)}
													style={{
														width: isActive ? 28 : 20,
														height: isActive ? 28 : 20,
													}}
												>
													{isActive && (
														<span
															className="absolute inset-0 rounded-full"
															style={{
																background: color + "1a",
																animation: "gd-pulse 1.5s ease-in-out infinite",
															}}
														/>
													)}
													<span
														className="block rotate-45"
														style={{
															width: isActive ? 10 : 7,
															height: isActive ? 10 : 7,
															background: color,
															boxShadow: `0 0 ${isActive ? 10 : 5}px ${color}70`,
															transition: "all 0.15s",
														}}
													/>
												</button>
											</Marker>
										);
									})}

									{/* Post pin preview */}
									{postCoord && (
										<Marker
											anchor="center"
											latitude={postCoord.lat}
											longitude={postCoord.lng}
										>
											<div className="relative flex h-5 w-5 items-center justify-center">
												<span className="absolute inset-0 rounded-full bg-amber-400/15 gd-live" />
												<span className="h-2 w-2 rounded-full bg-amber-400" />
											</div>
										</Marker>
									)}
								</MapGL>

								{/* Selected incident info bar */}
								{selectedInc && (
									<div
										className="gd-in absolute bottom-4 left-4 right-4 px-4 py-3.5"
										style={{
											background: "rgba(12,12,12,0.94)",
											border: "1px solid rgba(255,255,255,0.2)",
											backdropFilter: "blur(10px)",
										}}
									>
										<div className="flex items-start justify-between gap-4">
											<div className="min-w-0 flex-1">
												<div className="mb-1.5 flex items-center gap-2.5">
													<span
														className="text-[9px] tracking-widest"
														style={{ color: TYPE_COLOR[selectedInc.type] }}
													>
														{selectedInc.type}
													</span>
													{selectedInc.priority !== "LOW" && (
														<span
															className="text-[9px] tracking-widest"
															style={{
																color: PRIORITY_DOT[selectedInc.priority],
															}}
														>
															{selectedInc.priority}
														</span>
													)}
													{route && (
														<span className="text-[9px] text-green-400/70">
															{route.eta} min
														</span>
													)}
												</div>
												<p className="text-[12px] leading-relaxed text-white/65">
													{selectedInc.msg}
												</p>
												<p className="mt-1 text-[9px] text-white/25">
													{selectedInc.loc} · {selectedInc.author}
												</p>
											</div>
											<div className="flex flex-col items-end gap-2">
												<button
													className="text-[11px] text-white/20 transition-colors hover:text-white/50"
													onClick={() => {
														setSelected(null);
														setRoute(null);
													}}
												>
													✕
												</button>
												<button
													className="px-2.5 py-1 text-[9px] tracking-widest text-white/50 transition-colors hover:text-white/60"
													onClick={() => openChat(selectedInc.id)}
													style={{ border: "1px solid rgba(255,255,255,0.08)" }}
												>
													CHAT
												</button>
											</div>
										</div>
									</div>
								)}

								{/* Pin location hint */}
								{postStep === "map" && (
									<div
										className="gd-in pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 px-4 py-2"
										style={{
											background: "rgba(12,12,12,0.9)",
											border: "1px solid rgba(251,191,36,0.25)",
											backdropFilter: "blur(8px)",
										}}
									>
										<span className="text-[10px] tracking-[0.2em] text-amber-400/70">
											CLICK TO PIN LOCATION
										</span>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* ── Onboarding modal ──────────────────────────────────────────────── */}
			{showOnboard && (
				<div className="gd fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
					<form
						className="gd-in w-full max-w-sm p-6"
						onSubmit={handleSaveProfile}
						style={{
							background: "#0c0c0c",
							border: "1px solid rgba(255,255,255,0.08)",
							boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
							maxHeight: "90vh",
							overflowY: "auto",
						}}
					>
						<h2 className="mb-1 text-sm tracking-[0.25em] text-white/60">
							YOUR PROFILE
						</h2>
						<p className="mb-6 text-[10px] text-white/40">
							Set your name to get started.
						</p>

						<div className="flex flex-col gap-5">
							{/* Name */}
							<div>
								<label className="mb-1.5 flex items-center justify-between">
									<span className="text-[9px] tracking-[0.25em] text-white/50">
										NAME
									</span>
									{obErrors.username && (
										<span className="text-[9px] text-red-500/70">
											{obErrors.username}
										</span>
									)}
								</label>
								<input
									className="w-full bg-transparent px-3 py-2.5 text-[12px] uppercase text-white/75 outline-none placeholder:text-white/15 transition-colors focus:bg-white/3"
									onChange={(e) => {
										setObUsername(e.target.value.toUpperCase());
										setObErrors((prev) => ({ ...prev, username: undefined }));
									}}
									placeholder="e.g. ALEX"
									style={{
										border: `1px solid ${obErrors.username ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.2)"}`,
									}}
									value={obUsername}
								/>
							</div>

							{/* Age */}
							<div>
								<label className="mb-1.5 flex items-center justify-between">
									<span className="text-[9px] tracking-[0.25em] text-white/50">
										AGE
									</span>
									{obErrors.age && (
										<span className="text-[9px] text-red-500/70">
											{obErrors.age}
										</span>
									)}
								</label>
								<input
									className="w-full bg-transparent px-3 py-2.5 text-[12px] text-white/75 outline-none placeholder:text-white/15 transition-colors focus:bg-white/3"
									max={99}
									min={16}
									onChange={(e) => {
										setObAge(e.target.value);
										setObErrors((prev) => ({ ...prev, age: undefined }));
									}}
									placeholder="e.g. 34"
									style={{
										border: `1px solid ${obErrors.age ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.2)"}`,
									}}
									type="number"
									value={obAge}
								/>
							</div>

							{/* Skills */}
							<div>
								<label className="mb-1.5 flex items-center justify-between">
									<span className="text-[9px] tracking-[0.25em] text-white/50">
										SKILLS
									</span>
									{obErrors.skills && (
										<span className="text-[9px] text-red-500/70">
											{obErrors.skills}
										</span>
									)}
								</label>

								{obSkills.length > 0 && (
									<div
										className="mb-2 flex flex-wrap gap-1.5 p-2"
										style={{
											border: "1px solid rgba(255,255,255,0.05)",
											background: "rgba(255,255,255,0.02)",
										}}
									>
										{obSkills.map((skill) => (
											<button
												className="flex items-center gap-1.5 px-2 py-0.5 text-[9px] tracking-wide transition-all hover:opacity-70"
												key={skill}
												onClick={() =>
													setObSkills((prev) => prev.filter((s) => s !== skill))
												}
												style={{
													background: "rgba(239,68,68,0.1)",
													border: "1px solid rgba(239,68,68,0.3)",
													color: "#f87171",
												}}
												type="button"
											>
												{skill}
												<span className="text-red-500/50">✕</span>
											</button>
										))}
									</div>
								)}

								<input
									className="mb-2 w-full bg-transparent px-3 py-2 text-[11px] text-white/60 outline-none placeholder:text-white/15 transition-colors focus:bg-white/3"
									onChange={(e) => setSkillSearch(e.target.value)}
									placeholder="Search skills..."
									style={{ border: "1px solid rgba(255,255,255,0.06)" }}
									value={skillSearch}
								/>

								<div
									className="flex flex-wrap gap-1.5 overflow-y-auto"
									style={{ maxHeight: 120 }}
								>
									{SKILL_OPTIONS.filter(
										(s) =>
											s.toLowerCase().includes(skillSearch.toLowerCase()) &&
											!obSkills.includes(s),
									).map((skill) => (
										<button
											className="px-2 py-0.5 text-[9px] tracking-wide transition-all hover:border-white/20 hover:text-white/50"
											key={skill}
											onClick={() => {
												setObSkills((prev) => [...prev, skill]);
												setObErrors((prev) => ({ ...prev, skills: undefined }));
											}}
											style={{
												border: "1px solid rgba(255,255,255,0.2)",
												color: "rgba(255,255,255,0.25)",
											}}
											type="button"
										>
											+ {skill}
										</button>
									))}
								</div>
							</div>

							{/* Location */}
							<div>
								<label className="mb-1.5 block text-[9px] tracking-[0.25em] text-white/50">
									YOUR LOCATION{" "}
									<span className="text-white/15">(click map)</span>
								</label>
								<div
									className="relative overflow-hidden"
									style={{
										height: 150,
										border: "1px solid rgba(255,255,255,0.2)",
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
											setHqDraft({ lat: e.lngLat.lat, lng: e.lngLat.lng })
										}
										style={{ cursor: "crosshair" }}
									>
										{hqDraft && (
											<Marker
												anchor="center"
												latitude={hqDraft.lat}
												longitude={hqDraft.lng}
											>
												<span
													className="block h-2.5 w-2.5 rounded-full bg-green-400"
													style={{ boxShadow: "0 0 8px rgba(74,222,128,0.7)" }}
												/>
											</Marker>
										)}
									</MapGL>
									{!hqDraft && (
										<div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
											<span className="text-[10px] tracking-[0.3em] text-white/50">
												CLICK TO SET
											</span>
										</div>
									)}
								</div>
								{hqDraft && (
									<p className="mt-1 text-[9px] text-green-500/60">
										✓ {hqDraft.lat.toFixed(4)}, {hqDraft.lng.toFixed(4)}
									</p>
								)}
							</div>
						</div>

						<div className="mt-6 flex justify-end gap-3">
							<button
								className="px-5 py-2 text-[10px] tracking-widest transition-all disabled:opacity-25"
								disabled={!hqDraft}
								style={{
									border: "1px solid rgba(239,68,68,0.4)",
									color: "#f87171",
									background: "rgba(239,68,68,0.06)",
								}}
								type="submit"
							>
								JOIN
							</button>
						</div>
					</form>
				</div>
			)}
		</>
	);
}
