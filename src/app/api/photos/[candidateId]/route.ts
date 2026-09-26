import { eq } from "drizzle-orm";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { getCurrentUser } from "@/server/auth";
import { companyCanViewCandidate, viewerCompany } from "@/server/access";
import { readUpload } from "@/server/storage";

export async function GET(_req: Request, ctx: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const [candidate] = await db.select().from(candidates).where(eq(candidates.id, candidateId)).limit(1);
  if (!candidate?.photoKey) return new Response("Not found", { status: 404 });
  let allowed = user.role === "admin" || candidate.userId === user.id;
  if (!allowed) {
    const membership = await viewerCompany(user);
    allowed = !!membership && (await companyCanViewCandidate(membership.company, candidate));
  }
  if (!allowed) return new Response("Not found", { status: 404 });
  const body = await readUpload(candidate.photoKey).catch(() => null);
  if (!body) return new Response("Not found", { status: 404 });
  const type = candidate.photoKey.endsWith(".png") ? "image/png" : candidate.photoKey.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return new Response(new Uint8Array(body), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=300" } });
}
