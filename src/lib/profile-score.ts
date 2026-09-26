// Transparent profile completeness & qualification view (README §5, §17 verification levels).
// Deliberately NOT an opaque "AI hiring score": every item is a concrete, checkable fact.

export type ProfileFacts = {
  fullName: string | null;
  headline: string | null;
  hasPhoto: boolean;
  dateOfBirth: string | null;
  currentLocation: string | null;
  preferredLocations: string[];
  industry: string | null;
  experienceYears: number;
  currentDesignation: string | null;
  educationCount: number;
  experienceCount: number;
  skills: string[];
  languages: string[];
  currentCtc: number | null;
  expectedCtc: number | null;
  noticePeriodDays: number | null;
  availability: string;
  hasResume: boolean;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  identityVerified: boolean;
  educationVerified: boolean;
  experienceVerified: boolean;
  salaryVerified: boolean;
  locationVerified: boolean;
  level1Qualified: boolean;
  level2Qualified: boolean;
};

export type ChecklistItem = { label: string; done: boolean; weight?: number; hint?: string };
export type ProfileScore = {
  completion: number;
  completionItems: ChecklistItem[];
  verification: ChecklistItem[];
  screening: ChecklistItem[];
  professional: ChecklistItem[];
  level: VerificationLevel;
};

export type VerificationLevel = "unverified" | "basic" | "identity" | "professional" | "full";

export const VERIFICATION_LEVEL_LABELS: Record<VerificationLevel, string> = {
  unverified: "Unverified",
  basic: "Basic Verified",
  identity: "Identity Verified",
  professional: "Professional Verified",
  full: "Fully Verified",
};

export const VERIFICATION_LEVEL_DESCRIPTIONS: Record<VerificationLevel, string> = {
  unverified: "Complete at least 60% of your profile to become Basic Verified.",
  basic: "Profile is substantially complete.",
  identity: "Government identity document verified by the platform.",
  professional: "Identity, education and employment verified.",
  full: "Identity, education, employment, salary and location all verified.",
};

const filled = (s: string | null | undefined) => !!s && s.trim().length > 0;

export function completionItems(p: ProfileFacts): ChecklistItem[] {
  const fresher = p.experienceYears === 0;
  return [
    { label: "Full name", done: filled(p.fullName), weight: 5 },
    { label: "Professional headline", done: filled(p.headline), weight: 5 },
    { label: "Profile photo", done: p.hasPhoto, weight: 5 },
    { label: "Date of birth", done: filled(p.dateOfBirth), weight: 3 },
    { label: "Current location", done: filled(p.currentLocation), weight: 5 },
    { label: "Preferred locations", done: p.preferredLocations.length > 0, weight: 4 },
    { label: "Industry / career category", done: filled(p.industry), weight: 5 },
    { label: "Current role", done: fresher || filled(p.currentDesignation), weight: 5, hint: "Add your current designation" },
    { label: "Education", done: p.educationCount > 0, weight: 10 },
    { label: "Work experience", done: fresher || p.experienceCount > 0, weight: 10 },
    { label: "At least 3 skills", done: p.skills.length >= 3, weight: 10 },
    { label: "Languages", done: p.languages.length > 0, weight: 4 },
    { label: "Current CTC", done: fresher || p.currentCtc != null, weight: 4 },
    { label: "Expected CTC", done: p.expectedCtc != null, weight: 5 },
    { label: "Notice period", done: p.availability === "immediate" || p.noticePeriodDays != null, weight: 5 },
    { label: "Resume", done: p.hasResume, weight: 10 },
    { label: "LinkedIn or portfolio", done: filled(p.linkedinUrl) || filled(p.portfolioUrl), weight: 5 },
  ];
}

export function computeCompletion(items: ChecklistItem[]): number {
  const total = items.reduce((s, i) => s + (i.weight ?? 1), 0);
  const done = items.reduce((s, i) => s + (i.done ? (i.weight ?? 1) : 0), 0);
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export function verificationLevel(v: {
  identityVerified: boolean;
  educationVerified: boolean;
  experienceVerified: boolean;
  salaryVerified: boolean;
  locationVerified: boolean;
  completion: number;
}): VerificationLevel {
  if (v.identityVerified && v.educationVerified && v.experienceVerified && v.salaryVerified && v.locationVerified) return "full";
  if (v.identityVerified && v.educationVerified && v.experienceVerified) return "professional";
  if (v.identityVerified) return "identity";
  if (v.completion >= 60) return "basic";
  return "unverified";
}

export function profileScore(p: ProfileFacts): ProfileScore {
  const items = completionItems(p);
  const completion = computeCompletion(items);
  return {
    completion,
    completionItems: items,
    verification: [
      { label: "Identity", done: p.identityVerified },
      { label: "Education", done: p.educationVerified },
      { label: "Experience", done: p.experienceVerified },
      { label: "Salary", done: p.salaryVerified },
      { label: "Location", done: p.locationVerified },
    ],
    screening: [
      { label: "Aptitude Assessment (Level 1)", done: p.level1Qualified },
      { label: "Industry Assessment (Level 2)", done: p.level2Qualified },
    ],
    professional: [
      { label: "Resume", done: p.hasResume },
      { label: "Skills", done: p.skills.length >= 3 },
      { label: "Experience", done: p.experienceYears === 0 || p.experienceCount > 0 },
    ],
    level: verificationLevel({ ...p, completion }),
  };
}
