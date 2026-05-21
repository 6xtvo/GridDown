import "@/styles/globals.css";

import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import Cursor from "@/app/_components/Cursor";
import { TRPCReactProvider } from "@/trpc/react";
import { cn } from "@/utils/tailwind";

export const metadata: Metadata = {
	title: "GridDown | Emergency Co-Ordination System.",
	description:
		"When the grid goes down, GridDown serves as an emergency co-ordination system, enabling seamless communication and resource sharing among affected parties via peer-to-peer connections.",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const sevenSegment = localFont({
	src: "../../public/seven-segment.ttf",
	variable: "--font-seven-custom",
	display: "swap",
});

const jetbrains = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-jetbrains-custom",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html
			className={cn(sevenSegment.variable, jetbrains.variable, "bg-black")}
			lang="en"
		>
			<body className="font-jetbrains">
				<TRPCReactProvider>{children}</TRPCReactProvider>
			</body>
		</html>
	);
}
