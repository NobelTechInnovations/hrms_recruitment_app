// Resume completeness suggestions and job-specific tailoring hints (README §14).

import { skillOverlap } from "./matching";

export type ResumeContent = {
  headline: string | null;
  summary: string | null;
  skills: string[];
  sections: string[];
  experiences: { description: string | null }[];
  educationCount: number;
  certificationCount: number;
  projectCount: number;
  languages: string[];
  experienceYears: number;
};

export type ResumeInsights = { completeness: number; suggestions: string[]; missingJobSkills: string[] };

export function resumeInsights(r: ResumeContent, job?: { title: string; requiredSkills: string[]; preferredSkills: string[] } | null): ResumeInsights {
  const checks: { ok: boolean; tip: string }[] = [
    { ok: !!r.headline?.trim(), tip: "Add a headline that states your target role, e.g. “Senior Full-Stack Engineer”." },
    { ok: (r.summary?.trim().length ?? 0) >= 120, tip: "Write a 2–4 sentence professional summary (at least ~120 characters)." },
    { ok: r.skills.length >= 5, tip: "List at least 5 relevant skills." },
    {
      ok: r.experienceYears === 0 || (r.experiences.length > 0 && r.experiences.every((e) => (e.description?.trim().length ?? 0) >= 60)),
      tip: "Describe each role with responsibilities and measurable outcomes (numbers, %, ₹).",
    },
    { ok: r.educationCount > 0, tip: "Add your education." },
    { ok: r.certificationCount > 0 || r.projectCount > 0, tip: "Add certifications or projects to back up your skills." },
    { ok: r.languages.length > 0, tip: "Add the languages you speak." },
    { ok: r.sections.includes("experience") || r.experienceYears === 0, tip: "Include the Experience section — companies look for it first." },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const suggestions = checks.filter((c) => !c.ok).map((c) => c.tip);

  let missingJobSkills: string[] = [];
  if (job) {
    missingJobSkills = skillOverlap(r.skills, [...job.requiredSkills, ...job.preferredSkills]).missing;
    if (missingJobSkills.length) {
      suggestions.unshift(`Tailoring for “${job.title}”: if you have them, add ${missingJobSkills.join(", ")} to this resume.`);
    }
  }
  return { completeness: Math.round((passed / checks.length) * 100), suggestions, missingJobSkills };
}
