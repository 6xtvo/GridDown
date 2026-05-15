import { PrismaAdapter } from "@auth/prisma-adapter";
import type { DefaultSession, NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { env } from "@/env";
import { db } from "@/server/db";

// Extend the session type to include role and id
declare module "next-auth" {
	interface Session {
		user: {
			id: string;
			role: "USER" | "ADMIN";
		} & DefaultSession["user"];
	}

	interface User {
		role: "USER" | "ADMIN";
	}
}

export const authConfig = {
	adapter: PrismaAdapter(db),
	providers: [
		GoogleProvider({
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
		}),
	],
	callbacks: {
		session({ session, user }) {
			session.user.id = user.id;
			session.user.role = user.role;
			return session;
		},
	},
} satisfies NextAuthConfig;
