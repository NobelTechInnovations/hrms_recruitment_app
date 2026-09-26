// Inbound email webhook for the privacy relay (README §6).
// Point your mail provider's inbound-parse webhook for *@RELAY_DOMAIN here and send
// JSON { from, to, subject, text } with header "x-relay-secret: $RELAY_WEBHOOK_SECRET".
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { routeInboundEmail } from "@/server/messaging";

const payloadSchema = z.object({
  from: z.string().min(3).max(320),
  to: z.string().min(3).max(320),
  subject: z.string().max(500).optional(),
  text: z.string().min(1).max(20_000),
});

function authorized(req: Request): boolean {
  const secret = process.env.RELAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const a = Buffer.from(req.headers.get("x-relay-secret") ?? "");
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = payloadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid payload" }, { status: 400 });
  const result = await routeInboundEmail(parsed.data);
  return Response.json(result, { status: result.ok ? 200 : 422 });
}
