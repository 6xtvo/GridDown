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

				<QuickGuide />
			</main>
		</HydrateClient>
	);
}
