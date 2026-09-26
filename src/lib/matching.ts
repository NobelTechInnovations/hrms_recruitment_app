// Transparent candidate ↔ job matching (README §8, §17 notice-period & CTC matching).
// Every point of the score is backed by a human-readable reason, so companies see
// *why* a candidate matches rather than an opaque "AI score".

import { educationRank, labelOf, EDUCATION_LEVELS, INDUSTRIES } from "./constants";
import type { MandatoryRequirements, MatchReason } from "@/db/schema";
import { formatCtcRange, formatLpa, formatYears } from "./format";

export type MatchCandidate = {
  skills: string[];
  experienceYears: number;
  highestEducation: string | null;
  currentLocation: string | null;
  preferredLocations: string[];
  workModePreference: string;
  currentCtc: number | null;
  expectedCtc: number | null;
  noticePeriodDays: number | null;
  availability: string;
  industry: string | null;
  level1Qualified: boolean;
  level2Category: string | null; // set only when level 2 is qualified
  identityVerified: boolean;
};

export type MatchJob = {
  industry: string;
  location: string;
  workMode: string;
  minExperience: number;
  maxExperience: number | null;
  educationLevel: string;
  requiredSkills: string[];
  preferredSkills: string[];
  minCtc: number | null;
  maxCtc: number | null;
  joiningWithinDays: number | null;
  maxNoticePeriodDays: number | null;
  mandatory: MandatoryRequirements;
};

export type MatchResult = {
  score: number; // 0–100
  eligible: boolean;
  failedMandatory: string[];
  reasons: MatchReason[];
};

const WEIGHTS = {
  requiredSkills: 30,
  preferredSkills: 5,
  experience: 15,
  education: 10,
  location: 10,
  salary: 10,
  notice: 10,
  industry: 5,
  screening: 5,
} as const;

/** Normalise a skill for comparison: "Node.js" ≈ "NodeJS" ≈ "node". */
export function normalizeSkill(skill: string): string {
  let s = skill.toLowerCase().replace(/[^a-z0-9+#]/g, "");
  if (s.length > 4 && s.endsWith("js")) s = s.slice(0, -2);
  return s;
}

export function skillOverlap(candidateSkills: string[], jobSkills: string[]) {
  const have = new Set(candidateSkills.map(normalizeSkill));
  const matched: string[] = [];
  const missing: string[] = [];
  for (const skill of jobSkills) (have.has(normalizeSkill(skill)) ? matched : missing).push(skill);
  return { matched, missing };
}

/** Days until the candidate can join, based on availability and notice period. */
export function joiningDays(c: Pick<MatchCandidate, "availability" | "noticePeriodDays">): number | null {
  if (c.availability === "immediate") return 0;
  if (c.noticePeriodDays != null) return c.noticePeriodDays;
  if (c.availability === "within_30") return 30;
  return null;
}

function locationMatches(jobLocation: string, candidateLocations: string[]): boolean {
  const job = jobLocation.toLowerCase();
  return candidateLocations.some((loc) => {
    const l = loc.toLowerCase().trim();
    if (!l) return false;
    if (l === "anywhere" || l === "any") return true;
    return job.includes(l) || l.includes(job.split(",")[0]!.trim());
  });
}

function status(fraction: number): MatchReason["status"] {
  if (fraction >= 0.99) return "match";
  if (fraction > 0) return "partial";
  return "mismatch";
}

export function matchCandidateToJob(c: MatchCandidate, job: MatchJob): MatchResult {
  const reasons: MatchReason[] = [];
  let score = 0;
  const add = (factor: string, weight: number, fraction: number, detail: string) => {
    const f = Math.max(0, Math.min(1, fraction));
    score += weight * f;
    reasons.push({ factor, status: status(f), detail });
  };

  // Skills
  if (job.requiredSkills.length > 0) {
    const { matched, missing } = skillOverlap(c.skills, job.requiredSkills);
    const frac = matched.length / job.requiredSkills.length;
    let detail = `Has ${matched.length} of ${job.requiredSkills.length} required skills`;
    if (matched.length) detail += ` (${matched.join(", ")})`;
    if (missing.length) detail += `; missing ${missing.join(", ")}`;
    add("Required skills", WEIGHTS.requiredSkills, frac, detail);
  } else {
    add("Required skills", WEIGHTS.requiredSkills, 1, "No specific skills required");
  }
  if (job.preferredSkills.length > 0) {
    const { matched } = skillOverlap(c.skills, job.preferredSkills);
    add(
      "Preferred skills",
      WEIGHTS.preferredSkills,
      matched.length / job.preferredSkills.length,
      matched.length ? `Also has ${matched.join(", ")}` : "None of the preferred skills listed",
    );
  } else {
    score += WEIGHTS.preferredSkills;
  }

  // Experience
  const exp = c.experienceYears;
  const range = job.maxExperience != null ? `${job.minExperience}–${job.maxExperience} yrs` : `${job.minExperience}+ yrs`;
  if (exp >= job.minExperience && (job.maxExperience == null || exp <= job.maxExperience + 2)) {
    add("Experience", WEIGHTS.experience, 1, `${formatYears(exp)} of experience; role needs ${range}`);
  } else if (exp > (job.maxExperience ?? Infinity)) {
    add("Experience", WEIGHTS.experience, 0.6, `${formatYears(exp)} is above the ${range} range (may be overqualified)`);
  } else {
    const frac = job.minExperience > 0 ? (exp / job.minExperience) * 0.7 : 0;
    add("Experience", WEIGHTS.experience, frac, `${formatYears(exp)} of experience; role needs ${range}`);
  }

  // Education
  const need = educationRank(job.educationLevel);
  const have = educationRank(c.highestEducation);
  if (need === 0) {
    add("Education", WEIGHTS.education, 1, "No minimum education required");
  } else if (have >= need) {
    add("Education", WEIGHTS.education, 1, `${labelOf(EDUCATION_LEVELS, c.highestEducation)} meets the ${labelOf(EDUCATION_LEVELS, job.educationLevel)} requirement`);
  } else {
    add(
      "Education",
      WEIGHTS.education,
      have === need - 1 ? 0.4 : 0,
      `${c.highestEducation ? labelOf(EDUCATION_LEVELS, c.highestEducation) : "No education listed"}; role needs ${labelOf(EDUCATION_LEVELS, job.educationLevel)}`,
    );
  }

  // Location & work mode
  if (job.workMode === "remote") {
    const fits = c.workModePreference !== "onsite";
    add("Location", WEIGHTS.location, fits ? 1 : 0.7, fits ? "Remote role — location independent" : "Remote role, but candidate prefers on-site work");
  } else {
    const locOk = locationMatches(job.location, [c.currentLocation ?? "", ...c.preferredLocations]);
    const modeOk = c.workModePreference === "any" || c.workModePreference === job.workMode || (job.workMode === "hybrid" && c.workModePreference !== "remote");
    const frac = (locOk ? 0.6 : 0) + (modeOk ? 0.4 : 0);
    const parts = [
      locOk ? `Based in or open to ${job.location}` : `Not located in ${job.location}`,
      modeOk ? `open to ${job.workMode === "onsite" ? "on-site" : "hybrid"} work` : `prefers ${c.workModePreference} work`,
    ];
    add("Location", WEIGHTS.location, frac, parts.join("; "));
  }

  // Salary (CTC matching)
  if (c.expectedCtc == null || (job.minCtc == null && job.maxCtc == null)) {
    add("Salary", WEIGHTS.salary, 0.5, c.expectedCtc == null ? "Expected CTC not specified" : "Job CTC range not disclosed");
  } else {
    const max = job.maxCtc ?? job.minCtc!;
    const rangeText = formatCtcRange(job.minCtc, job.maxCtc);
    const current = c.currentCtc != null ? `Current ${formatLpa(c.currentCtc)}, expects ` : "Expects ";
    if (c.expectedCtc <= max) {
      add("Salary", WEIGHTS.salary, 1, `${current}${formatLpa(c.expectedCtc)}; job offers ${rangeText}`);
    } else if (c.expectedCtc <= max * 1.15) {
      add("Salary", WEIGHTS.salary, 0.5, `${current}${formatLpa(c.expectedCtc)}, slightly above ${rangeText} (negotiable)`);
    } else {
      add("Salary", WEIGHTS.salary, 0, `${current}${formatLpa(c.expectedCtc)}, above ${rangeText}`);
    }
  }

  // Notice period / joining timeline
  const days = joiningDays(c);
  const needBy = job.joiningWithinDays ?? job.maxNoticePeriodDays;
  if (needBy == null) {
    add("Notice period", WEIGHTS.notice, 1, days != null ? `Can join in ${days === 0 ? "immediately" : `${days} days`}` : "No joining deadline");
  } else if (days == null) {
    add("Notice period", WEIGHTS.notice, 0.5, `Notice period not specified; role needs joining within ${needBy} days`);
  } else if (days <= needBy) {
    add("Notice period", WEIGHTS.notice, 1, `Can join ${days === 0 ? "immediately" : `in ${days} days`}; role needs joining within ${needBy} days`);
  } else if (days <= needBy + 15) {
    add("Notice period", WEIGHTS.notice, 0.5, `Can join in ${days} days; role prefers within ${needBy} days`);
  } else {
    add("Notice period", WEIGHTS.notice, 0, `Can join in ${days} days; role needs joining within ${needBy} days`);
  }

  // Industry
  if (c.industry && c.industry === job.industry) {
    add("Industry", WEIGHTS.industry, 1, `Background in ${labelOf(INDUSTRIES, job.industry)}`);
  } else {
    add("Industry", WEIGHTS.industry, 0, c.industry ? `Background in ${labelOf(INDUSTRIES, c.industry)}` : "Industry not specified");
  }

  // Screening
  const l2 = c.level2Category === job.industry;
  const screeningFrac = (c.level1Qualified ? 0.5 : 0) + (l2 ? 0.5 : 0);
  const screeningParts = [c.level1Qualified ? "Level 1 aptitude qualified" : "Level 1 not yet qualified"];
  if (c.level2Category) screeningParts.push(l2 ? "Level 2 qualified in this industry" : `Level 2 qualified in ${labelOf(INDUSTRIES, c.level2Category)}`);
  add("Screening", WEIGHTS.screening, screeningFrac, screeningParts.join("; "));

  // Mandatory requirements
  const failed: string[] = [];
  const m = job.mandatory ?? {};
  if (m.experience && exp < job.minExperience) failed.push(`Minimum ${job.minExperience} years experience`);
  if (m.noticePeriod && job.maxNoticePeriodDays != null && (days == null || days > job.maxNoticePeriodDays)) {
    failed.push(`Maximum notice period ${job.maxNoticePeriodDays} days`);
  }
  if (m.education && have < need) failed.push(`${labelOf(EDUCATION_LEVELS, job.educationLevel)} required`);
  if (m.minCurrentCtc != null && m.minCurrentCtc > 0 && (c.currentCtc == null || c.currentCtc < m.minCurrentCtc)) {
    failed.push(`Minimum current CTC ${formatLpa(m.minCurrentCtc)}`);
  }
  if (m.requireLevel1 && !c.level1Qualified) failed.push("Level 1 aptitude qualification");
  if (m.requireLevel2 && !l2) failed.push(`Level 2 ${labelOf(INDUSTRIES, job.industry)} qualification`);
  if (m.requireIdentityVerified && !c.identityVerified) failed.push("Verified identity");

  return { score: Math.round(score), eligible: failed.length === 0, failedMandatory: failed, reasons };
}

/** Human-readable list of the job's mandatory requirements. */
export function describeMandatory(job: Pick<MatchJob, "mandatory" | "minExperience" | "maxNoticePeriodDays" | "educationLevel" | "industry">): string[] {
  const m = job.mandatory ?? {};
  const out: string[] = [];
  if (m.experience && job.minExperience > 0) out.push(`Minimum ${job.minExperience} years experience`);
  if (m.noticePeriod && job.maxNoticePeriodDays != null) out.push(`Maximum notice period ${job.maxNoticePeriodDays} days`);
  if (m.education && job.educationLevel !== "any") out.push(`${labelOf(EDUCATION_LEVELS, job.educationLevel)} required`);
  if (m.minCurrentCtc) out.push(`Minimum current CTC ${formatLpa(m.minCurrentCtc)}`);
  if (m.requireLevel1) out.push("Level 1 aptitude qualified");
  if (m.requireLevel2) out.push(`Level 2 ${labelOf(INDUSTRIES, job.industry)} qualified`);
  if (m.requireIdentityVerified) out.push("Identity verified");
  return out;
}
