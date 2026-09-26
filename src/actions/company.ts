"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  applications,
  candidates,
  companies,
  companyInvites,
  companyMembers,
  conversations,
  documents,
  interviewFeedback,
  interviews,
  jobs,
  serviceRequests,
  users,
  type Job,
  type MandatoryRequirements,
} from "@/db/schema";
import { subscriptionCharge, subscriptionPeriodEnd } from "@/lib/billing";
import { companyVerificationChecklist, isReadyForVerification } from "@/lib/company-verification";
import { COMPANY_DOC_TYPES, COMPANY_ROLES, COMPANY_SIZES, EDUCATION_LEVELS, EMPLOYMENT_TYPES, INDUSTRIES, INTERVIEW_MODES, RECOMMENDATIONS, WORK_MODES, type CompanyRole } from "@/lib/constants";
import { UserError } from "@/lib/errors";
import { formatWhen, parseList } from "@/lib/format";
import { checkbox, email, fail, ok, optionalNumber, optionalText, optionalUrl, parseForm, requiredNumber, requiredText, str, type ActionState } from "@/lib/forms";
import { makeMaskedAddress } from "@/lib/masked-address";
import { matchCandidateToJob } from "@/lib/matching";
import { getPlan, getService, PLANS } from "@/lib/plans";
import { attempt, revalidateAll } from "@/server/action-utils";
import { changeStage } from "@/server/applications";
import { audit } from "@/server/audit";
import { assertCan, getCurrentUser, requireCompany, type CompanyContext } from "@/server/auth";
import { summarizeInterviewFeedback } from "@/server/interview-assistant";
import { createInvoice } from "@/server/invoices";
import { createRecommendation, notifyMatchesForNewJob } from "@/server/matching-service";
import { canCompanyContact, getOrCreateConversation, postMessage } from "@/server/messaging";
import { appUrl, notify, notifyAdmins, sendEmail } from "@/server/notify";
import { recordDeparture, requestReplacement } from "@/server/placements";
import { educationsByCandidate, toMatchCandidate } from "@/server/queries";
import { deleteUpload, saveUpload } from "@/server/storage";

const values = <T extends readonly { value: string }[]>(opts: T) => opts.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]];
const optionalEnum = <T extends readonly { value: string }[]>(opts: T) => z.union([z.enum(values(opts)), z.literal("")]).transform((v) => v || null);

async function uniqueCompanyAddress(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const addr = makeMaskedAddress("hr");
    const [clash] = await db.select({ id: companies.id }).from(companies).where(eq(companies.maskedEmail, addr)).limit(1);
    if (!clash) return addr;
  }
  throw new Error("Could not allocate a relay address");
}

// ─── Onboarding & profile ──────────────────────────────────────────────────

const onboardingSchema = z.object({
  name: requiredText("Company name", 160),
  businessEmail: email(),
  industry: z.enum(values(INDUSTRIES)),
  size: z.enum(values(COMPANY_SIZES)),
  city: requiredText("City", 80),
  website: optionalUrl(),
});

export async function createCompanyAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "company") redirect("/login");
  const [existing] = await db.select().from(companyMembers).where(eq(companyMembers.userId, user.id)).limit(1);
  if (existing) redirect("/company");
  const parsed = parseForm(onboardingSchema, fd);
  if (parsed.error) return parsed.error;
  const [company] = await db
    .insert(companies)
    .values({ ...parsed.data, ownerUserId: user.id, contactName: user.name, contactEmail: user.email, maskedEmail: await uniqueCompanyAddress() })
    .returning();
  await db.insert(companyMembers).values({ companyId: company!.id, userId: user.id, role: "hr_admin" });
  await notify(user.id, {
    type: "welcome",
    title: "Company workspace created",
    body: "Complete your company profile and submit verification documents to become a VERIFIED COMPANY ✓.",
    link: "/company/profile",
  });
  revalidateAll();
  redirect("/company/profile?welcome=1");
}

const profileSchema = z.object({
  name: requiredText("Company name", 160),
  legalName: optionalText(200),
  registrationNumber: optionalText(40),
  gstNumber: optionalText(20),
  pan: optionalText(12),
  addressLine: optionalText(300),
  city: optionalText(80),
  state: optionalText(80),
  pincode: optionalText(10),
  website: optionalUrl(),
  businessEmail: email(),
  contactName: optionalText(120),
  contactDesignation: optionalText(120),
  contactPhone: optionalText(20),
  contactEmail: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")).optional()).transform((v) => v ?? null),
  industry: optionalEnum(INDUSTRIES),
  size: optionalEnum(COMPANY_SIZES),
  hiringRequirements: optionalText(2000),
  description: optionalText(2000),
  billingName: optionalText(200),
  billingAddress: optionalText(400),
  billingEmail: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")).optional()).transform((v) => v ?? null),
  billingGstNumber: optionalText(20),
});

export async function updateCompanyProfileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCompany("company.edit");
  const parsed = parseForm(profileSchema, fd);
  if (parsed.error) return parsed.error;
  const d = parsed.data;
  const errors: Record<string, string> = {};
  if (d.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(d.pan)) errors.pan = "PAN should look like AABCX1234F";
  if (d.gstNumber && !/^[0-9]{2}[A-Z0-9]{13}$/i.test(d.gstNumber)) errors.gstNumber = "GSTIN should be 15 characters, e.g. 29AABCX1234F1Z5";
  if (d.pincode && !/^\d{6}$/.test(d.pincode)) errors.pincode = "Enter a 6-digit PIN code";
  if (Object.keys(errors).length) return fail("Please fix the highlighted fields.", errors);
  return attempt(async () => {
    // Material changes to a verified company's identity send it back for review.
    const identityChanged =
      ctx.company.verificationStatus === "verified" &&
      (d.name !== ctx.company.name || (d.pan ?? null) !== ctx.company.pan || (d.registrationNumber ?? null) !== ctx.company.registrationNumber || (d.gstNumber ?? null) !== ctx.company.gstNumber);
    await db
      .update(companies)
      .set({
        ...d,
        pan: d.pan?.toUpperCase() ?? null,
        gstNumber: d.gstNumber?.toUpperCase() ?? null,
        gstApplicable: checkbox(fd, "gstApplicable"),
        verificationStatus: identityChanged ? "pending" : ctx.company.verificationStatus,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, ctx.company.id));
    if (identityChanged) {
      await notifyAdmins({ type: "company_verification", title: `${d.name} changed verified details`, body: "Re-verification required.", link: `/admin/verification/companies/${ctx.company.id}` });
      return ok("Saved. Because you changed registration details, your company will be re-verified.");
    }
  }, "Company profile saved.");
}

export async function uploadCompanyDocumentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCompany("company.edit");
  const docType = str(fd, "docType");
  if (!docType || !COMPANY_DOC_TYPES.some((d) => d.value === docType)) return fail("Choose a document type.", { docType: "Choose a document type" });
  return attempt(async () => {
    const file = await saveUpload(fd.get("file") as File, "documents");
    await db.insert(documents).values({ ownerType: "company", ownerId: ctx.company.id, docType, ...file });
  }, "Document uploaded.");
}

export async function deleteCompanyDocumentAction(id: string, _prev: ActionState): Promise<ActionState> {
  const ctx = await requireCompany("company.edit");
  return attempt(async () => {
    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.ownerType, "company"), eq(documents.ownerId, ctx.company.id)))
      .limit(1);
    if (!doc) throw new UserError("Document not found.");
    if (doc.status === "approved") throw new UserError("Approved documents can't be deleted.");
    await db.delete(documents).where(eq(documents.id, doc.id));
    await deleteUpload(doc.storageKey);
  });
}

export async function submitVerificationAction(_prev: ActionState): Promise<ActionState> {
  const ctx = await requireCompany("company.edit");
  const docs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.ownerType, "company"), eq(documents.ownerId, ctx.company.id)));
  const checks = companyVerificationChecklist(ctx.company, docs);
  if (!isReadyForVerification(checks)) {
    return fail(`Complete these items first: ${checks.filter((c) => !c.done).map((c) => c.label).join("; ")}.`);
  }
  return attempt(async () => {
    await db.update(companies).set({ verificationStatus: "pending", verificationSubmittedAt: new Date(), updatedAt: new Date() }).where(eq(companies.id, ctx.company.id));
    await notifyAdmins({ type: "company_verification", title: `Verification request: ${ctx.company.name}`, link: `/admin/verification/companies/${ctx.company.id}` });
  }, "Submitted for verification. We usually review within 1 business day.");
}

// ─── Jobs ──────────────────────────────────────────────────────────────────

const jobSchema = z.object({
  title: requiredText("Job title", 160),
  department: optionalText(120),
  industry: z.enum(values(INDUSTRIES)),
  location: requiredText("Location", 120),
  workMode: z.enum(values(WORK_MODES)),
  employmentType: z.enum(values(EMPLOYMENT_TYPES)),
  minExperience: requiredNumber("Minimum experience", 0, 50),
  maxExperience: optionalNumber(0, 60),
  educationLevel: z.enum(values(EDUCATION_LEVELS)),
  requiredSkills: requiredText("Required skills", 1000),
  preferredSkills: optionalText(1000),
  description: requiredText("Job description", 8000),
  responsibilities: optionalText(5000),
  minCtc: optionalNumber(0, 500),
  maxCtc: optionalNumber(0, 500),
  incentives: optionalText(500),
  benefits: optionalText(1000),
  vacancies: requiredNumber("Vacancies", 1, 1000),
  joiningWithinDays: optionalNumber(0, 365),
  maxNoticePeriodDays: optionalNumber(0, 365),
  interviewProcess: optionalText(2000),
  interviewRequirements: optionalText(1000),
  minCurrentCtc: optionalNumber(0, 500),
});

function jobValues(d: z.infer<typeof jobSchema>, fd: FormData) {
  const mandatory: MandatoryRequirements = {
    experience: checkbox(fd, "mandatoryExperience"),
    noticePeriod: checkbox(fd, "mandatoryNoticePeriod"),
    education: checkbox(fd, "mandatoryEducation"),
    minCurrentCtc: d.minCurrentCtc,
    requireLevel1: checkbox(fd, "requireLevel1"),
    requireLevel2: checkbox(fd, "requireLevel2"),
    requireIdentityVerified: checkbox(fd, "requireIdentityVerified"),
  };
  return {
    title: d.title,
    department: d.department,
    industry: d.industry,
    location: d.location,
    workMode: d.workMode,
    employmentType: d.employmentType,
    minExperience: d.minExperience,
    maxExperience: d.maxExperience,
    educationLevel: d.educationLevel,
    requiredSkills: parseList(d.requiredSkills),
    preferredSkills: parseList(d.preferredSkills),
    description: d.description,
    responsibilities: d.responsibilities,
    minCtc: d.minCtc,
    maxCtc: d.maxCtc,
    incentives: d.incentives,
    benefits: d.benefits,
    vacancies: d.vacancies,
    joiningWithinDays: d.joiningWithinDays,
    maxNoticePeriodDays: d.maxNoticePeriodDays,
    interviewProcess: d.interviewProcess,
    interviewRequirements: d.interviewRequirements,
    mandatory,
  };
}

function validateJob(d: z.infer<typeof jobSchema>, fd: FormData): ActionState | null {
  const errors: Record<string, string> = {};
  if (d.maxExperience != null && d.maxExperience < d.minExperience) errors.maxExperience = "Must be at least the minimum";
  if (d.minCtc != null && d.maxCtc != null && d.maxCtc < d.minCtc) errors.maxCtc = "Must be at least the minimum";
  if (checkbox(fd, "mandatoryNoticePeriod") && d.maxNoticePeriodDays == null) errors.maxNoticePeriodDays = "Set a maximum notice period to make it mandatory";
  if (checkbox(fd, "mandatoryEducation") && d.educationLevel === "any") errors.educationLevel = "Choose an education level to make it mandatory";
  return Object.keys(errors).length ? fail("Please fix the highlighted fields.", errors) : null;
}

async function publish(ctx: CompanyContext, job: Job): Promise<string> {
  const plan = getPlan(ctx.company.planCode);
  if (plan.activeJobLimit != null) {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(jobs)
      .where(and(eq(jobs.companyId, ctx.company.id), eq(jobs.status, "active")));
    if (Number(row?.n ?? 0) >= plan.activeJobLimit) {
      throw new UserError(`Your ${plan.name} plan allows ${plan.activeJobLimit} active jobs. Close a job or upgrade your plan.`);
    }
  }
  const now = new Date();
  if (ctx.company.verificationStatus === "verified") {
    await db.update(jobs).set({ status: "active", publishedAt: job.publishedAt ?? now, updatedAt: now }).where(eq(jobs.id, job.id));
    await notifyMatchesForNewJob({ ...job, status: "active" });
    return "Job published and matched candidates notified.";
  }
  await db.update(jobs).set({ status: "pending_approval", updatedAt: now }).where(eq(jobs.id, job.id));
  await notifyAdmins({ type: "job_moderation", title: `Job awaiting approval: ${job.title}`, body: `${ctx.company.name} (unverified)`, link: "/admin/jobs" });
  return "Submitted for approval. Jobs from unverified companies are reviewed by our team before going live.";
}

export async function createJobAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCompany("jobs.manage");
  const parsed = parseForm(jobSchema, fd);
  if (parsed.error) return parsed.error;
  const invalid = validateJob(parsed.data, fd);
  if (invalid) return invalid;
  const [job] = await db
    .insert(jobs)
    .values({ ...jobValues(parsed.data, fd), companyId: ctx.company.id, postedByUserId: ctx.user.id, status: "draft" })
    .returning();
  let notice = "Job saved as a draft.";
  if (str(fd, "intent") === "publish") {
    const result = await attempt(async () => ok(await publish(ctx, job!)));
    notice = result?.ok ? (result.message ?? "Job published.") : `Saved as a draft — ${result?.error ?? "could not publish"}`;
  }
  revalidateAll();
  redirect(`/company/jobs/${job!.id}?notice=${encodeURIComponent(notice)}`);
}

async function ownJob(ctx: CompanyContext, jobId: string): Promise<Job> {
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.companyId, ctx.company.id)))
    .limit(1);
  if (!job) throw new UserError("Job not found.");
  return job;
}

export async function updateJobAction(jobId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCompany("jobs.manage");
  const parsed = parseForm(jobSchema, fd);
  if (parsed.error) return parsed.error;
  const invalid = validateJob(parsed.data, fd);
  if (invalid) return invalid;
  let saved = false;
  const result = await attempt(async () => {
    const job = await ownJob(ctx, jobId);
    if (job.status === "suspended") throw new UserError("This job was suspended by moderation and can't be edited.");
    await db
      .update(jobs)
      .set({ ...jobValues(parsed.data, fd), updatedAt: new Date() })
      .where(eq(jobs.id, job.id));
    saved = true;
  });
  if (saved) redirect(`/company/jobs/${jobId}?notice=${encodeURIComponent("Job updated.")}`);
  return result;
}

export async function setJobStatusAction(jobId: string, action: "publish" | "pause" | "close" | "resume", _prev: ActionState): Promise<ActionState> {
  const ctx = await requireCompany("jobs.manage");
  return attempt(async () => {
    const job = await ownJob(ctx, jobId);
    const now = new Date();
    if (action === "publish" || action === "resume") {
      if (!["draft", "paused", "rejected", "closed"].includes(job.status)) throw new UserError("This job can't be published from its current status.");
      return ok(await publish(ctx, job));
    }
    if (action === "pause") {
      if (job.status !== "active") throw new UserError("Only active jobs can be paused.");
      await db.update(jobs).set({ status: "paused", updatedAt: now }).where(eq(jobs.id, job.id));
      return ok("Job paused — it's hidden from search until you resume it.");
    }
    await db.update(jobs).set({ status: "closed", closedAt: now, updatedAt: now }).where(eq(jobs.id, job.id));
    return ok("Job closed.");
  });
}

// ─── Pipeline ──────────────────────────────────────────────────────────────

export async function moveStageAction(applicationId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCompany("pipeline.manage");
  const to = str(fd, "to");
  if (!to) return fail("Choose a stage.");
  const offeredCtc = str(fd, "offeredCtc");
  const date = (key: string) => {
    const v = str(fd, key);
    return v ? new Date(`${v}T09:00:00+05:30`) : null;
  };
  if (offeredCtc && !(Number(offeredCtc) > 0)) return fail("Enter a valid offered CTC.", { offeredCtc: "Enter a number in LPA" });
  return attempt(async () => {
    await changeStage({
      applicationId,
      to,
      actor: "company",
      actorUserId: ctx.user.id,
      companyId: ctx.company.id,
      note: str(fd, "note"),
      rejectionReason: str(fd, "rejectionReason"),
      extras: { offeredCtc: offeredCtc ? Number(offeredCtc) : null, expectedJoiningDate: date("expectedJoiningDate"), joiningDate: date("joiningDate") },
    });
  }, "Stage updated and candidate notified.");
}

// ─── Interviews ────────────────────────────────────────────────────────────

const interviewSchema = z.object({
  stage: requiredText("Round", 40),
  title: requiredText("Title", 160),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time"),
  durationMinutes: requiredNumber("Duration", 10, 480),
  mode: z.enum(values(INTERVIEW_MODES)),
  meetingUrl: optionalUrl(),
  location: optionalText(300),
  interviewerUserId: optionalText(64),
  notes: optionalText(2000),
});

async function ownApplication(ctx: CompanyContext, applicationId: string) {
  const [row] = await db
    .select({ app: applications, job: jobs, candidate: candidates })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(candidates, eq(candidates.id, applications.candidateId))
    .where(and(eq(applications.id, applicationId), eq(applications.companyId, ctx.company.id)))
    .limit(1);
  if (!row) throw new UserError("Application not found.");
  return row;
}

function istDate(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+05:30`);
}

export async function scheduleInterviewAction(applicationId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCompany("interviews.schedule");
  const parsed = parseForm(interviewSchema, fd);
  if (parsed.error) return parsed.error;
  const d = parsed.data;
  const scheduledAt = istDate(d.date, d.time);
  if (scheduledAt.getTime() < Date.now() - 60_000) return fail("Please fix the highlighted fields.", { date: "Choose a future date and time" });
  if (d.mode === "onsite" && !d.location) return fail("Please fix the highlighted fields.", { location: "Add the interview address" });
  return attempt(async () => {
    const { app, job, candidate } = await ownApplication(ctx, applicationId);
    if (["rejected", "withdrawn", "joined"].includes(app.stage)) throw new UserError("This application is closed.");
    let interviewerUserId = d.interviewerUserId;
    if (interviewerUserId) {
      const [m] = await db.select().from(companyMembers).where(and(eq(companyMembers.userId, interviewerUserId), eq(companyMembers.companyId, ctx.company.id))).limit(1);
      if (!m) interviewerUserId = null;
    }
    const [iv] = await db
      .insert(interviews)
      .values({
        applicationId: app.id,
        stage: d.stage,
        title: d.title,
        scheduledAt,
        durationMinutes: d.durationMinutes,
        mode: d.mode,
        meetingUrl: d.mode === "video" ? (d.meetingUrl ?? `https://meet.jit.si/hrms-${crypto.randomUUID().slice(0, 12)}`) : d.meetingUrl,
        location: d.location,
        interviewerUserId,
        notes: d.notes,
        createdByUserId: ctx.user.id,
      })
      .returning();
    // Move the application into the interview round if it is earlier in the pipeline.
    const order = ["applied", "screening", "shortlisted", "assessment", "interview_1", "interview_2", "hr_interview"];
    if (order.indexOf(d.stage) > order.indexOf(app.stage)) {
      await changeStage({ applicationId: app.id, to: d.stage, actor: "company", actorUserId: ctx.user.id, companyId: ctx.company.id, note: `Interview scheduled: ${d.title}` });
    }
    const when = formatWhen(scheduledAt);
    await notify(candidate.userId, {
      type: "interview_scheduled",
      title: `Your interview has been scheduled for ${when}.`,
      body: `${d.title} for ${job.title} at ${ctx.company.name}.`,
      link: `/candidate/applications/${app.id}`,
    });
    if (interviewerUserId && interviewerUserId !== ctx.user.id) {
      await notify(interviewerUserId, { type: "interview_assigned", title: `You're interviewing ${candidate.fullName} ${when}`, body: `${d.title} — ${job.title}`, link: `/company/applications/${app.id}` });
    }
    void iv;
  }, "Interview scheduled — the candidate has been notified.");
}

export async function rescheduleInterviewAction(interviewId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCompany("interviews.schedule");
  const date = str(fd, "date");
  const time = str(fd, "time");
  if (!date || !time) return fail("Choose a new date and time.");
  const scheduledAt = istDate(date, time);
  if (scheduledAt.getTime() < Date.now()) return fail("Choose a future date and time.");
  return attempt(async () => {
    const [row] = await db
      .select({ interview: interviews, app: applications, candidateUserId: candidates.userId, jobTitle: jobs.title })
      .from(interviews)
      .innerJoin(applications, eq(applications.id, interviews.applicationId))
      .innerJoin(candidates, eq(candidates.id, applications.candidateId))
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .where(and(eq(interviews.id, interviewId), eq(applications.companyId, ctx.company.id)))
      .limit(1);
    if (!row) throw new UserError("Interview not found.");
    if (row.interview.status !== "scheduled") throw new UserError("Only scheduled interviews can be rescheduled.");
    await db
      .update(interviews)
      .set({ scheduledAt, rescheduleCount: row.interview.rescheduleCount + 1, reminderSentAt: null, updatedAt: new Date() })
      .where(eq(interviews.id, interviewId));
    await notify(row.candidateUserId, {
      type: "interview_rescheduled",
      title: `Interview rescheduled to ${formatWhen(scheduledAt)}`,
      body: `${row.interview.title} for ${row.jobTitle}${str(fd, "reason") ? ` — ${str(fd, "reason")}` : ""}.`,
      link: `/candidate/applications/${row.app.id}`,
    });
  }, "Interview rescheduled — the candidate has been notified.");
}

export async function setInterviewStatusAction(interviewId: string, status: "completed" | "cancelled" | "no_show", _prev: ActionState): Promise<ActionState> {
  const ctx = await requireCompany();
  if (status === "cancelled") assertCan(ctx, "interviews.schedule");
  return attempt(async () => {
    const [row] = await db
      .select({ interview: interviews, app: applications, candidateUserId: candidates.userId })
      .from(interviews)
      .innerJoin(applications, eq(applications.id, interviews.applicationId))
      .innerJoin(candidates, eq(candidates.id, applications.candidateId))
      .where(and(eq(interviews.id, interviewId), eq(applications.companyId, ctx.company.id)))
      .limit(1);
    if (!row) throw new UserError("Interview not found.");
    if (ctx.member.role === "interviewer" && row.interview.interviewerUserId !== ctx.user.id) throw new UserError("You can only update interviews assigned to you.");
    await db.update(interviews).set({ status, updatedAt: new Date() }).where(eq(interviews.id, interviewId));
    if (status === "cancelled") {
      await notify(row.candidateUserId, { type: "interview_cancelled", title: "Interview cancelled", body: `${row.interview.title} was cancelled. The company may reschedule.`, link: `/candidate/applications/${row.app.id}` });
    }
  });
}

const feedbackSchema = z.object({
  technical: requiredNumber("Technical", 1, 5),
  communication: requiredNumber("Communication", 1, 5),
  roleFit: requiredNumber("Role fit", 1, 5),
  experience: requiredNumber("Experience", 1, 5),
  recommendation: z.enum(values(RECOMMENDATIONS)),
  strengths: optionalText(2000),
  concerns: optionalText(2000),
  salaryNotes: optionalText(500),
  availabilityNotes: optionalText(500),
});

export async function submitFeedbackAction(interviewId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCompany("interviews.feedback");
  const parsed = parseForm(feedbackSchema, fd);
  if (parsed.error) return parsed.error;
  return attempt(async () => {
    const [row] = await db
      .select({ interview: interviews, app: applications })
      .from(interviews)
      .innerJoin(applications, eq(applications.id, interviews.applicationId))
      .where(and(eq(interviews.id, interviewId), eq(applications.companyId, ctx.company.id)))
      .limit(1);
    if (!row) throw new UserError("Interview not found.");
    if (ctx.member.role === "interviewer" && row.interview.interviewerUserId !== ctx.user.id) throw new UserError("You can only give feedback on interviews assigned to you.");
    const [existing] = await db
      .select({ id: interviewFeedback.id })
      .from(interviewFeedback)
      .where(and(eq(interviewFeedback.interviewId, interviewId), eq(interviewFeedback.authorUserId, ctx.user.id)))
      .limit(1);
    if (existing) await db.update(interviewFeedback).set(parsed.data).where(eq(interviewFeedback.id, existing.id));
    else await db.insert(interviewFeedback).values({ ...parsed.data, interviewId, authorUserId: ctx.user.id });
    if (row.interview.status === "scheduled" && row.interview.scheduledAt < new Date()) {
      await db.update(interviews).set({ status: "completed", updatedAt: new Date() }).where(eq(interviews.id, interviewId));
    }
  }, "Feedback saved.");
}

/** Interview AI Assistant: summarise all structured feedback for an application. */
export async function generateSummaryAction(applicationId: string, _prev: ActionState): Promise<ActionState> {
  const ctx = await requireCompany("interviews.feedback");
  return attempt(async () => {
    const { app, job, candidate } = await ownApplication(ctx, applicationId);
    const rows = await db
      .select({ fb: interviewFeedback, interview: interviews, author: users.name })
      .from(interviewFeedback)
      .innerJoin(interviews, eq(interviews.id, interviewFeedback.interviewId))
      .innerJoin(users, eq(users.id, interviewFeedback.authorUserId))
      .where(eq(interviews.applicationId, app.id))
      .orderBy(desc(interviewFeedback.createdAt));
    if (!rows.length) throw new UserError("Add interview feedback first.");
    const { summary, source } = await summarizeInterviewFeedback(
      rows.map((r) => ({
        interviewTitle: r.interview.title,
        interviewer: r.author,
        technical: r.fb.technical,
        communication: r.fb.communication,
        roleFit: r.fb.roleFit,
        experience: r.fb.experience,
        recommendation: r.fb.recommendation,
        strengths: r.fb.strengths,
        concerns: r.fb.concerns,
        salaryNotes: r.fb.salaryNotes,
        availabilityNotes: r.fb.availabilityNotes,
      })),
      { candidateName: candidate.fullName, jobTitle: job.title },
    );
    await db.update(interviewFeedback).set({ aiSummary: summary, aiSummarySource: source }).where(eq(interviewFeedback.id, rows[0]!.fb.id));
  }, "Summary generated.");
}

// ─── Candidates & messaging ────────────────────────────────────────────────

export async function inviteCandidateAction(candidateId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCompany("candidates.search");
  const jobId = str(fd, "jobId");
  if (!jobId) return fail("Choose a job.", { jobId: "Choose a job" });
  if (ctx.company.verificationStatus !== "verified") return fail("Only verified companies can invite candidates.");
  return attempt(async () => {
    const job = await ownJob(ctx, jobId);
    if (job.status !== "active") throw new UserError("The job must be active to invite candidates.");
    const [candidate] = await db.select().from(candidates).where(eq(candidates.id, candidateId)).limit(1);
    if (!candidate || !candidate.allowRecommendations || candidate.profileVisibility === "hidden") throw new UserError("This candidate isn't accepting invitations.");
    const eds = (await educationsByCandidate([candidate.id])).get(candidate.id) ?? [];
    const match = matchCandidateToJob(toMatchCandidate(candidate, eds), job);
    const { created } = await createRecommendation({ candidateId, jobId, source: "company_invite", score: match.score, reasons: match.reasons, message: str(fd, "message"), createdByUserId: ctx.user.id });
    if (!created) throw new UserError("You've already invited this candidate to this job.");
    await notify(candidate.userId, { type: "company_invite", title: `${ctx.company.name} invited you to apply`, body: `${job.title} — ${match.score}% match.`, link: "/candidate/find-jobs" });
  }, "Invitation sent. The candidate decides whether to apply.");
}

export async function startConversationAction(candidateId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCompany("messages.send");
  const [candidate] = await db.select().from(candidates).where(eq(candidates.id, candidateId)).limit(1);
  if (!candidate) return fail("Candidate not found.");
  const allowed = await canCompanyContact(ctx.company, candidate);
  if (!allowed.ok) return fail(allowed.reason);
  const jobId = str(fd, "jobId");
  let subject = "Opportunity at " + ctx.company.name;
  let applicationId: string | null = null;
  if (jobId) {
    const [job] = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.companyId, ctx.company.id))).limit(1);
    if (job) subject = job.title;
    const [app] = await db.select({ id: applications.id }).from(applications).where(and(eq(applications.jobId, jobId), eq(applications.candidateId, candidateId))).limit(1);
    applicationId = app?.id ?? null;
  }
  const conv = await getOrCreateConversation({ companyId: ctx.company.id, candidateId, jobId: jobId ?? null, applicationId, subject });
  redirect(`/company/messages/${conv.id}`);
}

export async function companySendMessageAction(conversationId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCompany("messages.send");
  const body = str(fd, "body");
  if (!body) return fail("Write a message first.");
  return attempt(async () => {
    const [conv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.companyId, ctx.company.id)))
      .limit(1);
    if (!conv) throw new UserError("Conversation not found.");
    const { guard } = await postMessage({ conversationId, senderRole: "company", senderUserId: ctx.user.id, body });
    if (guard.flagged) return ok("Sent — contact details were removed. Please keep candidate communication on the platform.");
  });
}

// ─── Recruiter workspace ───────────────────────────────────────────────────

export async function inviteMemberAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCompany("team.manage");
  const parsed = parseForm(z.object({ email: email(), role: z.enum(values(COMPANY_ROLES)) }), fd);
  if (parsed.error) return parsed.error;
  const { email: mail, role } = parsed.data;
  const [existingUser] = await db.select().from(users).where(eq(users.email, mail)).limit(1);
  if (existingUser) {
    const [membership] = await db.select().from(companyMembers).where(eq(companyMembers.userId, existingUser.id)).limit(1);
    if (membership) return fail(membership.companyId === ctx.company.id ? "This person is already on your team." : "This email already belongs to another company workspace.");
    if (existingUser.role !== "company") return fail("This email is registered as a candidate account. Ask them to use a work email.");
  }
  const [pending] = await db
    .select()
    .from(companyInvites)
    .where(and(eq(companyInvites.companyId, ctx.company.id), eq(companyInvites.email, mail), eq(companyInvites.status, "pending")))
    .limit(1);
  if (pending) return fail("An invitation is already pending for this email.");
  return attempt(async () => {
    const token = randomBytes(24).toString("base64url");
    await db.insert(companyInvites).values({ companyId: ctx.company.id, email: mail, role, token, invitedByUserId: ctx.user.id });
    const link = appUrl(`/invite/${token}`);
    await sendEmail({ to: mail, subject: `${ctx.user.name} invited you to ${ctx.company.name} on HRMS Talent`, text: `You've been invited to join ${ctx.company.name}'s recruiter workspace as ${COMPANY_ROLES.find((r) => r.value === role)?.label}.\n\nAccept: ${link}` });
    return ok(`Invitation sent to ${mail}. Share this link if needed: ${link}`);
  });
}

export async function revokeInviteAction(inviteId: string, _prev: ActionState): Promise<ActionState> {
  const ctx = await requireCompany("team.manage");
  return attempt(async () => {
    await db.update(companyInvites).set({ status: "revoked" }).where(and(eq(companyInvites.id, inviteId), eq(companyInvites.companyId, ctx.company.id)));
  });
}

async function adminCount(companyId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(companyMembers)
    .where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.role, "hr_admin")));
  return Number(row?.n ?? 0);
}

export async function changeMemberRoleAction(memberId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCompany("team.manage");
  const role = str(fd, "role") as CompanyRole | null;
  if (!role || !COMPANY_ROLES.some((r) => r.value === role)) return fail("Choose a role.");
  return attempt(async () => {
    const [m] = await db.select().from(companyMembers).where(and(eq(companyMembers.id, memberId), eq(companyMembers.companyId, ctx.company.id))).limit(1);
    if (!m) throw new UserError("Team member not found.");
    if (m.role === "hr_admin" && role !== "hr_admin" && (await adminCount(ctx.company.id)) <= 1) throw new UserError("Your workspace needs at least one HR Admin.");
    await db.update(companyMembers).set({ role }).where(eq(companyMembers.id, m.id));
    await audit(ctx.user.id, "company.member_role", "company_member", m.id, { role });
  }, "Role updated.");
}

export async function removeMemberAction(memberId: string, _prev: ActionState): Promise<ActionState> {
  const ctx = await requireCompany("team.manage");
  return attempt(async () => {
    const [m] = await db.select().from(companyMembers).where(and(eq(companyMembers.id, memberId), eq(companyMembers.companyId, ctx.company.id))).limit(1);
    if (!m) throw new UserError("Team member not found.");
    if (m.userId === ctx.user.id) throw new UserError("You can't remove yourself.");
    if (m.role === "hr_admin" && (await adminCount(ctx.company.id)) <= 1) throw new UserError("Your workspace needs at least one HR Admin.");
    await db.delete(companyMembers).where(eq(companyMembers.id, m.id));
    await audit(ctx.user.id, "company.member_removed", "company_member", m.id);
  }, "Team member removed.");
}

// ─── Billing ───────────────────────────────────────────────────────────────

export async function changePlanAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCompany("billing.manage");
  const code = str(fd, "plan");
  const cycle = str(fd, "cycle") === "annual" ? "annual" : "monthly";
  const plan = PLANS.find((p) => p.code === code);
  if (!plan) return fail("Choose a plan.");
  if (plan.code === ctx.company.planCode && cycle === ctx.company.billingCycle) return fail("You're already on this plan.");
  return attempt(async () => {
    const now = new Date();
    let renewsAt: Date | null = null;
    if (plan.monthlyPrice > 0) {
      const end = subscriptionPeriodEnd(now, cycle);
      await createInvoice({ companyId: ctx.company.id, kind: "subscription", amount: subscriptionCharge(plan, cycle), description: `${plan.name} plan — ${cycle} subscription`, periodStart: now, periodEnd: end, now });
      renewsAt = end;
    }
    await db.update(companies).set({ planCode: plan.code, billingCycle: cycle, subscriptionRenewsAt: renewsAt, updatedAt: now }).where(eq(companies.id, ctx.company.id));
    await audit(ctx.user.id, "company.plan_changed", "company", ctx.company.id, { plan: plan.code, cycle });
  }, `You're now on the ${plan.name} plan. New placements use this plan's terms.`);
}

export async function requestServiceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCompany("billing.manage");
  const service = getService(str(fd, "service") ?? "");
  if (!service) return fail("Choose a service.");
  const quantity = Math.max(1, Math.min(100, Number(str(fd, "quantity") ?? 1) || 1));
  const jobId = str(fd, "jobId");
  if (service.needsJob && !jobId) return fail("Choose the job this service is for.", { jobId: "Choose a job" });
  return attempt(async () => {
    let jobTitle = "";
    if (jobId) jobTitle = (await ownJob(ctx, jobId)).title;
    const now = new Date();
    const autoFulfil = service.code === "priority_job" || service.code === "featured_employer";
    const [sr] = await db
      .insert(serviceRequests)
      .values({ companyId: ctx.company.id, serviceCode: service.code, jobId, quantity, notes: str(fd, "notes"), requestedByUserId: ctx.user.id, status: autoFulfil ? "fulfilled" : "requested" })
      .returning();
    const invoice = await createInvoice({ companyId: ctx.company.id, kind: "service", amount: service.price * quantity, description: `${service.name}${jobTitle ? ` — ${jobTitle}` : ""}${quantity > 1 ? ` × ${quantity}` : ""}`, serviceRequestId: sr!.id, now });
    await db.update(serviceRequests).set({ invoiceId: invoice.id }).where(eq(serviceRequests.id, sr!.id));
    const in30 = new Date(now.getTime() + 30 * 86_400_000);
    if (service.code === "priority_job" && jobId) await db.update(jobs).set({ priorityUntil: in30 }).where(eq(jobs.id, jobId));
    if (service.code === "featured_employer") await db.update(companies).set({ featuredUntil: in30 }).where(eq(companies.id, ctx.company.id));
    if (!autoFulfil) await notifyAdmins({ type: "service_request", title: `Service requested: ${service.name}`, body: ctx.company.name, link: "/admin/finance?tab=services" });
  }, `${service.name} requested — an invoice has been generated.`);
}

export async function recordDepartureAction(placementId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCompany("billing.manage");
  const date = str(fd, "leftAt");
  if (!date) return fail("Choose the last working day.", { leftAt: "Choose a date" });
  return attempt(async () => {
    const result = await recordDeparture(placementId, ctx.company.id, new Date(`${date}T18:00:00+05:30`), str(fd, "reason"));
    return ok(result.explanation);
  });
}

export async function requestReplacementAction(placementId: string, _prev: ActionState): Promise<ActionState> {
  const ctx = await requireCompany("billing.manage");
  return attempt(async () => {
    await requestReplacement(placementId, ctx.company.id);
  }, "Replacement requested — our recruitment team will be in touch.");
}
