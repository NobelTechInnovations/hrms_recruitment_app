// Authorization rules for viewing candidate data (README §3 sensitive documents, §17 consent).

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { applications, type Candidate, type Company } from "@/db/schema";
import { getMembershipForUser } from "./auth";
import type { User } from "@/db/schema";

export async function hasApplication(companyId: string, candidateId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.companyId, companyId), eq(applications.candidateId, candidateId)))
    .limit(1);
  return !!row;
}

/** Can this company open the candidate's profile? */
export async function companyCanViewCandidate(company: Company, candidate: Candidate): Promise<boolean> {
  if (await hasApplication(company.id, candidate.id)) return true;
  return company.verificationStatus === "verified" && candidate.profileVisibility === "all_verified";
}

export async function viewerCompany(user: User | null) {
  if (!user || user.role !== "company") return null;
  return getMembershipForUser(user.id);
}
