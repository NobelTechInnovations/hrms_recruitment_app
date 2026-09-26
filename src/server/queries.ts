// Shared read helpers.

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  applications,
  candidates,
  certifications,
  companies,
  documents,
  educations,
  experiences,
  jobs,
  placements,
  projects,
  resumes,
  type Candidate,
  type Education,
} from "@/db/schema";
import { educationRank, EDUCATION_LEVELS } from "@/lib/constants";
import type { MatchCandidate } from "@/lib/matching";
import { profileScore, type ProfileFacts } from "@/lib/profile-score";

export function highestEducation(eds: Pick<Education, "level">[]): string | null {
  let best: string | null = null;
  for (const e of eds) if (educationRank(e.level) > educationRank(best)) best = e.level;
  return best && EDUCATION_LEVELS.some((l) => l.value === best) ? best : null;
}

export function toMatchCandidate(c: Candidate, eds: Pick<Education, "level">[]): MatchCandidate {
  return {
    skills: c.skills,
    experienceYears: c.experienceYears,
    highestEducation: highestEducation(eds),
    currentLocation: c.currentLocation,
    preferredLocations: c.preferredLocations,
    workModePreference: c.workModePreference,
    currentCtc: c.currentCtc,
    expectedCtc: c.expectedCtc,
    noticePeriodDays: c.noticePeriodDays,
    availability: c.availability,
    industry: c.industry,
    level1Qualified: !!c.level1QualifiedAt,
    level2Category: c.level2QualifiedAt ? c.level2Category : null,
    identityVerified: !!c.identityVerifiedAt,
  };
}

export async function loadCandidateBundle(candidateId: string) {
  const [candidate] = await db.select().from(candidates).where(eq(candidates.id, candidateId)).limit(1);
  if (!candidate) return null;
  const [eds, exps, certs, projs, docs, res] = await Promise.all([
    db.select().from(educations).where(eq(educations.candidateId, candidateId)).orderBy(desc(educations.endYear)),
    db.select().from(experiences).where(eq(experiences.candidateId, candidateId)).orderBy(desc(experiences.isCurrent), desc(experiences.startDate)),
    db.select().from(certifications).where(eq(certifications.candidateId, candidateId)).orderBy(desc(certifications.year)),
    db.select().from(projects).where(eq(projects.candidateId, candidateId)),
    db
      .select()
      .from(documents)
      .where(and(eq(documents.ownerType, "candidate"), eq(documents.ownerId, candidateId)))
      .orderBy(desc(documents.createdAt)),
    db.select().from(resumes).where(eq(resumes.candidateId, candidateId)).orderBy(desc(resumes.isDefault), desc(resumes.updatedAt)),
  ]);
  return { candidate, educations: eds, experiences: exps, certifications: certs, projects: projs, documents: docs, resumes: res };
}

export type CandidateBundle = NonNullable<Awaited<ReturnType<typeof loadCandidateBundle>>>;

export function profileFacts(b: CandidateBundle): ProfileFacts {
  const c = b.candidate;
  return {
    fullName: c.fullName,
    headline: c.headline,
    hasPhoto: !!c.photoKey,
    dateOfBirth: c.dateOfBirth,
    currentLocation: c.currentLocation,
    preferredLocations: c.preferredLocations,
    industry: c.industry,
    experienceYears: c.experienceYears,
    currentDesignation: c.currentDesignation,
    educationCount: b.educations.length,
    experienceCount: b.experiences.length,
    skills: c.skills,
    languages: c.languages,
    currentCtc: c.currentCtc,
    expectedCtc: c.expectedCtc,
    noticePeriodDays: c.noticePeriodDays,
    availability: c.availability,
    hasResume: b.resumes.length > 0 || b.documents.some((d) => d.docType === "resume"),
    linkedinUrl: c.linkedinUrl,
    portfolioUrl: c.portfolioUrl,
    identityVerified: !!c.identityVerifiedAt,
    educationVerified: !!c.educationVerifiedAt,
    experienceVerified: !!c.experienceVerifiedAt,
    salaryVerified: !!c.salaryVerifiedAt,
    locationVerified: !!c.locationVerifiedAt,
    level1Qualified: !!c.level1QualifiedAt,
    level2Qualified: !!c.level2QualifiedAt,
  };
}

export function scoreFor(b: CandidateBundle) {
  return profileScore(profileFacts(b));
}

/** Lightweight score calculation for many candidates at once (e.g. search results). */
export async function profileScoresFor(candidateRows: Candidate[]) {
  if (!candidateRows.length) return new Map<string, ReturnType<typeof profileScore>>();
  const ids = candidateRows.map((c) => c.id);
  const [eds, exps, res, docs] = await Promise.all([
    db.select({ candidateId: educations.candidateId, level: educations.level }).from(educations).where(inArray(educations.candidateId, ids)),
    db.select({ candidateId: experiences.candidateId }).from(experiences).where(inArray(experiences.candidateId, ids)),
    db.select({ candidateId: resumes.candidateId }).from(resumes).where(inArray(resumes.candidateId, ids)),
    db
      .select({ ownerId: documents.ownerId })
      .from(documents)
      .where(and(eq(documents.ownerType, "candidate"), eq(documents.docType, "resume"), inArray(documents.ownerId, ids))),
  ]);
  const out = new Map<string, ReturnType<typeof profileScore>>();
  for (const c of candidateRows) {
    const bundle = {
      candidate: c,
      educations: eds.filter((e) => e.candidateId === c.id),
      experiences: exps.filter((e) => e.candidateId === c.id),
      resumes: res.filter((r) => r.candidateId === c.id),
      documents: docs.filter((d) => d.ownerId === c.id).map(() => ({ docType: "resume" })),
      certifications: [],
      projects: [],
    } as unknown as CandidateBundle;
    out.set(c.id, scoreFor(bundle));
  }
  return out;
}

export async function educationsByCandidate(ids: string[]) {
  const map = new Map<string, { level: string }[]>();
  if (!ids.length) return map;
  const rows = await db.select({ candidateId: educations.candidateId, level: educations.level }).from(educations).where(inArray(educations.candidateId, ids));
  for (const r of rows) {
    const list = map.get(r.candidateId) ?? [];
    list.push({ level: r.level });
    map.set(r.candidateId, list);
  }
  return map;
}

/** Company trust profile (README §17): verifiable facts only, no public ratings. */
export async function companyTrustStats(companyId: string) {
  const [[jobsRow], [activeRow], [hiresRow], [responseRow], [appsRow]] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(jobs).where(and(eq(jobs.companyId, companyId), inArray(jobs.status, ["active", "paused", "closed"]))),
    db.select({ n: sql<number>`count(*)` }).from(jobs).where(and(eq(jobs.companyId, companyId), eq(jobs.status, "active"))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(placements)
      .where(and(eq(placements.companyId, companyId), inArray(placements.status, ["in_guarantee", "fee_due", "completed", "fee_waived"]))),
    db
      .select({ hours: sql<number | null>`avg((${applications.firstResponseAt} - ${applications.createdAt}) / 3600000.0)` })
      .from(applications)
      .where(and(eq(applications.companyId, companyId), sql`${applications.firstResponseAt} is not null`)),
    db.select({ n: sql<number>`count(*)` }).from(applications).where(eq(applications.companyId, companyId)),
  ]);
  const [company] = await db.select({ createdAt: companies.createdAt }).from(companies).where(eq(companies.id, companyId)).limit(1);
  return {
    jobsPosted: Number(jobsRow?.n ?? 0),
    activeJobs: Number(activeRow?.n ?? 0),
    successfulHires: Number(hiresRow?.n ?? 0),
    applicationsReceived: Number(appsRow?.n ?? 0),
    avgResponseHours: responseRow?.hours == null ? null : Number(responseRow.hours),
    memberSince: company?.createdAt ?? null,
  };
}

export function formatResponseTime(hours: number | null): string {
  if (hours == null) return "No data yet";
  if (hours < 1) return "Under 1 hour";
  if (hours < 24) return `~${Math.round(hours)} hours`;
  return `~${Math.round(hours / 24)} days`;
}
