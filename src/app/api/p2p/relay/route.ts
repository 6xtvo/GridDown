import { NextResponse } from "next/server";
import { z } from "zod";
import { lanDiscovery } from "@/services/lan-discovery";
import { webrtcManager } from "@/services/webrtc-manager";

export const runtime = "nodejs";

const relayBodySchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("signal"),
		token: z.string(),
		signal: z.object({
			id: z.string().optional(),
			from: z.string(),
			to: z.string(),
			type: z.enum(["offer", "answer", "ice-candidate"]),
			data: z.record(z.unknown()),
			timestamp: z.number(),
		}),
	}),
	z.object({
		type: z.literal("message"),
		token: z.string(),
		message: z.object({
			id: z.string().optional(),
			from: z.string(),
			to: z.string(),
			type: z.string(),
			data: z.unknown(),
			timestamp: z.number(),
		}),
	}),
]);

export async function POST(req: Request) {
	const parsed = relayBodySchema.safeParse(await req.json());
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid relay payload" },
			{ status: 400 },
		);
	}

	if (!lanDiscovery.isRelayTokenValid(parsed.data.token)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (parsed.data.type === "signal") {
		parsed.data.signal.id ??= crypto.randomUUID();
		webrtcManager.queueSignal(parsed.data.signal);
		return NextResponse.json({ success: true });
	}

	parsed.data.message.id ??= crypto.randomUUID();
	webrtcManager.storeMessage(parsed.data.message.to, {
		id: parsed.data.message.id,
		from: parsed.data.message.from,
		type: parsed.data.message.type,
		data: parsed.data.message.data,
		timestamp: parsed.data.message.timestamp,
	});

	return NextResponse.json({ success: true });
}
