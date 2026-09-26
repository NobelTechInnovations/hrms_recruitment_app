"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  applications,
  certifications,
  documents,
  educations,
  experiences,
  findJobsRequests,
  jobReports,
  jobs,
  projects,
  recommendations,
  RESUME_SECTIONS,
  resumes,
  savedJobs,
  users,
  candidates,
  conversations,
  type ResumeSection,
} from "@/db/schema";
import { AVAILABILITY, CANDIDATE_DOC_TYPES, EDUCATION_LEVELS, INDUSTRIES } from "@/lib/constants";
import { UserError } from "@/lib/errors";
import { parseList } from "@/lib/format";
import { checkbox, fail, ok, optionalNumber, optionalText, optionalUrl, parseForm, requiredText, str, type ActionState } from "@/lib/forms";
import { attempt, revalidateAll } from "@/server/action-utils";
import { applyToJob, changeStage } from "@/server/applications";
import { startAttempt, submitAttempt } from "@/server/assessments";
import { requireCandidate } from "@/server/auth";
import { getOrCreateConversation, postMessage } from "@/server/messaging";
import { notifyAdmins } from "@/server/notify";
import { deleteUpload, saveUpload } from "@/server/storage";

const values = <T extends readonly { value: string }[]>(opts: T) => opts.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]];

// ─── Profile ────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  fullName: requiredText("Full name", 120),
  headline: optionalText(160),
  summary: optionalText(2000),
  dateOfBirth: optionalText(10),
  gender: optionalText(20),
  phone: optionalText(20),
  currentLocation: optionalText(100),
  preferredLocations: optionalText(300),
  industry: z.union([z.enum(values(INDUSTRIES)), z.literal("")]).transform((v) => v || null),
  currentCompany: optionalText(120),
  currentDesignation: optionalText(120),
  experienceYears: optionalNumber(0, 50),
  currentCtc: optionalNumber(0, 500),
  expectedCtc: optionalNumber(0, 500),
  noticePeriodDays: optionalNumber(0, 180),
  availability: z.enum(values(AVAILABILITY)),
  workModePreference: z.enum(["remote", "hybrid", "onsite", "any"]),
  skills: optionalText(1000),
  languages: optionalText(300),
  linkedinUrl: optionalUrl(),
  portfolioUrl: optionalUrl(),
  otherProfileUrl: optionalUrl(),
});

export async function updateProfileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, candidate } = await requireCandidate();
  const parsed = parseForm(profileSchema, fd);
  if (parsed.error) return parsed.error;
  const d = parsed.data;
  if (d.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(d.dateOfBirth)) return fail("Please fix the highlighted fields.", { dateOfBirth: "Use the date picker" });
  return attempt(async () => {
    await db
      .update(candidates)
      .set({
        fullName: d.fullName,
        headline: d.headline,
        summary: d.summary,
        dateOfBirth: d.dateOfBirth,
        gender: d.gender,
        currentLocation: d.currentLocation,
        preferredLocations: parseList(d.preferredLocations),
        industry: d.industry,
        currentCompany: d.currentCompany,
        currentDesignation: d.currentDesignation,
        experienceYears: d.experienceYears ?? 0,
        currentCtc: d.currentCtc,
        expectedCtc: d.expectedCtc,
        noticePeriodDays: d.availability === "immediate" ? 0 : d.noticePeriodDays,
        availability: d.availability,
        workModePreference: d.workModePreference,
        skills: parseList(d.skills),
        languages: parseList(d.languages),
        linkedinUrl: d.linkedinUrl,
        portfolioUrl: d.portfolioUrl,
        otherProfileUrl: d.otherProfileUrl,
        updatedAt: new Date(),
      })
      .where(eq(candidates.id, candidate.id));
    await db.update(users).set({ name: d.fullName, phone: d.phone }).where(eq(users.id, user.id));
  }, "Profile saved.");
}

export async function uploadPhotoAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  return attempt(async () => {
    const file = await saveUpload(fd.get("photo") as File, "photos", { imagesOnly: true });
    if (candidate.photoKey) await deleteUpload(candidate.photoKey);
    await db.update(candidates).set({ photoKey: file.storageKey, updatedAt: new Date() }).where(eq(candidates.id, candidate.id));
  }, "Photo updated.");
}

const educationSchema = z.object({
  level: z.enum(values(EDUCATION_LEVELS)),
  degree: requiredText("Degree", 120),
  fieldOfStudy: optionalText(120),
  institution: requiredText("Institution", 160),
  startYear: optionalNumber(1950, 2100),
  endYear: optionalNumber(1950, 2100),
  grade: optionalText(40),
});

export async function addEducationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  const parsed = parseForm(educationSchema, fd);
  if (parsed.error) return parsed.error;
  return attempt(async () => {
    await db.insert(educations).values({ ...parsed.data, candidateId: candidate.id });
  }, "Education added.");
}

const experienceSchema = z.object({
  company: requiredText("Company", 120),
  title: requiredText("Job title", 120),
  location: optionalText(100),
  startDate: z.string().regex(/^\d{4}-\d{2}$/, "Choose a start month"),
  endDate: optionalText(7),
  description: optionalText(3000),
});

export async function addExperienceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  const parsed = parseForm(experienceSchema, fd);
  if (parsed.error) return parsed.error;
  const isCurrent = checkbox(fd, "isCurrent");
  if (!isCurrent && !parsed.data.endDate) return fail("Please fix the highlighted fields.", { endDate: "Choose an end month or tick “I currently work here”" });
  return attempt(async () => {
    await db.insert(experiences).values({ ...parsed.data, endDate: isCurrent ? null : parsed.data.endDate, isCurrent, candidateId: candidate.id });
  }, "Experience added.");
}

const certificationSchema = z.object({
  name: requiredText("Certification name", 160),
  issuer: optionalText(120),
  year: optionalNumber(1950, 2100),
  credentialUrl: optionalUrl(),
});

export async function addCertificationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  const parsed = parseForm(certificationSchema, fd);
  if (parsed.error) return parsed.error;
  return attempt(async () => {
    await db.insert(certifications).values({ ...parsed.data, candidateId: candidate.id });
  }, "Certification added.");
}

const projectSchema = z.object({ name: requiredText("Project name", 160), description: optionalText(1000), url: optionalUrl() });

export async function addProjectAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  const parsed = parseForm(projectSchema, fd);
  if (parsed.error) return parsed.error;
  return attempt(async () => {
    await db.insert(projects).values({ ...parsed.data, candidateId: candidate.id });
  }, "Project added.");
}

export async function deleteProfileItemAction(kind: "education" | "experience" | "certification" | "project", id: string, _prev: ActionState): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  const table = { education: educations, experience: experiences, certification: certifications, project: projects }[kind];
  return attempt(async () => {
    await db.delete(table).where(and(eq(table.id, id), eq(table.candidateId, candidate.id)));
  });
}

// ─── Verification documents ────────────────────────────────────────────────

export async function uploadDocumentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  const docType = str(fd, "docType");
  if (!docType || !CANDIDATE_DOC_TYPES.some((d) => d.value === docType)) return fail("Choose a document type.", { docType: "Choose a document type" });
  return attempt(async () => {
    const file = await saveUpload(fd.get("file") as File, "documents");
    await db.insert(documents).values({ ownerType: "candidate", ownerId: candidate.id, docType, ...file, status: docType === "resume" ? "approved" : "pending" });
  }, docType === "resume" ? "Resume uploaded." : "Document uploaded — our verification team will review it shortly.");
}

export async function deleteDocumentAction(id: string, _prev: ActionState): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  return attempt(async () => {
    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.ownerType, "candidate"), eq(documents.ownerId, candidate.id)))
      .limit(1);
    if (!doc) throw new UserError("Document not found.");
    if (doc.status === "approved" && doc.docType !== "resume") throw new UserError("Verified documents can't be deleted. Contact support to revoke a verification.");
    await db.delete(documents).where(eq(documents.id, doc.id));
    await deleteUpload(doc.storageKey);
  });
}

// ─── Consent & privacy ─────────────────────────────────────────────────────

export async function updatePrivacyAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  const visibility = str(fd, "profileVisibility");
  if (visibility !== "all_verified" && visibility !== "applied_only" && visibility !== "hidden") return fail("Choose who can see your profile.");
  const shareable = fd
    .getAll("shareableDocTypes")
    .map(String)
    .filter((t) => CANDIDATE_DOC_TYPES.some((d) => d.value === t));
  return attempt(async () => {
    await db
      .update(candidates)
      .set({
        profileVisibility: visibility,
        appearInSearch: checkbox(fd, "appearInSearch"),
        allowRecruiterContact: checkbox(fd, "allowRecruiterContact"),
        allowRecommendations: checkbox(fd, "allowRecommendations"),
        shareableDocTypes: shareable,
        updatedAt: new Date(),
      })
      .where(eq(candidates.id, candidate.id));
  }, "Privacy settings saved.");
}

export async function setAvailabilityAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  const value = str(fd, "availability");
  const match = AVAILABILITY.find((a) => a.value === value);
  if (!match) return fail("Choose an availability option.");
  return attempt(async () => {
    await db
      .update(candidates)
      .set({ availability: match.value, noticePeriodDays: match.value === "immediate" ? 0 : candidate.noticePeriodDays, updatedAt: new Date() })
      .where(eq(candidates.id, candidate.id));
  }, "Availability updated.");
}

// ─── Jobs & applications ───────────────────────────────────────────────────

export async function toggleSaveJobAction(jobId: string, _prev: ActionState): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  return attempt(async () => {
    const [existing] = await db
      .select()
      .from(savedJobs)
      .where(and(eq(savedJobs.candidateId, candidate.id), eq(savedJobs.jobId, jobId)))
      .limit(1);
    if (existing) await db.delete(savedJobs).where(eq(savedJobs.id, existing.id));
    else await db.insert(savedJobs).values({ candidateId: candidate.id, jobId });
  });
}

export async function applyAction(jobId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  const choice = str(fd, "resume") ?? "";
  const coverNote = str(fd, "coverNote");
  if (coverNote && coverNote.length > 2000) return fail("Cover note is too long (2,000 characters max).");
  let appId: string | null = null;
  const result = await attempt(async () => {
    const app = await applyToJob({
      candidateId: candidate.id,
      jobId,
      resumeId: choice.startsWith("resume:") ? choice.slice(7) : null,
      uploadedResumeDocId: choice.startsWith("doc:") ? choice.slice(4) : null,
      coverNote,
      source: str(fd, "source") === "platform_match" ? "platform_match" : "direct",
    });
    appId = app.id;
  });
  if (appId) redirect(`/candidate/applications/${appId}?applied=1`);
  return result;
}

export async function withdrawApplicationAction(applicationId: string, _prev: ActionState): Promise<ActionState> {
  const { user, candidate } = await requireCandidate();
  return attempt(async () => {
    await changeStage({ applicationId, to: "withdrawn", actor: "candidate", actorUserId: user.id, candidateId: candidate.id });
  }, "Application withdrawn.");
}

export async function reportJobAction(jobId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await requireCandidate();
  const reason = str(fd, "reason");
  if (!reason) return fail("Choose a reason.", { reason: "Choose a reason" });
  return attempt(async () => {
    await db.insert(jobReports).values({ jobId, reporterUserId: user.id, reason, details: str(fd, "details") });
    await notifyAdmins({ type: "job_report", title: "A job was reported", body: reason, link: "/admin/jobs?tab=reports" });
  }, "Thanks — our moderation team will review this job.");
}

// ─── Find Jobs For Me ──────────────────────────────────────────────────────

const findJobsSchema = z.object({
  desiredRole: requiredText("Desired role", 120),
  preferredLocations: optionalText(300),
  expectedCtc: optionalNumber(0, 500),
  experienceYears: optionalNumber(0, 50),
  preferredIndustry: z.union([z.enum(values(INDUSTRIES)), z.literal("")]).transform((v) => v || null),
  workMode: z.enum(["remote", "hybrid", "onsite", "any"]),
  joiningAvailabilityDays: optionalNumber(0, 180),
  applyMode: z.enum(["ask_first", "auto_apply"]),
  notes: optionalText(1000),
});

export async function saveFindJobsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  const parsed = parseForm(findJobsSchema, fd);
  if (parsed.error) return parsed.error;
  const d = { ...parsed.data, preferredLocations: parseList(parsed.data.preferredLocations), updatedAt: new Date() };
  return attempt(async () => {
    const [existing] = await db.select().from(findJobsRequests).where(eq(findJobsRequests.candidateId, candidate.id)).limit(1);
    if (existing) await db.update(findJobsRequests).set({ ...d, status: "active" }).where(eq(findJobsRequests.id, existing.id));
    else await db.insert(findJobsRequests).values({ ...d, candidateId: candidate.id });
    // Run matching immediately so the candidate sees results right away.
    const { runFindJobsForMe } = await import("@/server/matching-service");
    await runFindJobsForMe(new Date(), (candidateId, jobId) => applyToJob({ candidateId, jobId, source: "find_jobs_for_me" }).catch(() => null));
  }, "“Find Jobs For Me” is active. We'll keep matching new jobs to your preferences.");
}

export async function setFindJobsStatusAction(status: "active" | "paused", _prev: ActionState): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  return attempt(async () => {
    await db.update(findJobsRequests).set({ status, updatedAt: new Date() }).where(eq(findJobsRequests.candidateId, candidate.id));
  });
}

export async function respondRecommendationAction(recommendationId: string, decision: "accept" | "decline", _prev: ActionState): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  let appId: string | null = null;
  const result = await attempt(async () => {
    const [rec] = await db
      .select()
      .from(recommendations)
      .where(and(eq(recommendations.id, recommendationId), eq(recommendations.candidateId, candidate.id)))
      .limit(1);
    if (!rec) throw new UserError("Recommendation not found.");
    if (rec.status !== "pending") throw new UserError("You've already responded to this recommendation.");
    if (decision === "decline") {
      await db.update(recommendations).set({ status: "declined", respondedAt: new Date() }).where(eq(recommendations.id, rec.id));
      return;
    }
    const app = await applyToJob({ candidateId: candidate.id, jobId: rec.jobId, source: rec.source === "company_invite" ? "company_invite" : "find_jobs_for_me" });
    await db.update(recommendations).set({ status: "applied", respondedAt: new Date() }).where(eq(recommendations.id, rec.id));
    appId = app.id;
  });
  if (appId) redirect(`/candidate/applications/${appId}?applied=1`);
  return result;
}

// ─── Resume builder ────────────────────────────────────────────────────────

const resumeSchema = z.object({
  title: requiredText("Resume name", 80),
  template: z.enum(["classic", "modern", "compact", "executive"]),
  targetRole: optionalText(120),
  headline: optionalText(160),
  summary: optionalText(2000),
  skills: optionalText(1000),
  targetJobId: optionalText(64),
});

function resumeSections(fd: FormData): ResumeSection[] {
  const chosen = new Set(fd.getAll("sections").map(String));
  const order = String(fd.get("sectionOrder") ?? "")
    .split(",")
    .filter((s): s is ResumeSection => (RESUME_SECTIONS as readonly string[]).includes(s));
  const base = order.length ? order : [...RESUME_SECTIONS];
  return base.filter((s) => chosen.has(s));
}

export async function createResumeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  const parsed = parseForm(resumeSchema, fd);
  if (parsed.error) return parsed.error;
  const existing = await db.select({ id: resumes.id }).from(resumes).where(eq(resumes.candidateId, candidate.id));
  const [row] = await db
    .insert(resumes)
    .values({
      candidateId: candidate.id,
      title: parsed.data.title,
      template: parsed.data.template,
      targetRole: parsed.data.targetRole,
      headline: parsed.data.headline ?? candidate.headline,
      summary: parsed.data.summary ?? candidate.summary,
      skills: parsed.data.skills ? parseList(parsed.data.skills) : candidate.skills,
      isDefault: existing.length === 0,
    })
    .returning();
  revalidateAll();
  redirect(`/candidate/resumes/${row!.id}`);
}

export async function updateResumeAction(resumeId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  const parsed = parseForm(resumeSchema, fd);
  if (parsed.error) return parsed.error;
  const sections = resumeSections(fd);
  if (!sections.length) return fail("Include at least one section.");
  return attempt(async () => {
    let targetJobId = parsed.data.targetJobId;
    if (targetJobId) {
      const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, targetJobId)).limit(1);
      if (!job) targetJobId = null;
    }
    await db
      .update(resumes)
      .set({
        title: parsed.data.title,
        template: parsed.data.template,
        targetRole: parsed.data.targetRole,
        headline: parsed.data.headline,
        summary: parsed.data.summary,
        skills: parseList(parsed.data.skills),
        sections,
        targetJobId,
        updatedAt: new Date(),
      })
      .where(and(eq(resumes.id, resumeId), eq(resumes.candidateId, candidate.id)));
  }, "Resume saved.");
}

export async function setDefaultResumeAction(resumeId: string, _prev: ActionState): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  return attempt(async () => {
    await db.update(resumes).set({ isDefault: false }).where(eq(resumes.candidateId, candidate.id));
    await db.update(resumes).set({ isDefault: true }).where(and(eq(resumes.id, resumeId), eq(resumes.candidateId, candidate.id)));
  });
}

export async function duplicateResumeAction(resumeId: string, _prev: ActionState): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  const [src] = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, resumeId), eq(resumes.candidateId, candidate.id)))
    .limit(1);
  if (!src) return fail("Resume not found.");
  const [copy] = await db
    .insert(resumes)
    .values({ ...src, id: undefined, title: `${src.title} (copy)`, isDefault: false, createdAt: new Date(), updatedAt: new Date() })
    .returning();
  revalidateAll();
  redirect(`/candidate/resumes/${copy!.id}`);
}

export async function deleteResumeAction(resumeId: string, _prev: ActionState): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  await db.delete(resumes).where(and(eq(resumes.id, resumeId), eq(resumes.candidateId, candidate.id)));
  const remaining = await db.select().from(resumes).where(eq(resumes.candidateId, candidate.id));
  if (remaining.length && !remaining.some((r) => r.isDefault)) await db.update(resumes).set({ isDefault: true }).where(eq(resumes.id, remaining[0]!.id));
  revalidateAll();
  redirect("/candidate/resumes");
}

// ─── Assessments ───────────────────────────────────────────────────────────

export async function startAttemptAction(assessmentId: string, _prev: ActionState): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  let attemptId: string | null = null;
  const result = await attempt(async () => {
    const a = await startAttempt(assessmentId, candidate);
    attemptId = a.id;
  });
  if (attemptId) redirect(`/candidate/assessments/${attemptId}`);
  return result;
}

export async function submitAttemptAction(attemptId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  const answers: Record<string, number> = {};
  for (const [key, value] of fd.entries()) {
    if (key.startsWith("q_") && typeof value === "string" && /^\d+$/.test(value)) answers[key.slice(2)] = Number(value);
  }
  const result = await attempt(async () => {
    await submitAttempt(attemptId, candidate, answers);
  });
  if (result?.ok) redirect(`/candidate/assessments/${attemptId}`);
  return result;
}

// ─── Messaging ─────────────────────────────────────────────────────────────

export async function candidateSendMessageAction(conversationId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, candidate } = await requireCandidate();
  const body = str(fd, "body");
  if (!body) return fail("Write a message first.");
  return attempt(async () => {
    const [conv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.candidateId, candidate.id)))
      .limit(1);
    if (!conv) throw new UserError("Conversation not found.");
    const { guard } = await postMessage({ conversationId, senderRole: "candidate", senderUserId: user.id, body });
    if (guard.flagged) return ok("Sent — but contact details were removed. For your safety, keep communication on the platform until you receive an offer.");
    return ok();
  });
}

export async function messageCompanyAboutApplicationAction(applicationId: string, _prev: ActionState): Promise<ActionState> {
  const { candidate } = await requireCandidate();
  const [row] = await db
    .select({ app: applications, jobTitle: jobs.title })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(and(eq(applications.id, applicationId), eq(applications.candidateId, candidate.id)))
    .limit(1);
  if (!row) return fail("Application not found.");
  const conv = await getOrCreateConversation({ companyId: row.app.companyId, candidateId: candidate.id, jobId: row.app.jobId, applicationId: row.app.id, subject: row.jobTitle });
  redirect(`/candidate/messages/${conv.id}`);
}
