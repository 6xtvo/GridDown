"use client";

import { useState } from "react";

const STEPS = [
	{
		num: "01",
		label: "CREATE PROFILE",
		color: "#ef4444",
		glowColor: "rgba(239,68,68,0.35)",
		textClass: "text-red-400",
		activeBg: "bg-red-500/10",
		bgClass: "bg-red-500/5",
		dot: "bg-red-500",
		description:
			'Authenticate your name and skillset on the local node. Hit "CREATE PROFILE" in the nav to initialize your identity and set your location on the map.',
	},
	{
		num: "02",
		label: "OVERVIEW MAP",
		color: "#22c55e",
		glowColor: "rgba(34,197,94,0.35)",
		textClass: "text-green-400",
		activeBg: "bg-green-500/10",
		bgClass: "bg-green-500/5",
		dot: "bg-green-500",
		description:
			"Click any incident in the feed or tap a marker to lock target coordinates and auto-calculate your drive route + ETA from your location.",
	},
	{
		num: "03",
		label: "POST",
		color: "#eab308",
		glowColor: "rgba(234,179,8,0.35)",
		textClass: "text-yellow-400",
		activeBg: "bg-yellow-500/10",
		bgClass: "bg-yellow-500/5",
		dot: "bg-yellow-400",
		description:
			'Open the live P2P network via "POST". Click the map to designate target coordinates, then post a Request, Offer, or Announcement to the network.',
	},
	{
		num: "04",
		label: "CHAT",
		color: "#3b82f6",
		glowColor: "rgba(59,130,246,0.35)",
		textClass: "text-blue-400",
		activeBg: "bg-blue-500/10",
		bgClass: "bg-blue-500/5",
		dot: "bg-blue-400",
		description:
			"Tap any active incident card in the Urgency Board to join its encrypted chat room. Broadcast text and image attachments to all connected users.",
	},
];

export function QuickGuide() {
	const [isOpen, setIsOpen] = useState(false);
	const [activeStep, setActiveStep] = useState<number | null>(null);

	return (
		<>
			<style>{`
				@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
				.qg { font-family: 'Share Tech Mono', 'Courier New', monospace; }
				@keyframes qg-ping { 75%, 100% { transform: scale(1.8); opacity: 0; } }
				@keyframes qg-fade-up {
					from { opacity: 0; transform: translateY(10px) scale(0.98); }
					to   { opacity: 1; transform: translateY(0)   scale(1); }
				}
			`}</style>

			<div className="qg fixed right-5 bottom-5 z-100 flex flex-col items-end">
				{/* ── PANEL ─────────────────────────────────── */}
				{isOpen && (
					<div
						className="relative mb-3 w-84 overflow-hidden"
						style={{
							animation: "qg-fade-up 0.22s ease-out both",
							background: "rgba(4,1,1,0.97)",
							border: "1px solid rgba(220,38,38,0.28)",
							boxShadow:
								"0 0 0 1px rgba(220,38,38,0.06), 0 0 32px rgba(220,38,38,0.1), 0 28px 56px rgba(0,0,0,0.92)",
						}}
					>
						{/* scanlines */}
						<div
							className="pointer-events-none absolute inset-0 z-20"
							style={{
								backgroundImage:
									"repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.09) 3px, rgba(0,0,0,0.09) 4px)",
							}}
						/>

						{/* top glow line */}
						<div
							className="pointer-events-none absolute top-0 inset-x-0 h-px z-20"
							style={{
								background:
									"linear-gradient(90deg,transparent,rgba(220,38,38,0.55),transparent)",
							}}
						/>

						{/* corner accents */}
						{(
							[
								"top-0 left-0 border-t border-l",
								"top-0 right-0 border-t border-r",
								"bottom-0 left-0 border-b border-l",
								"bottom-0 right-0 border-b border-r",
							] as const
						).map((c) => (
							<div
								className={`pointer-events-none absolute h-3 w-3 z-20 ${c}`}
								key={c}
								style={{ borderColor: "rgba(220,38,38,0.35)" }}
							/>
						))}

						{/* Header */}
						<div
							className="relative flex items-center justify-between px-4 py-3"
							style={{
								background:
									"linear-gradient(135deg,rgba(220,38,38,0.1) 0%,transparent 70%)",
								borderBottom: "1px solid rgba(220,38,38,0.12)",
							}}
						>
							<div className="flex items-center gap-3">
								<span className="relative flex h-2 w-2">
									<span
										className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-70"
										style={{
											animation: "qg-ping 1.8s cubic-bezier(0,0,.2,1) infinite",
										}}
									/>
									<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-400" />
								</span>
								<span className="text-[11px] tracking-[0.32em] text-red-400">
									GUIDE
								</span>
								<span
									className="px-1.5 py-px text-[9px] tracking-widest text-red-900"
									style={{ border: "1px solid rgba(220,38,38,0.18)" }}
								>
									v1.0
								</span>
							</div>
							<button
								className="flex h-5 w-5 items-center justify-center text-zinc-600 hover:text-red-400 transition-colors"
								onClick={() => setIsOpen(false)}
								style={{ border: "1px solid rgba(255,255,255,0.05)" }}
								type="button"
							>
								<svg fill="none" height="8" viewBox="0 0 8 8" width="8">
									<path
										d="M1 1L7 7M7 1L1 7"
										stroke="currentColor"
										strokeLinecap="round"
										strokeWidth="1.2"
									/>
								</svg>
							</button>
						</div>

						{/* Steps */}
						<div className="px-3 py-3 space-y-1.5">
							{STEPS.map((s, i) => {
								const open = activeStep === i;
								return (
									<button
										className={`w-full text-left transition-all duration-200 ${open ? s.activeBg : s.bgClass}`}
										key={s.num}
										onClick={() => setActiveStep(open ? null : i)}
										style={{
											border: `1px solid ${open ? s.color + "38" : "rgba(255,255,255,0.04)"}`,
											boxShadow: open
												? `0 0 14px ${s.glowColor}, inset 0 0 12px ${s.glowColor.replace("0.35", "0.04")}`
												: "none",
										}}
										type="button"
									>
										<div className="flex items-center gap-3 px-3 py-2.5">
											<div
												className="shrink-0 flex items-center justify-center w-8 h-5 text-[10px] tracking-widest transition-all duration-200"
												style={{
													border: `1px solid ${open ? s.color + "45" : "rgba(255,255,255,0.06)"}`,
													color: open ? s.color : "rgba(90,90,90,0.9)",
													boxShadow: open ? `0 0 6px ${s.glowColor}` : "none",
												}}
											>
												{s.num}
											</div>
											<span
												className={`h-1 w-1 shrink-0 rounded-full transition-opacity duration-200 ${s.dot} ${open ? "opacity-100" : "opacity-25"}`}
											/>
											<span
												className={`flex-1 text-[10px] tracking-[0.22em] transition-colors duration-200 ${open ? s.textClass : "text-zinc-600"}`}
											>
												{s.label}
											</span>
											<svg
												className={`shrink-0 transition-all duration-200 ${open ? s.textClass : "text-zinc-800"}`}
												fill="none"
												height="7"
												style={{
													transform: open ? "rotate(90deg)" : "rotate(0deg)",
												}}
												viewBox="0 0 7 7"
												width="7"
											>
												<path
													d="M1.5 1L5.5 3.5L1.5 6"
													stroke="currentColor"
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth="1"
												/>
											</svg>
										</div>

										<div
											style={{
												maxHeight: open ? "140px" : "0",
												overflow: "hidden",
												transition: "max-height 0.22s ease",
											}}
										>
											<p
												className="px-3 pb-3 text-[10px] leading-[1.8] text-zinc-500"
												style={{
													borderTop: `1px solid ${s.color}14`,
													paddingTop: "10px",
												}}
											>
												{s.description}
											</p>
										</div>
									</button>
								);
							})}
						</div>

						{/* Footer */}
						<div
							className="flex items-center justify-between px-4 py-2"
							style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
						>
							<span className="text-[8px] tracking-[0.35em] text-zinc-800">
								END_OF_FILE
							</span>
							<div className="flex items-center gap-1">
								{STEPS.map((s, i) => (
									<div
										className="h-px w-4 transition-all duration-200"
										key={i}
										style={{
											background:
												activeStep === i ? s.color : "rgba(255,255,255,0.05)",
										}}
									/>
								))}
							</div>
						</div>
					</div>
				)}

				{/* ── TOGGLE BUTTON ─────────────────────────── */}
				<button
					className="group relative flex items-center justify-center transition-all duration-200"
					onClick={() => setIsOpen((v) => !v)}
					style={{
						width: 36,
						height: 36,
						background: isOpen ? "rgba(220,38,38,0.88)" : "rgba(5,1,1,0.96)",
						border: `1px solid ${isOpen ? "rgba(220,38,38,0.95)" : "rgba(220,38,38,0.32)"}`,
						boxShadow: isOpen
							? "0 0 20px rgba(220,38,38,0.38), 0 0 50px rgba(220,38,38,0.1)"
							: "0 0 10px rgba(220,38,38,0.1)",
					}}
					type="button"
				>
					{/* shimmer */}
					<div
						className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
						style={{
							background:
								"linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.04) 50%,transparent 70%)",
						}}
					/>
					{/* bottom glow line when closed */}
					{!isOpen && (
						<div
							className="pointer-events-none absolute bottom-0 inset-x-0 h-px"
							style={{
								background:
									"linear-gradient(90deg,transparent,rgba(220,38,38,0.4),transparent)",
							}}
						/>
					)}
					<span
						className="relative z-10 text-xs font-bold transition-colors duration-200"
						style={{ color: isOpen ? "#000" : "#f87171" }}
					>
						{isOpen ? "×" : "?"}
					</span>
				</button>
			</div>
		</>
	);
}
