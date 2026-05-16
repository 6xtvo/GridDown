import "@/styles/globals.css";

import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";

import { TRPCReactProvider } from "@/trpc/react";

export const metadata: Metadata = {
  title: "GridDown | Urgency Board",
  description: "Tactical communication and supply tracking during grid failure.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const sevenSegment = localFont({
  src: "../../public/seven-segment.ttf",
  variable: "--font-seven-custom", // Added -custom to avoid naming collisions
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-custom", // Added -custom
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`${sevenSegment.variable} ${jetbrains.variable} bg-black`} lang="en">
      <body className="font-jetbrains">
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}