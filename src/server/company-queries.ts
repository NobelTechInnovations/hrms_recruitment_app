import { and, asc, desc, eq, gt, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { applicationEvents, applications, candidates, companies, interviews, jobs, placements, users } from "@/db/schema";
import { PIPELINE_STAGES } from "@/lib/constants";

export async function companyCrmStats(companyId: string) {
  const [[openJobs], stageRows, [upcoming], funnelRows] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(jobs).where(and(eq(jobs.companyId, companyId), eq(jobs.status, "active"))),
    db.select({ stage: applications.stage, n: sql<number>`count(*)` }).from(applications).where(eq(applications.companyId, companyId)).groupBy(applications.stage),
    db
      .select({ n: sql<number>`count(*)` })
      .from(interviews)
      .innerJoin(applications, eq(applications.id, interviews.applicationId))
      .where(and(eq(applications.companyId, companyId), eq(interviews.status, "scheduled"), gt(interviews.scheduledAt, new Date()))),
    db
      .select({ stage: applicationEvents.toStage, n: sql<number>`count(distinct ${applicationEvents.applicationId})` })
      .from(applicationEvents)
      .innerJoin(applications, eq(applications.id, applicationEvents.applicationId))
      .where(eq(applications.companyId, companyId))
      .groupBy(applicationEvents.toStage),
  ]);
  const count = (stages: string[]) => stageRows.filter((r) => stages.includes(r.stage)).reduce((s, r) => s + Number(r.n), 0);
  const total = stageRows.reduce((s, r) => s + Number(r.n), 0);
  const reached = new Map(funnelRows.map((r) => [r.stage, Number(r.n)]));
  // Funnel: applications that have ever reached each stage (skipped stages inherit from later ones).
  const funnel = PIPELINE_STAGES.map((s) => ({ stage: s.value, label: s.label, value: 0 }));
  let carry = 0;
  for (let i = funnel.length - 1; i >= 0; i--) {
    carry = Math.max(carry, reached.get(funnel[i]!.stage) ?? 0);
    funnel[i]!.value = carry;
  }
  funnel[0]!.value = Math.max(funnel[0]!.value, total);
  return {
    openJobs: Number(openJobs?.n ?? 0),
    applications: total,
    shortlisted: count(["shortlisted", "assessment", "interview_1", "interview_2", "hr_interview", "selected", "offer", "joined"]),
    interviews: Number(upcoming?.n ?? 0),
    offers: count(["offer"]),
    joined: count(["joined"]),
    funnel,
  };
}

export async function companyInterviewList(companyId: string, opts: { interviewerUserId?: string; upcomingOnly?: boolean; applicationId?: string } = {}) {
  const conds: SQL[] = [eq(applications.companyId, companyId)];
  if (opts.interviewerUserId) conds.push(eq(interviews.interviewerUserId, opts.interviewerUserId));
  if (opts.applicationId) conds.push(eq(interviews.applicationId, opts.applicationId));
  if (opts.upcomingOnly) conds.push(eq(interviews.status, "scheduled"), gt(interviews.scheduledAt, new Date(Date.now() - 3_600_000)));
  return db
    .select({ interview: interviews, application: applications, job: jobs, candidate: candidates, interviewer: users })
    .from(interviews)
    .innerJoin(applications, eq(applications.id, interviews.applicationId))
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(candidates, eq(candidates.id, applications.candidateId))
    .leftJoin(users, eq(users.id, interviews.interviewerUserId))
    .where(and(...conds))
    .orderBy(opts.upcomingOnly ? asc(interviews.scheduledAt) : desc(interviews.scheduledAt));
}

export async function companyApplications(companyId: string, filters: { jobId?: string; stage?: string; applicationIds?: string[] } = {}) {
  const conds: SQL[] = [eq(applications.companyId, companyId)];
  if (filters.jobId) conds.push(eq(applications.jobId, filters.jobId));
  if (filters.stage) conds.push(eq(applications.stage, filters.stage as (typeof applications.stage.enumValues)[number]));
  if (filters.applicationIds) conds.push(inArray(applications.id, filters.applicationIds.length ? filters.applicationIds : ["-"]));
  return db
    .select({ app: applications, job: jobs, candidate: candidates })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(candidates, eq(candidates.id, applications.candidateId))
    .where(and(...conds))
    .orderBy(desc(applications.updatedAt));
}

export async function companyPlacements(companyId: string) {
  return db
    .select({ placement: placements, candidate: candidates, job: jobs })
    .from(placements)
    .innerJoin(candidates, eq(candidates.id, placements.candidateId))
    .innerJoin(jobs, eq(jobs.id, placements.jobId))
    .where(eq(placements.companyId, companyId))
    .orderBy(desc(placements.selectedAt));
}

export async function companyMembersList(companyId: string) {
  const { companyMembers } = await import("@/db/schema");
  return db.select({ member: companyMembers, user: users }).from(companyMembers).innerJoin(users, eq(users.id, companyMembers.userId)).where(eq(companyMembers.companyId, companyId)).orderBy(asc(users.name));
}

export async function companyById(id: string) {
  const [c] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return c ?? null;
}
