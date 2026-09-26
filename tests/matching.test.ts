import { describe, expect, it } from "vitest";
import { describeMandatory, joiningDays, matchCandidateToJob, normalizeSkill, type MatchCandidate, type MatchJob } from "@/lib/matching";

const candidate: MatchCandidate = {
  skills: ["React.js", "Node", "SQL", "AWS"],
  experienceYears: 4,
  highestEducation: "graduate",
  currentLocation: "Bengaluru",
  preferredLocations: ["Pune"],
  workModePreference: "any",
  currentCtc: 6,
  expectedCtc: 8,
  noticePeriodDays: 15,
  availability: "within_30",
  industry: "it",
  level1Qualified: true,
  level2Category: "it",
  identityVerified: true,
};

const job: MatchJob = {
  industry: "it",
  location: "Bengaluru, Karnataka",
  workMode: "hybrid",
  minExperience: 2,
  maxExperience: 6,
  educationLevel: "graduate",
  requiredSkills: ["React", "Node.js", "SQL", "Docker"],
  preferredSkills: ["AWS"],
  minCtc: 7,
  maxCtc: 9,
  joiningWithinDays: 30,
  maxNoticePeriodDays: 30,
  mandatory: { experience: true, noticePeriod: true, education: true, minCurrentCtc: 5 },
};

describe("normalizeSkill", () => {
  it("treats common spelling variants as equal", () => {
    expect(normalizeSkill("Node.js")).toBe(normalizeSkill("NodeJS"));
    expect(normalizeSkill("React.js")).toBe(normalizeSkill("react"));
    expect(normalizeSkill("C++")).toBe("c++");
    expect(normalizeSkill("C#")).not.toBe(normalizeSkill("C"));
  });
});

describe("matchCandidateToJob", () => {
  it("scores a strong candidate highly and explains each factor", () => {
    const r = matchCandidateToJob(candidate, job);
    expect(r.eligible).toBe(true);
    expect(r.failedMandatory).toEqual([]);
    expect(r.score).toBeGreaterThanOrEqual(85);
    const skills = r.reasons.find((x) => x.factor === "Required skills")!;
    expect(skills.status).toBe("partial");
    expect(skills.detail).toContain("3 of 4");
    expect(skills.detail).toContain("missing Docker");
    const salary = r.reasons.find((x) => x.factor === "Salary")!;
    expect(salary.status).toBe("match");
    expect(salary.detail).toContain("₹8 LPA");
  });

  it("enforces the README's example mandatory requirements", () => {
    const junior = { ...candidate, experienceYears: 1, noticePeriodDays: 60, availability: "over_30", highestEducation: "diploma", currentCtc: 3 };
    const r = matchCandidateToJob(junior, job);
    expect(r.eligible).toBe(false);
    expect(r.failedMandatory).toEqual([
      "Minimum 2 years experience",
      "Maximum notice period 30 days",
      "Graduate (Bachelor's) required",
      "Minimum current CTC ₹5 LPA",
    ]);
  });

  it("requires level-2 qualification in the job's industry when mandated", () => {
    const r = matchCandidateToJob({ ...candidate, level2Category: "finance" }, { ...job, mandatory: { requireLevel2: true } });
    expect(r.eligible).toBe(false);
    expect(r.failedMandatory[0]).toContain("Level 2");
  });

  it("treats remote jobs as location independent", () => {
    const r = matchCandidateToJob({ ...candidate, currentLocation: "Kochi", preferredLocations: [] }, { ...job, workMode: "remote", location: "Remote" });
    expect(r.reasons.find((x) => x.factor === "Location")!.status).toBe("match");
  });

  it("penalises salary expectations well above the range", () => {
    const r = matchCandidateToJob({ ...candidate, expectedCtc: 15 }, job);
    expect(r.reasons.find((x) => x.factor === "Salary")!.status).toBe("mismatch");
  });

  it("scores stay within 0–100", () => {
    const r = matchCandidateToJob({ ...candidate, skills: [], experienceYears: 0, highestEducation: null, industry: null, level1Qualified: false, level2Category: null }, job);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe("joiningDays", () => {
  it("uses availability and notice period", () => {
    expect(joiningDays({ availability: "immediate", noticePeriodDays: 90 })).toBe(0);
    expect(joiningDays({ availability: "over_30", noticePeriodDays: 60 })).toBe(60);
    expect(joiningDays({ availability: "within_30", noticePeriodDays: null })).toBe(30);
    expect(joiningDays({ availability: "not_looking", noticePeriodDays: null })).toBeNull();
  });
});

describe("describeMandatory", () => {
  it("lists requirements in plain language", () => {
    expect(describeMandatory(job)).toEqual([
      "Minimum 2 years experience",
      "Maximum notice period 30 days",
      "Graduate (Bachelor's) required",
      "Minimum current CTC ₹5 LPA",
    ]);
  });
});
