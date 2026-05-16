"use client";

import { useState } from "react";

export function QuickGuide() {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
			{/* Guide Window */}
			{isOpen && (
				<div className="mb-4 w-80 lg:w-96 border-2 border-red-600 bg-black/95 p-5 shadow-[0_0_20px_rgba(220,38,38,0.3)] backdrop-blur-md animate-in fade-in slide-in-from-bottom-4">
					<div className="mb-4 flex items-center justify-between border-b border-red-900 pb-2">
						<span className="font-seven text-xl tracking-widest text-red-500">
							SYS_MANUAL // v1.0
						</span>
						<button
							onClick={() => setIsOpen(false)}
							className="font-seven text-xl text-zinc-500 transition-colors hover:text-red-500"
							type="button"
						>
							[X]
						</button>
					</div>

					<div className="space-y-4 font-jetbrains text-xs text-zinc-300 leading-relaxed">
						<div>
							<span className="font-bold text-red-500">1. CREATE PROFILE:</span>{" "}
							Click "CREATE PROFILE" in the top right to authenticate your callsign and skills on the local node.
						</div>
						<div>
							<span className="font-bold text-green-500">2. OVERVIEW MAP:</span>{" "}
							Click any incident on the left feed or directly on the map markers to calculate your drive route and ETA from HQ.
						</div>
						<div>
							<span className="font-bold text-yellow-500">3. ACCESS SYSTEM:</span>{" "}
							Click "ACCESS SYSTEM" to open the live P2P network. Click anywhere on the map to lock coordinates before transmitting a Request, Offer, or Announcement.
						</div>
						<div>
							<span className="font-bold text-blue-500">4. SECURE COMMS:</span>{" "}
							In the Global Urgency Board, click any active incident card to join its dedicated encrypted chat room and broadcast to the swarm.
						</div>
					</div>

					<div className="mt-5 border-t border-red-900/50 pt-2 text-right font-seven text-[10px] tracking-widest text-zinc-600">
						END OF FILE_
					</div>
					
					{/* Decorative Scanline */}
					<div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20"></div>
				</div>
			)}

			{/* Toggle Button */}
			<button
				onClick={() => setIsOpen(!isOpen)}
				className={`flex items-center gap-3 border-2 border-red-600 px-4 py-2 font-seven text-lg tracking-widest transition-all ${
					isOpen
						? "bg-red-600 text-black shadow-[0_0_15px_rgba(220,38,38,0.5)]"
						: "bg-black text-red-500 shadow-[0_0_10px_rgba(220,38,38,0.2)] hover:bg-red-600 hover:text-black"
				}`}
				type="button"
			>
				<span className="text-xl font-bold">
					{isOpen ? "[X]" : "[?]"}
				</span>
				{isOpen ? "CLOSE_MANUAL" : "SYS_GUIDE"}
			</button>
		</div>
	);
}