import "@/styles/globals.css";

import type { Metadata } from "next";
// Import blocky and stylized fonts
import { Bebas_Neue, JetBrains_Mono } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";

export const metadata: Metadata = {
  title: "GridDown | Urgency Board",
  description: "Tactical communication and supply tracking during grid failure.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Set background to black globally to avoid white flashes
    <html className={`${bebas.variable} ${jetbrains.variable} bg-black`} lang="en">
      <body className="font-jetbrains">
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}