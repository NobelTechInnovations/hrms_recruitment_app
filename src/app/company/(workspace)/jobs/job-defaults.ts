import type { Job } from "@/db/schema";
import type { JobDefaults } from "./job-form";

const s = (v: unknown) => (v == null ? "" : String(v));

export function jobDefaults(job?: Job | null, industry?: string | null): JobDefaults {
  const m = job?.mandatory ?? {};
  return {
    title: s(job?.title),
    department: s(job?.department),
    industry: s(job?.industry ?? industry ?? "it"),
    location: s(job?.location),
    workMode: s(job?.workMode),
    employmentType: s(job?.employmentType),
    minExperience: s(job?.minExperience),
    maxExperience: s(job?.maxExperience),
    educationLevel: s(job?.educationLevel),
    requiredSkills: job?.requiredSkills.join(", ") ?? "",
    preferredSkills: job?.preferredSkills.join(", ") ?? "",
    description: s(job?.description),
    responsibilities: s(job?.responsibilities),
    minCtc: s(job?.minCtc),
    maxCtc: s(job?.maxCtc),
    incentives: s(job?.incentives),
    benefits: s(job?.benefits),
    vacancies: s(job?.vacancies),
    joiningWithinDays: s(job?.joiningWithinDays),
    maxNoticePeriodDays: s(job?.maxNoticePeriodDays),
    interviewProcess: s(job?.interviewProcess),
    interviewRequirements: s(job?.interviewRequirements),
    minCurrentCtc: s(m.minCurrentCtc),
    mandatory: {
      experience: !!m.experience,
      noticePeriod: !!m.noticePeriod,
      education: !!m.education,
      requireLevel1: !!m.requireLevel1,
      requireLevel2: !!m.requireLevel2,
      requireIdentityVerified: !!m.requireIdentityVerified,
    },
  };
}
