import { describe, expect, it } from "vitest";
import { buildIcs } from "@/lib/ics";
import { parseList } from "@/lib/format";
import { makeMaskedAddress, parseMaskedAddress, bareAddress } from "@/lib/masked-address";
import { summarizeFeedbackRules, DECISION_DISCLAIMER } from "@/lib/interview-summary";
import { can } from "@/lib/permissions";
import { resumeInsights } from "@/lib/resume-insights";

describe("masked addresses", () => {
  it("generates and parses relay addresses", () => {
    const addr = makeMaskedAddress("hr", () => 53543);
    expect(addr).toBe("hr_53543@panel.com");
    expect(parseMaskedAddress(addr)).toEqual({ kind: "hr", code: "53543" });
    expect(parseMaskedAddress("Candidate <candidate_82731@panel.com>")).toEqual({ kind: "candidate", code: "82731" });
    expect(parseMaskedAddress("hr_53543@evil.com")).toBeNull();
    expect(bareAddress("XYZ HR <HR@XYZ.com>")).toBe("hr@xyz.com");
  });
});

it("parseList splits and de-duplicates", () => {
  expect(parseList("React, node.js,\nReact , SQL,,")).toEqual(["React", "node.js", "SQL"]);
});

it("builds a valid ics event", () => {
  const ics = buildIcs({ uid: "abc@hrms", title: "Interview 1, Backend", start: new Date("2026-10-01T05:30:00Z"), durationMinutes: 45, now: new Date("2026-09-01T00:00:00Z") });
  expect(ics).toContain("DTSTART:20261001T053000Z");
  expect(ics).toContain("DTEND:20261001T061500Z");
  expect(ics).toContain("SUMMARY:Interview 1\\, Backend");
  expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
});

describe("interview summary", () => {
  it("summarises ratings and keeps the decision with the employer", () => {
    const s = summarizeFeedbackRules(
      [
        { interviewTitle: "Tech", interviewer: "Ravi", technical: 5, communication: 4, roleFit: 4, experience: 4, recommendation: "strong_yes", strengths: "Great system design", salaryNotes: "Expects 18 LPA" },
        { interviewTitle: "HR", interviewer: "Meena", technical: 4, communication: 2, roleFit: 3, experience: 4, recommendation: "maybe", concerns: "Rambling answers", availabilityNotes: "30 days notice" },
      ],
      { candidateName: "Asha", jobTitle: "Backend Engineer" },
    );
    expect(s).toContain("Technical skills: 4.5/5 — Excellent");
    expect(s).toContain("Communication: 3.0/5 — Adequate");
    expect(s).toContain("Great system design (Ravi)");
    expect(s).toContain("Expects 18 LPA (Ravi)");
    expect(s).toContain("30 days notice (Meena)");
    expect(s.trim().endsWith(DECISION_DISCLAIMER)).toBe(true);
  });
});

it("applies recruiter workspace permissions", () => {
  expect(can("hr_admin", "billing.manage")).toBe(true);
  expect(can("recruiter", "billing.manage")).toBe(false);
  expect(can("recruiter", "jobs.manage")).toBe(true);
  expect(can("hiring_manager", "jobs.manage")).toBe(false);
  expect(can("interviewer", "pipeline.view")).toBe(false);
  expect(can("interviewer", "interviews.feedback")).toBe(true);
});

it("suggests resume improvements and job-specific skills", () => {
  const r = resumeInsights(
    { headline: null, summary: "short", skills: ["React"], sections: ["summary", "skills"], experiences: [{ description: "Did stuff" }], educationCount: 0, certificationCount: 0, projectCount: 0, languages: [], experienceYears: 3 },
    { title: "Frontend Dev", requiredSkills: ["React", "TypeScript"], preferredSkills: ["GraphQL"] },
  );
  expect(r.completeness).toBeLessThan(30);
  expect(r.missingJobSkills).toEqual(["TypeScript", "GraphQL"]);
  expect(r.suggestions[0]).toContain("TypeScript, GraphQL");
});
