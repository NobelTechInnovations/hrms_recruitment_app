// Smart matching (README §8) and the "Find Jobs For Me" service (README §9).

import { and, desc, eq, inArray, ne, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { applications, candidates, companies, findJobsRequests, jobs, recommendations, type Candidate, type Company, type Job } from "@/db/schema";
import { matchCandidateToJob, type MatchResult } from "@/lib/matching";
import { pluralize } from "@/lib/format";
import { educationsByCandidate, toMatchCandidate } from "./queries";
import { notify } from "./notify";

export type JobMatch = { job: Job; company: Company; match: MatchResult };
export type CandidateMatch = { candidate: Candidate; match: MatchResult };

export async function activeJobsWithCompany(excludeJobIds: string[] = []) {
  const where = excludeJobIds.length ? and(eq(jobs.status, "active"), notInArray(jobs.id, excludeJobIds)) : eq(jobs.status, "active");
  return db.select({ job: jobs, company: companies }).from(jobs).innerJoin(companies, eq(companies.id, jobs.companyId)).where(where).orderBy(desc(jobs.publishedAt));
}

/** Jobs that match a candidate, best first. */
export async function matchesForCandidate(candidate: Candidate, opts: { minScore?: number; eligibleOnly?: boolean; excludeApplied?: boolean; limit?: number } = {}): Promise<JobMatch[]> {
  const eds = (await educationsByCandidate([candidate.id])).get(candidate.id) ?? [];
  const mc = toMatchCandidate(candidate, eds);
  let exclude: string[] = [];
  if (opts.excludeApplied ?? true) {
    const applied = await db.select({ jobId: applications.jobId }).from(applications).where(eq(applications.candidateId, candidate.id));
    exclude = applied.map((a) => a.jobId);
  }
  const rows = await activeJobsWithCompany(exclude);
  const scored = rows
    .map(({ job, company }) => ({ job, company, match: matchCandidateToJob(mc, job) }))
    .filter((r) => r.match.score >= (opts.minScore ?? 0) && (!(opts.eligibleOnly ?? true) || r.match.eligible))
    .sort((a, b) => b.match.score - a.match.score);
  return opts.limit ? scored.slice(0, opts.limit) : scored;
}

/** Candidates that match a job, respecting each candidate's consent settings. */
export async function matchesForJob(job: Job, opts: { minScore?: number; eligibleOnly?: boolean; limit?: number } = {}): Promise<CandidateMatch[]> {
  const pool = await db
    .select()
    .from(candidates)
    .where(and(eq(candidates.allowRecommendations, true), eq(candidates.appearInSearch, true), ne(candidates.profileVisibility, "hidden"), ne(candidates.availability, "not_looking")));
  const applied = await db.select({ candidateId: applications.candidateId }).from(applications).where(eq(applications.jobId, job.id));
  const appliedIds = new Set(applied.map((a) => a.candidateId));
  const candidatesPool = pool.filter((c) => !appliedIds.has(c.id));
  const eds = await educationsByCandidate(candidatesPool.map((c) => c.id));
  const scored = candidatesPool
    .map((candidate) => ({ candidate, match: matchCandidateToJob(toMatchCandidate(candidate, eds.get(candidate.id) ?? []), job) }))
    .filter((r) => r.match.score >= (opts.minScore ?? 0) && (!(opts.eligibleOnly ?? true) || r.match.eligible))
    .sort((a, b) => b.match.score - a.match.score);
  return opts.limit ? scored.slice(0, opts.limit) : scored;
}

/** When a job goes live, tell well-matched candidates about it. */
export async function notifyMatchesForNewJob(job: Job): Promise<number> {
  const [company] = await db.select().from(companies).where(eq(companies.id, job.companyId)).limit(1);
  const matches = await matchesForJob(job, { minScore: 70, limit: 50 });
  for (const m of matches) {
    await notify(m.candidate.userId, {
      type: "job_match",
      title: "A new job matches your profile",
      body: `${job.title} at ${company?.name ?? "a verified company"} — ${m.match.score}% match.`,
      link: `/jobs/${job.id}`,
    });
  }
  return matches.length;
}

export async function createRecommendation(input: {
  candidateId: string;
  jobId: string;
  source: "auto_match" | "recruitment_team" | "company_invite";
  score: number;
  reasons: MatchResult["reasons"];
  message?: string | null;
  createdByUserId?: string | null;
}) {
  const [existing] = await db
    .select()
    .from(recommendations)
    .where(and(eq(recommendations.candidateId, input.candidateId), eq(recommendations.jobId, input.jobId)))
    .limit(1);
  if (existing) return { recommendation: existing, created: false };
  const [rec] = await db
    .insert(recommendations)
    .values({ ...input, message: input.message ?? null, createdByUserId: input.createdByUserId ?? null })
    .returning();
  return { recommendation: rec!, created: true };
}

/**
 * Daily "Find Jobs For Me" run: Match → Recommend → Apply (with consent).
 * Candidates who opted into auto-apply get applications created on their behalf.
 */
export async function runFindJobsForMe(now = new Date(), applyFn?: (candidateId: string, jobId: string, score: number) => Promise<unknown>): Promise<{ recommended: number; applied: number }> {
  const requests = await db
    .select({ req: findJobsRequests, candidate: candidates })
    .from(findJobsRequests)
    .innerJoin(candidates, eq(candidates.id, findJobsRequests.candidateId))
    .where(eq(findJobsRequests.status, "active"));
  let recommended = 0;
  let applied = 0;
  for (const { req, candidate } of requests) {
    const already = await db.select({ jobId: recommendations.jobId }).from(recommendations).where(eq(recommendations.candidateId, candidate.id));
    const alreadyIds = new Set(already.map((r) => r.jobId));
    // Apply the request's preferences on top of the profile.
    const effective: Candidate = {
      ...candidate,
      expectedCtc: req.expectedCtc ?? candidate.expectedCtc,
      experienceYears: req.experienceYears ?? candidate.experienceYears,
      industry: req.preferredIndustry ?? candidate.industry,
      preferredLocations: req.preferredLocations.length ? req.preferredLocations : candidate.preferredLocations,
      workModePreference: req.workMode,
      noticePeriodDays: req.joiningAvailabilityDays ?? candidate.noticePeriodDays,
    };
    const role = req.desiredRole.toLowerCase();
    const matches = (await matchesForCandidate(effective, { minScore: 60 })).filter(
      (m) => !alreadyIds.has(m.job.id) && (m.match.score >= 75 || m.job.title.toLowerCase().includes(role.split(" ")[0] ?? role)),
    );
    let newCount = 0;
    for (const m of matches.slice(0, 10)) {
      const { recommendation, created } = await createRecommendation({ candidateId: candidate.id, jobId: m.job.id, source: "auto_match", score: m.match.score, reasons: m.match.reasons });
      if (!created) continue;
      newCount++;
      recommended++;
      if (req.applyMode === "auto_apply" && applyFn) {
        await applyFn(candidate.id, m.job.id, m.match.score);
        await db.update(recommendations).set({ status: "applied", respondedAt: now }).where(eq(recommendations.id, recommendation.id));
        applied++;
      }
    }
    await db.update(findJobsRequests).set({ lastMatchedAt: now }).where(eq(findJobsRequests.id, req.id));
    if (newCount > 0) {
      await notify(candidate.userId, {
        type: "job_match",
        title: `Your profile has matched ${pluralize(newCount, "new job")}.`,
        body: req.applyMode === "auto_apply" ? "We applied on your behalf as you requested. Track them under Applications." : "Review the recommendations and choose which ones to apply for.",
        link: "/candidate/find-jobs",
      });
    }
  }
  return { recommended, applied };
}

export async function jobsByIds(ids: string[]) {
  if (!ids.length) return [];
  return db.select({ job: jobs, company: companies }).from(jobs).innerJoin(companies, eq(companies.id, jobs.companyId)).where(inArray(jobs.id, ids));
}
