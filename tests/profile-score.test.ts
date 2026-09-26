import { describe, expect, it } from "vitest";
import { profileScore, verificationLevel, type ProfileFacts } from "@/lib/profile-score";

const full: ProfileFacts = {
  fullName: "Asha Rao",
  headline: "Backend engineer",
  hasPhoto: true,
  dateOfBirth: "1995-02-01",
  currentLocation: "Pune",
  preferredLocations: ["Pune"],
  industry: "it",
  experienceYears: 4,
  currentDesignation: "SDE II",
  educationCount: 1,
  experienceCount: 2,
  skills: ["Go", "SQL", "AWS"],
  languages: ["English"],
  currentCtc: 10,
  expectedCtc: 14,
  noticePeriodDays: 30,
  availability: "within_30",
  hasResume: true,
  linkedinUrl: "https://linkedin.com/in/asha",
  portfolioUrl: null,
  identityVerified: true,
  educationVerified: true,
  experienceVerified: true,
  salaryVerified: true,
  locationVerified: true,
  level1Qualified: true,
  level2Qualified: true,
};

describe("profileScore", () => {
  it("is 100% for a complete profile", () => {
    const s = profileScore(full);
    expect(s.completion).toBe(100);
    expect(s.level).toBe("full");
    expect(s.verification.every((v) => v.done)).toBe(true);
  });

  it("drops for missing items and lists them", () => {
    const s = profileScore({ ...full, hasResume: false, skills: ["Go"], hasPhoto: false });
    expect(s.completion).toBe(75);
    expect(s.completionItems.filter((i) => !i.done).map((i) => i.label)).toEqual(["Profile photo", "At least 3 skills", "Resume"]);
  });

  it("does not require work history from freshers", () => {
    const s = profileScore({ ...full, experienceYears: 0, experienceCount: 0, currentDesignation: null, currentCtc: null });
    expect(s.completion).toBe(100);
  });
});

describe("verificationLevel", () => {
  const none = { identityVerified: false, educationVerified: false, experienceVerified: false, salaryVerified: false, locationVerified: false };
  it("climbs through the levels", () => {
    expect(verificationLevel({ ...none, completion: 30 })).toBe("unverified");
    expect(verificationLevel({ ...none, completion: 70 })).toBe("basic");
    expect(verificationLevel({ ...none, identityVerified: true, completion: 10 })).toBe("identity");
    expect(verificationLevel({ ...none, identityVerified: true, educationVerified: true, experienceVerified: true, completion: 10 })).toBe("professional");
  });
});
