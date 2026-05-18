"use client";

import { useState } from "react";

// ─── Step definitions ─────────────────────────────────────────────────────────
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
			"Set your name and skills, then click the map to pin your location.",
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
			"Click any report in the feed or tap a map pin to get directions and an ETA from your location.",
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
			"Click the map to pin a location, then post a Need, Offer, or Update to everyone connected.",
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
			"Tap any report in the feed to open its chat. Send messages and photos to coordinate with others nearby.",
	},
];

const CORNER_CLASSES = [
	"top-0 left-0 border-t border-l",
	"top-0 right-0 border-t border-r",
	"bottom-0 left-0 border-b border-l",
	"bottom-0 right-0 border-b border-r",
] as const;

// ─── Component ────────────────────────────────────────────────────────────────
export function QuickGuide() {
	const [isOpen, setIsOpen] = useState(false);
	const [activeStep, setActiveStep] = useState<number | null>(null);

	return (
		<>
			<style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
        .qg { font-family: 'Share Tech Mono', 'Courier New', monospace; }
        @keyframes qg-ping { 75%, 100% { transform: scale(1.8); opacity: 0; } }
      `}</style>

			{/*
        Entire widget slides as one unit. When closed, translateX(300px) hides
        the panel off-screen while the tab (28px wide) stays visible at the edge.
      */}
			<div
				className="qg fixed right-0 z-50 flex items-center"
				style={{
					top: "50%",
					transform: `translateY(-50%) translateX(${isOpen ? "0px" : "300px"})`,
					transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
				}}
			>
				{/* ── Tab ── */}
				<button
					onClick={() => setIsOpen((v) => !v)}
					style={{
						flexShrink: 0,
						writingMode: "vertical-rl",
						textOrientation: "mixed",
						width: 28,
						height: 100,
						background: isOpen ? "rgba(180,20,20,0.95)" : "rgba(5,1,1,0.96)",
						border: "1px solid rgba(220,38,38,0.40)",
						borderRight: "none",
						color: isOpen ? "#fca5a5" : "#f87171",
						fontSize: 9,
						letterSpacing: "0.25em",
						padding: "8px 0",
						cursor: "pointer",
						transition: "background 0.2s, color 0.2s",
						userSelect: "none",
						boxShadow: "-3px 0 12px rgba(0,0,0,0.6)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
					type="button"
				>
					{isOpen ? "CLOSE" : "GUIDE"}
				</button>

				{/* ── Panel ── */}
				<div
					className="relative overflow-hidden"
					style={{
						width: 300,
						background: "rgba(4,1,1,0.97)",
						border: "1px solid rgba(220,38,38,0.28)",
						borderRight: "none",
						boxShadow:
							"-8px 0 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(220,38,38,0.04)",
					}}
				>
					{/* Scanlines overlay */}
					<div
						className="pointer-events-none absolute inset-0 z-20"
						style={{
							backgroundImage:
								"repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.09) 3px, rgba(0,0,0,0.09) 4px)",
						}}
					/>

					{/* Top glow line */}
					<div
						className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px"
						style={{
							background:
								"linear-gradient(90deg,transparent,rgba(220,38,38,0.55),transparent)",
						}}
					/>

					{/* Corner accents */}
					{CORNER_CLASSES.map((c) => (
						<div
							className={`pointer-events-none absolute z-20 h-3 w-3 ${c}`}
							key={c}
							style={{ borderColor: "rgba(220,38,38,0.35)" }}
						/>
					))}

					{/* Header */}
					<div
						className="relative flex items-center px-4 py-3"
						style={{
							background:
								"linear-gradient(135deg,rgba(220,38,38,0.1) 0%,transparent 70%)",
							borderBottom: "1px solid rgba(220,38,38,0.12)",
						}}
					>
						<div className="flex items-center gap-3">
							{/* Pulsing dot */}
							<span className="relative flex h-2 w-2 items-center justify-center">
								<span
									className="absolute h-full w-full rounded-full bg-red-500 opacity-70"
									style={{
										animation: "qg-ping 1.8s cubic-bezier(0,0,.2,1) infinite",
									}}
								/>
								<span className="relative h-1.5 w-1.5 rounded-full bg-red-400" />
							</span>
							<span className="text-[11px] tracking-[0.32em] text-red-400">
								GUIDE
							</span>
							<span
								className="px-1.5 py-px text-[9px] tracking-widest text-red-700"
								style={{ border: "1px solid rgba(220,38,38,0.25)" }}
							>
								v1.0
							</span>
						</div>
					</div>

					{/* Steps */}
					<div className="space-y-1.5 px-3 py-3">
						{STEPS.map((s, i) => {
							const open = activeStep === i;
							return (
								<button
									className={`w-full text-left transition-all duration-200 ${open ? s.activeBg : s.bgClass}`}
									key={s.num}
									onClick={() => setActiveStep(open ? null : i)}
									style={{
										border: `1px solid ${open ? s.color + "38" : "rgba(255,255,255,0.06)"}`,
										boxShadow: open
											? `0 0 14px ${s.glowColor}, inset 0 0 12px ${s.glowColor.replace("0.35", "0.04")}`
											: "none",
									}}
									type="button"
								>
									<div className="flex items-center gap-3 px-3 py-2.5">
										{/* Step number badge */}
										<div
											className="flex h-5 w-8 shrink-0 items-center justify-center text-[10px] tracking-widest transition-all duration-200"
											style={{
												border: `1px solid ${open ? s.color + "45" : "rgba(255,255,255,0.12)"}`,
												color: open ? s.color : "rgba(160,160,160,0.9)",
												boxShadow: open ? `0 0 6px ${s.glowColor}` : "none",
											}}
										>
											{s.num}
										</div>

										{/* Colour dot */}
										<span
											className={`h-1 w-1 shrink-0 rounded-full transition-opacity duration-200 ${s.dot} ${open ? "opacity-100" : "opacity-40"}`}
										/>

										{/* Label */}
										<span
											className={`flex-1 text-[10px] tracking-[0.22em] transition-colors duration-200 ${open ? s.textClass : "text-zinc-400"}`}
										>
											{s.label}
										</span>

										{/* Chevron */}
										<svg
											className={`shrink-0 transition-all duration-200 ${open ? s.textClass : "text-zinc-500"}`}
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

									{/* Expandable description */}
									<div
										style={{
											maxHeight: open ? "140px" : "0",
											overflow: "hidden",
											transition: "max-height 0.22s ease",
										}}
									>
										<p
											className="px-3 pb-3 text-[10px] leading-[1.8] text-zinc-300"
											style={{
												borderTop: `1px solid ${s.color}20`,
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

					{/* Footer - progress indicators */}
					<div
						className="flex items-center justify-end px-4 py-2"
						style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
					>
						<div className="flex items-center gap-1">
							{STEPS.map((s, i) => (
								<div
									className="h-px w-4 transition-all duration-200"
									key={i}
									style={{
										background:
											activeStep === i ? s.color : "rgba(255,255,255,0.15)",
									}}
								/>
							))}
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
