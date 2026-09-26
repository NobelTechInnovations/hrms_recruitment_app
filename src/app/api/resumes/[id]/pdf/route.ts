import { eq } from "drizzle-orm";
import { db } from "@/db";
import { resumes } from "@/db/schema";
import { getCurrentUser } from "@/server/auth";
import { hasApplication, viewerCompany } from "@/server/access";
import { loadCandidateBundle } from "@/server/queries";
import { buildResumeData } from "@/server/resume-data";
import { renderResumePdf } from "@/server/resume-pdf";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const [resume] = await db.select().from(resumes).where(eq(resumes.id, id)).limit(1);
  if (!resume) return new Response("Not found", { status: 404 });
  const bundle = await loadCandidateBundle(resume.candidateId);
  if (!bundle) return new Response("Not found", { status: 404 });

  let allowed = user.role === "admin" || bundle.candidate.userId === user.id;
  if (!allowed) {
    const membership = await viewerCompany(user);
    allowed = !!membership && (await hasApplication(membership.company.id, bundle.candidate.id));
  }
  if (!allowed) return new Response("Not found", { status: 404 });

  const pdf = await renderResumePdf(buildResumeData(resume, bundle));
  const filename = `${bundle.candidate.fullName} - ${resume.title}.pdf`.replace(/[^\w.\- ]/g, "_");
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" },
  });
}
