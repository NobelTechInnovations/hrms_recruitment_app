import type { Resume } from "@/db/schema";
import type { CandidateBundle } from "./queries";
import type { ResumeData } from "./resume-pdf";

function month(ym: string | null): string {
  if (!ym) return "Present";
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export function buildResumeData(resume: Resume, b: CandidateBundle): ResumeData {
  const c = b.candidate;
  return {
    template: resume.template,
    name: c.fullName,
    headline: resume.headline ?? c.headline,
    contact: [c.maskedEmail, c.currentLocation, c.linkedinUrl?.replace(/^https?:\/\/(www\.)?/, ""), c.portfolioUrl?.replace(/^https?:\/\/(www\.)?/, "")].filter((x): x is string => !!x),
    summary: resume.summary ?? c.summary,
    skills: resume.skills.length ? resume.skills : c.skills,
    languages: c.languages,
    sections: resume.sections,
    experiences: b.experiences.map((e) => ({ title: e.title, company: e.company, location: e.location, period: `${month(e.startDate)} – ${e.isCurrent ? "Present" : month(e.endDate)}`, description: e.description })),
    educations: b.educations.map((e) => ({ degree: e.degree, institution: e.institution, period: [e.startYear, e.endYear].filter(Boolean).join(" – "), grade: e.grade })),
    certifications: b.certifications.map((x) => ({ name: x.name, issuer: x.issuer, year: x.year })),
    projects: b.projects.map((p) => ({ name: p.name, description: p.description, url: p.url })),
  };
}
