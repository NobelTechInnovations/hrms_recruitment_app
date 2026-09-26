// Scheduled jobs endpoint for an external cron (e.g. every 15 minutes):
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron
import { timingSafeEqual } from "node:crypto";
import { runScheduledJobs } from "@/server/scheduled";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runScheduledJobs();
  return Response.json({ ok: true, ...result });
}
