// Job discovery (README §7) with the filters listed in the spec.

import { and, desc, eq, gte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { companies, jobs, savedJobs, type Candidate, type Company, type Job } from "@/db/schema";
import { educationRank } from "@/lib/constants";
import { matchCandidateToJob, normalizeSkill, type MatchResult } from "@/lib/matching";
import { parseList } from "@/lib/format";
import { educationsByCandidate, toMatchCandidate } from "./queries";

export type JobFilters = {
  q?: string;
  location?: string;
  industry?: string;
  workMode?: string;
  employmentType?: string;
  minSalary?: string;
  experience?: string;
  education?: string;
  skills?: string;
  company?: string;
  verified?: string;
  posted?: string;
  sort?: string;
  page?: string;
};

export type JobRow = { job: Job; company: Company; match?: MatchResult; saved?: boolean; priority: boolean; featured: boolean };

const PAGE_SIZE = 12;

export async function searchJobs(f: JobFilters, candidate?: Candidate | null) {
  const now = new Date();
  const conds: SQL[] = [eq(jobs.status, "active")];
  if (f.industry) conds.push(eq(jobs.industry, f.industry));
  if (f.workMode) conds.push(eq(jobs.workMode, f.workMode as Job["workMode"]));
  if (f.employmentType) conds.push(eq(jobs.employmentType, f.employmentType as Job["employmentType"]));
  if (f.company) conds.push(eq(jobs.companyId, f.company));
  if (f.verified === "1") conds.push(eq(companies.verificationStatus, "verified"));
  if (f.posted && /^\d+$/.test(f.posted)) conds.push(gte(jobs.publishedAt, new Date(now.getTime() - Number(f.posted) * 86_400_000)));

  let rows = await db
    .select({ job: jobs, company: companies })
    .from(jobs)
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(and(...conds))
    .orderBy(desc(jobs.publishedAt));

  const q = f.q?.trim().toLowerCase();
  if (q) {
    rows = rows.filter(({ job, company }) =>
      [job.title, job.department, company.name, job.description, ...job.requiredSkills, ...job.preferredSkills].some((v) => v?.toLowerCase().includes(q)),
    );
  }
  const loc = f.location?.trim().toLowerCase();
  if (loc) rows = rows.filter(({ job }) => job.location.toLowerCase().includes(loc) || (loc === "remote" && job.workMode === "remote"));
  if (f.minSalary && Number(f.minSalary) > 0) {
    const min = Number(f.minSalary);
    rows = rows.filter(({ job }) => (job.maxCtc ?? job.minCtc ?? 0) >= min);
  }
  if (f.experience && f.experience !== "") {
    const exp = Number(f.experience);
    rows = rows.filter(({ job }) => job.minExperience <= exp && (job.maxExperience == null || job.maxExperience >= exp));
  }
  if (f.education) {
    const rank = educationRank(f.education);
    rows = rows.filter(({ job }) => educationRank(job.educationLevel) <= rank);
  }
  const skills = parseList(f.skills).map(normalizeSkill);
  if (skills.length) {
    rows = rows.filter(({ job }) => {
      const js = [...job.requiredSkills, ...job.preferredSkills].map(normalizeSkill);
      return skills.every((s) => js.includes(s));
    });
  }

  let savedIds = new Set<string>();
  let mc: ReturnType<typeof toMatchCandidate> | null = null;
  if (candidate) {
    const saved = await db.select({ jobId: savedJobs.jobId }).from(savedJobs).where(eq(savedJobs.candidateId, candidate.id));
    savedIds = new Set(saved.map((s) => s.jobId));
    mc = toMatchCandidate(candidate, (await educationsByCandidate([candidate.id])).get(candidate.id) ?? []);
  }

  const enriched: JobRow[] = rows.map(({ job, company }) => ({
    job,
    company,
    match: mc ? matchCandidateToJob(mc, job) : undefined,
    saved: savedIds.has(job.id),
    priority: !!job.priorityUntil && job.priorityUntil > now,
    featured: !!company.featuredUntil && company.featuredUntil > now,
  }));

  const sort = f.sort ?? (candidate ? "match" : "newest");
  enriched.sort((a, b) => {
    if (sort === "match" && a.match && b.match) return b.match.score - a.match.score;
    if (sort === "salary") return (b.job.maxCtc ?? b.job.minCtc ?? 0) - (a.job.maxCtc ?? a.job.minCtc ?? 0);
    // "newest": paid priority postings first, then most recent.
    if (a.priority !== b.priority) return a.priority ? -1 : 1;
    return (b.job.publishedAt?.getTime() ?? 0) - (a.job.publishedAt?.getTime() ?? 0);
  });

  const total = enriched.length;
  const page = Math.max(1, Number(f.page) || 1);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return { rows: enriched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total, page, pages, sort };
}

export async function hiringCompanies() {
  return db
    .selectDistinct({ id: companies.id, name: companies.name })
    .from(companies)
    .innerJoin(jobs, eq(jobs.companyId, companies.id))
    .where(eq(jobs.status, "active"))
    .orderBy(companies.name);
}
