import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const connectionRouter = createTRPCRouter({

  // Create a connection (mark someone as helped / was helped by)
  create: protectedProcedure
    .input(z.object({
      toId: z.string(),           // the user you're connecting with
      attestation: z.string().max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const fromId = ctx.session.user.id;

      if (fromId === input.toId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot connect with yourself",
        });
      }

      // @@unique([fromId, toId]) will throw if duplicate — catch it gracefully
      try {
        return await ctx.db.connection.create({
          data: {
            fromId,
            toId: input.toId,
            attestation: input.attestation,
          },
        });
      } catch {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Connection already exists",
        });
      }
    }),

  // Get MY connections page (/connections)
  getMine: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [given, received] = await Promise.all([
      // Connections I initiated (people I've helped)
      ctx.db.connection.findMany({
        where: { fromId: userId },
        include: {
          to: {
            select: { id: true, name: true, image: true, status: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      // Connections others made to me (people who helped me)
      ctx.db.connection.findMany({
        where: { toId: userId },
        include: {
          from: {
            select: { id: true, name: true, image: true, status: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return { given, received };
  }),

  // Get connections for any user (public profile /profile/[id])
  getByUser: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [given, received] = await Promise.all([
        ctx.db.connection.findMany({
          where: { fromId: input.userId },
          include: {
            to: { select: { id: true, name: true, image: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        ctx.db.connection.findMany({
          where: { toId: input.userId },
          include: {
            from: { select: { id: true, name: true, image: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      return { given, received };
    }),

  // Trust score — calculated on the fly (count of received connections)
  getTrustScore: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const count = await ctx.db.connection.count({
        where: { toId: input.userId },
      });
      return { trustScore: count };
    }),

  // Check if current user already has a connection to someone
  // (useful to show "Already connected" state in UI)
  getStatus: protectedProcedure
    .input(z.object({ toId: z.string() }))
    .query(async ({ ctx, input }) => {
      const existing = await ctx.db.connection.findUnique({
        where: {
          fromId_toId: {
            fromId: ctx.session.user.id,
            toId: input.toId,
          },
        },
      });
      return { connected: !!existing, connection: existing };
    }),
});