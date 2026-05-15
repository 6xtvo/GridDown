import { z } from "zod";

import {
	adminProcedure,
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "@/server/api/trpc";

export const userRouter = createTRPCRouter({
	// Anyone can call this
	getPublicProfile: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(({ ctx, input }) => {
			return ctx.db.user.findUnique({
				where: { id: input.id },
				select: { name: true, image: true },
			});
		}),

	// Must be logged in
	getMe: protectedProcedure.query(({ ctx }) => {
		return ctx.db.user.findUnique({
			where: { id: ctx.session.user.id },
		});
	}),

	// Must be admin
	getAllUsers: adminProcedure.query(({ ctx }) => {
		return ctx.db.user.findMany();
	}),

	// Must be admin
	setRole: adminProcedure
		.input(
			z.object({
				userId: z.string(),
				role: z.enum(["USER", "ADMIN"]),
			}),
		)
		.mutation(({ ctx, input }) => {
			return ctx.db.user.update({
				where: { id: input.userId },
				data: { role: input.role },
			});
		}),
});
