import { UrgencyBoard } from "@/app/_components/UrgencyBoard"; // Adjust path if needed
import { signIn } from "@/server/auth";
import { HydrateClient } from "@/trpc/server";

export function SignInButton() {
	return (
		<form
			action={async () => {
				"use server";
				await signIn("google", { redirectTo: "/dashboard" });
			}}
		>
			<button
				className="border-2 border-red-600 bg-red-600 px-6 py-2 font-seven text-2xl text-white tracking-widest transition hover:bg-transparent hover:text-red-600"
				type="submit"
			>
				ACCESS SYSTEM
			</button>
		</form>
	);
}

export default async function Home() {
	return (
		<HydrateClient>
			<main className="flex min-h-screen flex-col items-center bg-black text-white">
				{/* --- TACTICAL NAV --- */}
				<nav className="flex w-full items-center justify-between border-red-600 border-b-2 bg-black px-8 py-4">
					<div className="font-seven text-6xl text-red-600 tracking-widest">
						GRID<span className="text-white">DOWN</span>
					</div>
					<SignInButton />
				</nav>

				{/* --- MAIN INTERFACE --- */}
				<div className="container flex flex-col gap-8 px-4 py-8">
					{/* Header Stats */}
					<div className="flex justify-between border-red-600 border-l-4 bg-red-900/10 p-4 font-seven text-red-500 text-xl tracking-wider">
						<div>{"SIGNAL: WEAK // ENCRYPTION: ACTIVE"}</div>
						<div>{"IDENTIFYING..."}</div>
					</div>

					{/* --- IMPORTED URGENCY BOARD --- */}
					<UrgencyBoard />

					{/* Footer Info */}
					<div className="grid grid-cols-1 gap-4 font-seven text-lg text-zinc-600 uppercase tracking-widest md:grid-cols-3">
						<div className="border-zinc-800 border-t pt-2">
							System: v2.0.4-Stable
						</div>
						<div className="border-zinc-800 border-t pt-2 text-center">
							Connection: Encrypted_P2P
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
