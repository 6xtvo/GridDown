"use client";

import { useState } from "react";

export function QuickGuide() {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<div className="fixed right-6 bottom-6 z-[100] flex flex-col items-end">
			{/* Guide Window */}
			{isOpen && (
				<div className="fade-in slide-in-from-bottom-4 mb-4 w-80 animate-in border-2 border-red-600 bg-black/95 p-5 shadow-[0_0_20px_rgba(220,38,38,0.3)] backdrop-blur-md lg:w-96">
					<div className="mb-4 flex items-center justify-between border-red-900 border-b pb-2">
						<span className="font-seven text-red-500 text-xl tracking-widest">
							SYS_MANUAL // v1.0
						</span>
						<button
							className="font-seven text-xl text-zinc-500 transition-colors hover:text-red-500"
							onClick={() => setIsOpen(false)}
							type="button"
						>
							[X]
						</button>
					</div>

					<div className="space-y-4 font-jetbrains text-xs text-zinc-300 leading-relaxed">
						<div>
							<span className="font-bold text-red-500">1. CREATE PROFILE:</span>{" "}
							Click "CREATE PROFILE" in the top right to authenticate your
							callsign and skills on the local node.
						</div>
						<div>
							<span className="font-bold text-green-500">2. OVERVIEW MAP:</span>{" "}
							Click any incident on the left feed or directly on the map markers
							to calculate your drive route and ETA from HQ.
						</div>
						<div>
							<span className="font-bold text-yellow-500">
								3. ACCESS SYSTEM:
							</span>{" "}
							Click "ACCESS SYSTEM" to open the live P2P network. Click anywhere
							on the map to lock coordinates before transmitting a Request,
							Offer, or Announcement.
						</div>
						<div>
							<span className="font-bold text-blue-500">4. SECURE COMMS:</span>{" "}
							In the Global Urgency Board, click any active incident card to
							join its dedicated encrypted chat room and broadcast to the swarm.
						</div>
					</div>

					<div className="mt-5 border-red-900/50 border-t pt-2 text-right font-seven text-[10px] text-zinc-600 tracking-widest">
						END OF FILE_
					</div>

					{/* Decorative Scanline */}
					<div className="pointer-events-none absolute inset-0 bg-[length:100%_4px,3px_100%] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] opacity-20"></div>
				</div>
			)}

			{/* Toggle Button */}
			<button
				className={`flex items-center gap-3 border-2 border-red-600 px-4 py-2 font-seven text-lg tracking-widest transition-all ${
					isOpen
						? "bg-red-600 text-black shadow-[0_0_15px_rgba(220,38,38,0.5)]"
						: "bg-black text-red-500 shadow-[0_0_10px_rgba(220,38,38,0.2)] hover:bg-red-600 hover:text-black"
				}`}
				onClick={() => setIsOpen(!isOpen)}
				type="button"
			>
				<span className="font-bold text-xl">{isOpen ? "[X]" : "[?]"}</span>
				{isOpen ? "CLOSE_MANUAL" : "SYS_GUIDE"}
			</button>
		</div>
	);
}
