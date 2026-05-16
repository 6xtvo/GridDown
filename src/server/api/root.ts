// root.ts — add p2pRouter here
 
import { postRouter } from "@/server/api/routers/post";
import { userRouter } from "@/server/api/routers/user";
import { p2pRouter } from "@/server/api/routers/p2p";  // ADD THIS
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
 
export const appRouter = createTRPCRouter({
  post: postRouter,
  user: userRouter,
  p2p: p2pRouter,  // ADD THIS
});
 
export type AppRouter = typeof appRouter;
 
export const createCaller = createCallerFactory(appRouter);
 