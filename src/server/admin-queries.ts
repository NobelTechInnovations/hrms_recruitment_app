import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { applicationEvents, applications, candidates, companies, companyMembers, documents, interviews, invoices, jobReports, jobs, messages, placements, users } from "@/db/schema";
import { PIPELINE_STAGES } from "@/lib/constants";

const n = (rows: { n: number }[]) => Number(rows[0]?.n ?? 0);

export async function adminCounts() {
  const [pendingCompanies, pendingDocs, pendingJobs, openReports, flagged] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(companies).where(eq(companies.verificationStatus, "pending")),
    db.select({ n: sql<number>`count(*)` }).from(documents).where(and(eq(documents.status, "pending"), eq(documents.ownerType, "candidate"))),
    db.select({ n: sql<number>`count(*)` }).from(jobs).where(eq(jobs.status, "pending_approval")),
    db.select({ n: sql<number>`count(*)` }).from(jobReports).where(eq(jobReports.status, "open")),
    db.select({ n: sql<number>`count(*)` }).from(messages).where(eq(messages.moderationStatus, "pending_review")),
  ]);
  return { verification: n(pendingCompanies) + n(pendingDocs), pendingCompanies: n(pendingCompanies), pendingDocs: n(pendingDocs), jobs: n(pendingJobs) + n(openReports), pendingJobs: n(pendingJobs), openReports: n(openReports), flagged: n(flagged) };
}

export async function adminOverview() {
  const [cands, comps, verifiedComps, activeJobs, apps, upcoming, guarantee, outstanding, collected, funnelRows] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(candidates),
    db.select({ n: sql<number>`count(*)` }).from(companies),
    db.select({ n: sql<number>`count(*)` }).from(companies).where(eq(companies.verificationStatus, "verified")),
    db.select({ n: sql<number>`count(*)` }).from(jobs).where(eq(jobs.status, "active")),
    db.select({ n: sql<number>`count(*)` }).from(applications),
    db.select({ n: sql<number>`count(*)` }).from(interviews).where(and(eq(interviews.status, "scheduled"), sql`${interviews.scheduledAt} > ${Date.now()}`)),
    db.select({ n: sql<number>`count(*)` }).from(placements).where(eq(placements.status, "in_guarantee")),
    db.select({ n: sql<number>`coalesce(sum(${invoices.total}), 0)` }).from(invoices).where(inArray(invoices.status, ["issued", "overdue"])),
    db.select({ n: sql<number>`coalesce(sum(${invoices.total}), 0)` }).from(invoices).where(eq(invoices.status, "paid")),
    db.select({ stage: applicationEvents.toStage, n: sql<number>`count(distinct ${applicationEvents.applicationId})` }).from(applicationEvents).groupBy(applicationEvents.toStage),
  ]);
  const reached = new Map(funnelRows.map((r) => [r.stage, Number(r.n)]));
  let carry = 0;
  const funnel = [...PIPELINE_STAGES]
    .reverse()
    .map((s) => {
      carry = Math.max(carry, reached.get(s.value) ?? 0);
      return { label: s.label, value: carry };
    })
    .reverse();
  return {
    candidates: n(cands),
    companies: n(comps),
    verifiedCompanies: n(verifiedComps),
    activeJobs: n(activeJobs),
    applications: n(apps),
    upcomingInterviews: n(upcoming),
    inGuarantee: n(guarantee),
    outstanding: n(outstanding),
    collected: n(collected),
    funnel,
  };
}

export async function usersWithContext() {
  return db
    .select({ user: users, companyName: companies.name, candidateId: candidates.id })
    .from(users)
    .leftJoin(candidates, eq(candidates.userId, users.id))
    .leftJoin(companyMembers, eq(companyMembers.userId, users.id))
    .leftJoin(companies, eq(companies.id, companyMembers.companyId));
}
