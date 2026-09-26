import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { applications, candidates, companies, interviews, jobs } from "@/db/schema";

export async function candidateApplicationStats(candidateId: string) {
  const rows = await db.select({ stage: applications.stage, n: sql<number>`count(*)` }).from(applications).where(eq(applications.candidateId, candidateId)).groupBy(applications.stage);
  const count = (stages: string[]) => rows.filter((r) => stages.includes(r.stage)).reduce((s, r) => s + Number(r.n), 0);
  const [upcoming] = await db
    .select({ n: sql<number>`count(*)` })
    .from(interviews)
    .innerJoin(applications, eq(applications.id, interviews.applicationId))
    .where(and(eq(applications.candidateId, candidateId), eq(interviews.status, "scheduled"), gt(interviews.scheduledAt, new Date())));
  return {
    applied: count(["applied", "screening", "shortlisted", "assessment", "interview_1", "interview_2", "hr_interview", "selected", "offer", "joined", "rejected"]),
    shortlisted: count(["shortlisted", "assessment", "interview_1", "interview_2", "hr_interview", "selected", "offer", "joined"]),
    interviews: Number(upcoming?.n ?? 0),
    offers: count(["offer", "joined"]),
  };
}

export async function candidateInterviews(candidateId: string, upcomingOnly = false) {
  const conds = [eq(applications.candidateId, candidateId)];
  if (upcomingOnly) conds.push(eq(interviews.status, "scheduled"), gt(interviews.scheduledAt, new Date(Date.now() - 3_600_000)));
  return db
    .select({ interview: interviews, application: applications, job: jobs, company: companies })
    .from(interviews)
    .innerJoin(applications, eq(applications.id, interviews.applicationId))
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(companies, eq(companies.id, applications.companyId))
    .where(and(...conds))
    .orderBy(upcomingOnly ? asc(interviews.scheduledAt) : desc(interviews.scheduledAt));
}

export async function candidatesByIds(ids: string[]) {
  if (!ids.length) return [];
  return db.select().from(candidates).where(inArray(candidates.id, ids));
}
