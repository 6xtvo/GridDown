import { userRouter } from "@/server/api/routers/user";
import { p2pRouter } from "@/server/api/routers/p2p"; // Import the router
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

export const appRouter = createTRPCRouter({
	user: userRouter,
	p2p: p2pRouter, // Mount it here
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);