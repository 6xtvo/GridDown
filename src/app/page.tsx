import { signIn } from "@/server/auth";
import { HydrateClient, api } from "@/trpc/server";
import { UrgencyBoard } from "@/components/UrgencyBoard"; // Adjust path if needed

export function SignInButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/dashboard" });
      }}
    >
      <button
        type="submit"
        className="border-2 border-red-600 bg-red-600 px-6 py-2 font-seven text-2xl tracking-widest text-white transition hover:bg-transparent hover:text-red-600"
      >
        ACCESS SYSTEM
      </button>
    </form>
  );
}

export default async function Home() {
  const hello = await api.post.hello({ text: "OPERATOR" });

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center bg-black text-white">
        
        {/* --- TACTICAL NAV --- */}
        <nav className="flex w-full items-center justify-between border-b-2 border-red-600 px-8 py-4 bg-black">
          <div className="font-seven text-6xl tracking-widest text-red-600">
            GRID<span className="text-white">DOWN</span>
          </div>
          <SignInButton />
        </nav>

        {/* --- MAIN INTERFACE --- */}
        <div className="container flex flex-col gap-8 px-4 py-8">
          
          {/* Header Stats */}
          <div className="flex justify-between border-l-4 border-red-600 bg-red-900/10 p-4 font-seven text-xl text-red-500 tracking-wider">
            <div>SIGNAL: WEAK // ENCRYPTION: ACTIVE</div>
            <div>{hello ? hello.greeting.toUpperCase() : "IDENTIFYING..."}</div>
          </div>

          {/* --- IMPORTED URGENCY BOARD --- */}
          <UrgencyBoard />

          {/* Footer Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-seven text-lg tracking-widest text-zinc-600 uppercase">
            <div className="border-t border-zinc-800 pt-2">System: v2.0.4-Stable</div>
            <div className="border-t border-zinc-800 pt-2 text-center">Connection: Encrypted_P2P</div>
            <div className="border-t border-zinc-800 pt-2 text-right">No unauthorized access</div>
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}