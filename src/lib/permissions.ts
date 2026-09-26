// Recruiter workspace role-based permissions (README §17 "Recruiter Workspace").

import type { CompanyRole } from "./constants";

export type CompanyPermission =
  | "company.edit"
  | "billing.manage"
  | "team.manage"
  | "jobs.manage"
  | "jobs.view"
  | "candidates.search"
  | "pipeline.view"
  | "pipeline.manage"
  | "interviews.schedule"
  | "interviews.feedback"
  | "messages.send";

const ALL: CompanyPermission[] = [
  "company.edit",
  "billing.manage",
  "team.manage",
  "jobs.manage",
  "jobs.view",
  "candidates.search",
  "pipeline.view",
  "pipeline.manage",
  "interviews.schedule",
  "interviews.feedback",
  "messages.send",
];

export const ROLE_PERMISSIONS: Record<CompanyRole, CompanyPermission[]> = {
  hr_admin: ALL,
  recruiter: ["jobs.manage", "jobs.view", "candidates.search", "pipeline.view", "pipeline.manage", "interviews.schedule", "interviews.feedback", "messages.send"],
  hiring_manager: ["jobs.view", "candidates.search", "pipeline.view", "pipeline.manage", "interviews.schedule", "interviews.feedback", "messages.send"],
  // Interviewers only see interviews assigned to them (enforced at query level).
  interviewer: ["interviews.feedback"],
};

export const ROLE_DESCRIPTIONS: Record<CompanyRole, string> = {
  hr_admin: "Full access, including company profile, billing and team management.",
  recruiter: "Post and manage jobs, search candidates, run the hiring pipeline and message candidates.",
  hiring_manager: "Review applicants, move them through the pipeline, schedule interviews and give feedback.",
  interviewer: "See interviews assigned to them and submit structured feedback.",
};

export function can(role: CompanyRole | null | undefined, permission: CompanyPermission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}
