import { QuickGuide } from "@/app/_components/QuickGuide";
import { TacticalDashboard } from "@/app/_components/TacticalDashboard";
import { HydrateClient } from "@/trpc/server";

export default async function Home() {
	return (
		<HydrateClient>
			<main
				className="relative flex min-h-screen flex-col items-center bg-[#020202] text-white"
				style={{ fontFamily: "'Share Tech Mono', monospace" }}
			>
				{/* Ambient background grid */}
				<div
					className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
					style={{
						backgroundImage: `
							linear-gradient(rgba(220,38,38,0.8) 1px, transparent 1px),
							linear-gradient(90deg, rgba(220,38,38,0.8) 1px, transparent 1px)
						`,
						backgroundSize: "80px 80px",
					}}
				/>

				{/* Vignette */}
				<div
					className="pointer-events-none fixed inset-0 z-0"
					style={{
						background:
							"radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.85) 100%)",
					}}
				/>

				{/* Main dashboard */}
				<div className="relative z-10 w-full">
					<TacticalDashboard />
				</div>

				{/* Footer telemetry bar */}
				<div className="relative z-10 mt-auto w-full border-t border-red-900/20 bg-[#020202]">
					<div className="container mx-auto flex flex-col gap-px px-6 py-6 md:flex-row md:items-center md:justify-between">
						{/* Signal status */}
						<div className="flex items-center gap-3">
							<div
								className="flex h-8 w-8 items-center justify-center border border-red-900/50"
								style={{ boxShadow: "0 0 10px rgba(220,38,38,0.15) inset" }}
							>
								<svg fill="none" height="14" viewBox="0 0 14 14" width="14">
									<path
										d="M1 13C2.5 8 6.5 4 13 1"
										stroke="rgba(220,38,38,0.6)"
										strokeLinecap="round"
										strokeWidth="1"
									/>
									<path
										d="M4 13C5 10 8 7 13 4"
										stroke="rgba(220,38,38,0.4)"
										strokeLinecap="round"
										strokeWidth="1"
									/>
									<path
										d="M8 13C8.5 11.5 10 10 13 8"
										stroke="rgba(220,38,38,0.25)"
										strokeLinecap="round"
										strokeWidth="1"
									/>
									<circle cx="13" cy="13" fill="rgba(220,38,38,0.8)" r="1" />
								</svg>
							</div>
							<div>
								<div className="text-[10px] tracking-[0.35em] text-red-600">
									SIGNAL: WEAK
								</div>
								<div className="text-[9px] tracking-[0.25em] text-zinc-700">
									ENCRYPTION: ACTIVE
								</div>
							</div>
						</div>

						{/* Dividers */}
						<div className="hidden items-center gap-8 md:flex">
							{[
								{ label: "SYSTEM", value: "v2.0.4-Offline" },
								{ label: "CONNECTION", value: "Local_Node" },
								{ label: "UPLINK", value: "STABLE" },
							].map((item, i) => (
								<div className="flex items-center gap-8" key={item.label}>
									{i > 0 && <div className="h-6 w-px bg-zinc-900" />}
									<div>
										<div className="text-[9px] tracking-[0.3em] text-zinc-700">
											{item.label}
										</div>
										<div className="text-[10px] tracking-[0.2em] text-zinc-500">
											{item.value}
										</div>
									</div>
								</div>
							))}
						</div>

						{/* Mobile footer */}
						<div className="flex gap-4 md:hidden">
							{["v2.0.4-Offline", "Local_Node", "STABLE"].map((v) => (
								<span
									className="text-[9px] tracking-widest text-zinc-700 uppercase"
									key={v}
								>
									{v}
								</span>
							))}
						</div>

						{/* Right: integrity check */}
						<div className="flex items-center gap-2">
							<div
								className="h-1 w-16 overflow-hidden bg-zinc-900"
								style={{ border: "1px solid rgba(220,38,38,0.15)" }}
							>
								<div
									className="h-full bg-red-700/60"
									style={{
										width: "34%",
										boxShadow: "0 0 6px rgba(220,38,38,0.5)",
									}}
								/>
							</div>
							<span className="text-[9px] tracking-[0.25em] text-red-900">
								SIG_34%
							</span>
						</div>
					</div>
				</div>

				<QuickGuide />
			</main>
		</HydrateClient>
	);
}
