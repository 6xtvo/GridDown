import Link from "next/link";
import { signIn } from "@/server/auth";
import { HydrateClient, api } from "@/trpc/server";

// 1. Authentication Form Component (Server Action)
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
        className="border-2 border-red-600 bg-red-600 px-6 py-2 font-bebas text-2xl tracking-widest text-white transition hover:bg-transparent hover:text-red-600"
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
          <div className="font-bebas text-5xl tracking-tighter text-red-600">
            GRID<span className="text-white">DOWN</span>
          </div>
          <SignInButton />
        </nav>

        {/* --- MAIN INTERFACE --- */}
        <div className="container flex flex-col gap-8 px-4 py-8">
          
          {/* Header Stats */}
          <div className="flex justify-between border-l-4 border-red-600 bg-red-900/10 p-4 font-mono text-xs text-red-500">
            <div>SIGNAL: WEAK // ENCRYPTION: ACTIVE</div>
            <div>{hello ? hello.greeting.toUpperCase() : "IDENTIFYING..."}</div>
          </div>

          {/* --- THE URGENCY BOARD (SPLIT VIEW) --- */}
          <div className="flex flex-col border-2 border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.3)]">
            
            {/* Board Header */}
            <div className="flex items-center justify-between bg-red-600 px-4 py-2 font-bebas text-xl tracking-wider text-black">
              <span>LIVE URGENCY BOARD // VOL. 04</span>
              <div className="flex items-center gap-4">
                <span className="animate-pulse">● LIVE FEED</span>
                <span>COORD: 40.7128° N</span>
              </div>
            </div>

            {/* Split Content */}
            <div className="flex h-[600px] flex-col lg:flex-row">
              
              {/* LEFT: Main Feed */}
              <div className="flex-1 overflow-y-auto border-b-2 border-red-600 lg:border-b-0 lg:border-r-2 bg-zinc-950">
                <div className="p-4 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border border-zinc-800 bg-zinc-900 p-3">
                      <div className="flex justify-between font-bebas text-red-600 text-lg">
                        <span>PRIORITY {i === 1 ? "HIGH" : "MED"}</span>
                        <span className="text-zinc-500 text-sm font-mono">14:02:0{i}</span>
                      </div>
                      <p className="text-zinc-300 font-mono text-sm mt-1">
                        Supply drop identified at Sector 7. Civil unrest reported in surrounding blocks. Maintain radio silence.
                      </p>
                    </div>
                  ))}
                  <div className="flex h-32 items-center justify-center border border-dashed border-zinc-800 text-zinc-600">
                    <p className="text-xs font-mono italic">Waiting for incoming packets...</p>
                  </div>
                </div>
              </div>

              {/* RIGHT: Tactical Map */}
              <div className="relative flex-1 bg-zinc-900 overflow-hidden">
                {/* Stylized Grid Map Placeholder */}
                <div className="absolute inset-0 opacity-20 bg-[size:30px_30px] bg-[linear-gradient(to_right,#ef4444_1px,transparent_1px),linear-gradient(to_bottom,#ef4444_1px,transparent_1px)]"></div>
                
                <div className="relative z-10 flex h-full flex-col items-center justify-center p-8 text-center">
                  <div className="mb-4 border-2 border-red-600 p-6">
                    <div className="h-32 w-32 border border-red-600/30 flex items-center justify-center">
                       <svg className="w-16 h-16 text-red-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="font-bebas text-3xl text-white">MAP_MODULE_OFFLINE</h3>
                  <p className="max-w-xs font-mono text-xs text-zinc-500 uppercase mt-2">
                    Satellite link required for geospatial rendering. <br/>
                    Auth Level 3 required.
                  </p>
                </div>

                {/* Map Overlay HUD */}
                <div className="absolute bottom-4 right-4 bg-black/80 border border-red-600 p-2 font-mono text-[10px] text-red-500">
                  LAT: 40.7128<br/>
                  LON: -74.0060<br/>
                  ALT: 12M
                </div>
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-[10px] text-zinc-600 uppercase">
            <div className="border-t border-zinc-800 pt-2">System: v2.0.4-Stable</div>
            <div className="border-t border-zinc-800 pt-2 text-center">Connection: Encrypted_P2P</div>
            <div className="border-t border-zinc-800 pt-2 text-right">No unauthorized access</div>
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}