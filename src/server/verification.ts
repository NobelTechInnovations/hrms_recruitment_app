// Document & company verification workflows (README §1, §3, §16).

import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { candidates, companies, documents } from "@/db/schema";
import { CANDIDATE_DOC_TYPES, COMPANY_DOC_TYPES, DOC_TYPE_VERIFIES, labelOf, type VerificationKind } from "@/lib/constants";
import { audit } from "./audit";
import { notify, notifyCompany } from "./notify";
import { UserError } from "@/lib/errors";

const VERIFIED_COLUMN: Record<VerificationKind, "identityVerifiedAt" | "educationVerifiedAt" | "experienceVerifiedAt" | "salaryVerifiedAt" | "locationVerifiedAt"> = {
  identity: "identityVerifiedAt",
  education: "educationVerifiedAt",
  experience: "experienceVerifiedAt",
  salary: "salaryVerifiedAt",
  location: "locationVerifiedAt",
};

export async function reviewDocument(documentId: string, decision: "approved" | "rejected", note: string | null, adminId: string) {
  const [doc] = await db
    .update(documents)
    .set({ status: decision, reviewNote: note, reviewedByUserId: adminId, reviewedAt: new Date() })
    .where(eq(documents.id, documentId))
    .returning();
  if (!doc) throw new UserError("Document not found");
  await audit(adminId, `document.${decision}`, "document", doc.id, { docType: doc.docType, note });

  if (doc.ownerType === "candidate") {
    const [candidate] = await db.select().from(candidates).where(eq(candidates.id, doc.ownerId)).limit(1);
    if (!candidate) return doc;
    const kind = DOC_TYPE_VERIFIES[doc.docType];
    if (kind) {
      const column = VERIFIED_COLUMN[kind];
      if (decision === "approved") {
        await db.update(candidates).set({ [column]: new Date(), updatedAt: new Date() }).where(eq(candidates.id, candidate.id));
      } else {
        // Revoke the badge only if no other approved document still proves it.
        const sameKind = Object.entries(DOC_TYPE_VERIFIES)
          .filter(([, k]) => k === kind)
          .map(([t]) => t);
        const [other] = await db
          .select({ id: documents.id })
          .from(documents)
          .where(and(eq(documents.ownerType, "candidate"), eq(documents.ownerId, candidate.id), eq(documents.status, "approved"), inArray(documents.docType, sameKind), ne(documents.id, doc.id)))
          .limit(1);
        if (!other) await db.update(candidates).set({ [column]: null, updatedAt: new Date() }).where(eq(candidates.id, candidate.id));
      }
    }
    const label = labelOf(CANDIDATE_DOC_TYPES, doc.docType);
    await notify(candidate.userId, {
      type: "verification",
      title: decision === "approved" ? `${kind ? `${kind[0]!.toUpperCase()}${kind.slice(1)} Verified ✓` : "Document approved"}` : "Document needs attention",
      body: decision === "approved" ? `Your ${label} was verified.` : `Your ${label} was not accepted${note ? `: ${note}` : "."} Please upload a new copy.`,
      link: "/candidate/verification",
    });
  } else {
    const label = labelOf(COMPANY_DOC_TYPES, doc.docType);
    await notifyCompany(
      doc.ownerId,
      {
        type: "verification",
        title: decision === "approved" ? "Document approved" : "Document needs attention",
        body: decision === "approved" ? `${label} was approved.` : `${label} was not accepted${note ? `: ${note}` : "."}`,
        link: "/company/profile",
      },
      "company.edit",
    );
  }
  return doc;
}

export async function reviewCompany(companyId: string, decision: "verified" | "rejected", note: string | null, adminId: string) {
  const now = new Date();
  const [company] = await db
    .update(companies)
    .set({ verificationStatus: decision, verificationNote: note, verifiedAt: decision === "verified" ? now : null, updatedAt: now })
    .where(eq(companies.id, companyId))
    .returning();
  if (!company) throw new UserError("Company not found");
  if (decision === "verified") {
    // Approve outstanding documents along with the company.
    await db
      .update(documents)
      .set({ status: "approved", reviewedByUserId: adminId, reviewedAt: now })
      .where(and(eq(documents.ownerType, "company"), eq(documents.ownerId, companyId), eq(documents.status, "pending")));
  }
  await audit(adminId, `company.${decision}`, "company", companyId, { note });
  await notifyCompany(
    companyId,
    {
      type: "verification",
      title: decision === "verified" ? "Company verification completed." : "Company verification needs attention",
      body: decision === "verified" ? `${company.name} is now a VERIFIED COMPANY ✓. Your jobs will go live without manual approval.` : `Verification was not approved${note ? `: ${note}` : "."} Update your details and resubmit.`,
      link: "/company/profile",
    },
    "jobs.view",
  );
  return company;
}
