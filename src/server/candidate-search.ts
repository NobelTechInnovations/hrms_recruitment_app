// Company-side candidate search (README Company Dashboard: search, filter, shortlist)
// honouring each candidate's consent settings (README §17).

import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { candidates, type Candidate, type Job } from "@/db/schema";
import { educationRank } from "@/lib/constants";
import { matchCandidateToJob, joiningDays, normalizeSkill, type MatchResult } from "@/lib/matching";
import { parseList } from "@/lib/format";
import type { VerificationLevel } from "@/lib/profile-score";
import { educationsByCandidate, profileScoresFor, toMatchCandidate, highestEducation } from "./queries";

export type CandidateFilters = {
  q?: string;
  skills?: string;
  industry?: string;
  minExp?: string;
  maxExp?: string;
  location?: string;
  maxCtc?: string;
  maxNotice?: string;
  availability?: string;
  verification?: string;
  screening?: string;
  education?: string;
  job?: string;
};

const LEVEL_ORDER: VerificationLevel[] = ["unverified", "basic", "identity", "professional", "full"];

export async function searchCandidates(f: CandidateFilters, job: Job | null) {
  let rows: Candidate[] = await db
    .select()
    .from(candidates)
    .where(and(eq(candidates.appearInSearch, true), eq(candidates.profileVisibility, "all_verified"), f.availability ? eq(candidates.availability, f.availability as Candidate["availability"]) : ne(candidates.availability, "not_looking")));

  const q = f.q?.trim().toLowerCase();
  if (q) rows = rows.filter((c) => [c.fullName, c.headline, c.currentDesignation, ...c.skills].some((v) => v?.toLowerCase().includes(q)));
  const skills = parseList(f.skills).map(normalizeSkill);
  if (skills.length) rows = rows.filter((c) => skills.every((s) => c.skills.map(normalizeSkill).includes(s)));
  if (f.industry) rows = rows.filter((c) => c.industry === f.industry);
  if (f.minExp) rows = rows.filter((c) => c.experienceYears >= Number(f.minExp));
  if (f.maxExp) rows = rows.filter((c) => c.experienceYears <= Number(f.maxExp));
  const loc = f.location?.trim().toLowerCase();
  if (loc) rows = rows.filter((c) => [c.currentLocation ?? "", ...c.preferredLocations].some((l) => l.toLowerCase().includes(loc) || l.toLowerCase() === "anywhere"));
  if (f.maxCtc) rows = rows.filter((c) => c.expectedCtc == null || c.expectedCtc <= Number(f.maxCtc));
  if (f.maxNotice) rows = rows.filter((c) => {
    const d = joiningDays(c);
    return d != null && d <= Number(f.maxNotice);
  });
  if (f.screening === "l1") rows = rows.filter((c) => !!c.level1QualifiedAt);
  if (f.screening === "l2") rows = rows.filter((c) => !!c.level2QualifiedAt);

  const eds = await educationsByCandidate(rows.map((c) => c.id));
  if (f.education) {
    const need = educationRank(f.education);
    rows = rows.filter((c) => educationRank(highestEducation(eds.get(c.id) ?? [])) >= need);
  }
  const scores = await profileScoresFor(rows);
  if (f.verification) {
    const min = LEVEL_ORDER.indexOf(f.verification as VerificationLevel);
    rows = rows.filter((c) => LEVEL_ORDER.indexOf(scores.get(c.id)!.level) >= min);
  }

  const results: { candidate: Candidate; score: ReturnType<typeof scores.get> & object; match: MatchResult | null }[] = rows.map((c) => ({
    candidate: c,
    score: scores.get(c.id)!,
    match: job ? matchCandidateToJob(toMatchCandidate(c, eds.get(c.id) ?? []), job) : null,
  }));
  results.sort((a, b) => (a.match && b.match ? b.match.score - a.match.score : LEVEL_ORDER.indexOf(b.score.level) - LEVEL_ORDER.indexOf(a.score.level) || b.score.completion - a.score.completion));
  return results;
}
