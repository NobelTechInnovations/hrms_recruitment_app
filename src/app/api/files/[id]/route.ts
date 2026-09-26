import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { applications, candidates, documents } from "@/db/schema";
import { getCurrentUser, getCandidateForUser } from "@/server/auth";
import { hasApplication, viewerCompany } from "@/server/access";
import { readUpload } from "@/server/storage";

const notFound = () => new Response("Not found", { status: 404 });

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!doc) return notFound();

  let allowed = user.role === "admin";
  if (!allowed && doc.ownerType === "candidate") {
    const self = user.role === "candidate" ? await getCandidateForUser(user.id) : null;
    if (self?.id === doc.ownerId) allowed = true;
    const membership = await viewerCompany(user);
    if (!allowed && membership && (await hasApplication(membership.company.id, doc.ownerId))) {
      const [candidate] = await db.select().from(candidates).where(eq(candidates.id, doc.ownerId)).limit(1);
      if (doc.docType === "resume") {
        // An uploaded resume the candidate attached to an application with this company.
        const [app] = await db
          .select({ id: applications.id })
          .from(applications)
          .where(and(eq(applications.companyId, membership.company.id), eq(applications.uploadedResumeDocId, doc.id)))
          .limit(1);
        allowed = !!app;
      } else {
        allowed = doc.status === "approved" && !!candidate?.shareableDocTypes.includes(doc.docType);
      }
    }
  } else if (!allowed && doc.ownerType === "company") {
    const membership = await viewerCompany(user);
    allowed = membership?.company.id === doc.ownerId;
  }
  if (!allowed) return notFound();

  const body = await readUpload(doc.storageKey).catch(() => null);
  if (!body) return notFound();
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${doc.fileName.replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
