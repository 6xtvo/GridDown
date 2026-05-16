import { TacticalDashboard } from "@/app/_components/TacticalDashboard"; // Adjust your path if it's in _components
import { HydrateClient } from "@/trpc/server";

export default async function Home() {
	return (
		<HydrateClient>
			<main className="flex min-h-screen flex-col items-center bg-black text-white">
				<div className="w-full">
					{/* All Nav, Profile, Modals, and the Map are handled here now */}
					<TacticalDashboard />
				</div>

				<div className="container flex flex-col gap-4 px-4 py-8">
					{/* Background Server Connection Stats */}
					<div className="flex justify-between border-red-600 border-l-4 bg-red-900/10 p-4 font-seven text-red-500 text-xl tracking-wider">
						<div>{"SIGNAL: WEAK // ENCRYPTION: ACTIVE"}</div>
					</div>

					<div className="grid grid-cols-1 gap-4 font-seven text-lg text-zinc-600 uppercase tracking-widest md:grid-cols-3">
						<div className="border-zinc-800 border-t pt-2">
							System: v2.0.4-Offline
						</div>
						<div className="border-zinc-800 border-t pt-2 text-center">
							Connection: Local_Node
						</div>
						<div className="border-zinc-800 border-t pt-2 text-right">
							No unauthorized access
						</div>
					</div>
				</div>
			</main>
		</HydrateClient>
	);
}