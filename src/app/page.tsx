import { UrgencyBoard } from "@/app/_components/UrgencyBoard";
import { signIn } from "@/server/auth";
import { HydrateClient } from "@/trpc/server";

// Optional: Keep the sign-in button if you still want auth access
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
			<main className="flex min-h-screen flex-col bg-black text-white">
				{/* --- TACTICAL NAV --- */}
				<nav className="flex w-full items-center justify-between border-red-600 border-b-2 bg-black px-8 py-4">
					<div className="font-seven text-6xl text-red-600 tracking-widest">
						GRID<span className="text-white">DOWN</span>
					</div>
					<SignInButton />
				</nav>

				{/* --- MAIN INTERFACE --- */}
				{/* The p-4 and flex-1 allow the UrgencyBoard to expand naturally */}
				<div className="flex-1 w-full max-w-[1800px] mx-auto p-4 md:p-8 flex flex-col">
					<UrgencyBoard />
				</div>
			</main>
		</HydrateClient>
	);
}