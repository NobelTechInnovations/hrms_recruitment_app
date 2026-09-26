"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assessments, candidates, companies, conversations, jobReports, jobs, messages, questions, serviceRequests, users } from "@/db/schema";
import { ASSESSMENT_CATEGORIES, PAYMENT_METHODS } from "@/lib/constants";
import { UserError } from "@/lib/errors";
import { fail, ok, optionalText, parseForm, requiredNumber, requiredText, str, type ActionState } from "@/lib/forms";
import { matchCandidateToJob } from "@/lib/matching";
import { attempt } from "@/server/action-utils";
import { applyToJob } from "@/server/applications";
import { audit } from "@/server/audit";
import { requireAdmin } from "@/server/auth";
import { recordPayment, voidInvoice } from "@/server/invoices";
import { createRecommendation, notifyMatchesForNewJob } from "@/server/matching-service";
import { notify, notifyCompany } from "@/server/notify";
import { resolveReplacement } from "@/server/placements";
import { educationsByCandidate, toMatchCandidate } from "@/server/queries";
import { runScheduledJobs } from "@/server/scheduled";
import { reviewCompany, reviewDocument } from "@/server/verification";

const values = <T extends readonly { value: string }[]>(opts: T) => opts.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]];

// ─── Users ─────────────────────────────────────────────────────────────────

export async function setUserStatusAction(userId: string, status: "active" | "suspended", _prev: ActionState): Promise<ActionState> {
  const admin = await requireAdmin();
  if (userId === admin.id) return fail("You can't suspend your own account.");
  return attempt(async () => {
    await db.update(users).set({ status }).where(eq(users.id, userId));
    if (status === "suspended") {
      const { sessions } = await import("@/db/schema");
      await db.delete(sessions).where(eq(sessions.userId, userId));
    }
    await audit(admin.id, `user.${status}`, "user", userId);
  }, status === "suspended" ? "User suspended and signed out." : "User re-activated.");
}

// ─── Verification ──────────────────────────────────────────────────────────

export async function reviewCompanyAction(companyId: string, decision: "verified" | "rejected", _prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const note = str(fd, "note");
  if (decision === "rejected" && !note) return fail("Explain what needs fixing so the company can resubmit.", { note: "Required when rejecting" });
  return attempt(async () => {
    await reviewCompany(companyId, decision, note, admin.id);
  }, decision === "verified" ? "Company verified." : "Company notified of the rejection.");
}

export async function reviewDocumentAction(documentId: string, decision: "approved" | "rejected", _prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const note = str(fd, "note");
  if (decision === "rejected" && !note) return fail("Add a reason for the rejection.", { note: "Required when rejecting" });
  return attempt(async () => {
    await reviewDocument(documentId, decision, note, admin.id);
  });
}

// ─── Jobs ──────────────────────────────────────────────────────────────────

export async function moderateJobAction(jobId: string, decision: "approve" | "reject" | "suspend" | "reinstate", _prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const note = str(fd, "note");
  if ((decision === "reject" || decision === "suspend") && !note) return fail("Add a moderation note.", { note: "Required" });
  return attempt(async () => {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job) throw new UserError("Job not found.");
    const now = new Date();
    const status = { approve: "active", reject: "rejected", suspend: "suspended", reinstate: "active" }[decision] as typeof job.status;
    await db
      .update(jobs)
      .set({ status, moderationNote: note, publishedAt: status === "active" ? (job.publishedAt ?? now) : job.publishedAt, updatedAt: now })
      .where(eq(jobs.id, jobId));
    await audit(admin.id, `job.${decision}`, "job", jobId, { note });
    await notifyCompany(job.companyId, {
      type: "job_moderation",
      title: decision === "approve" ? `“${job.title}” is live` : decision === "reinstate" ? `“${job.title}” was reinstated` : `“${job.title}” was ${decision === "reject" ? "rejected" : "suspended"}`,
      body: note ?? undefined,
      link: `/company/jobs/${job.id}`,
    }, "jobs.view");
    if (decision === "approve") await notifyMatchesForNewJob({ ...job, status: "active" });
  });
}

export async function resolveReportAction(reportId: string, status: "resolved" | "dismissed", _prev: ActionState): Promise<ActionState> {
  const admin = await requireAdmin();
  return attempt(async () => {
    await db.update(jobReports).set({ status, resolvedAt: new Date() }).where(eq(jobReports.id, reportId));
    await audit(admin.id, `job_report.${status}`, "job_report", reportId);
  });
}

// ─── Assessments ───────────────────────────────────────────────────────────

const assessmentSchema = z.object({
  title: requiredText("Title", 160),
  description: optionalText(1000),
  level: z.enum(["1", "2"]).transform(Number),
  category: z.enum(values(ASSESSMENT_CATEGORIES)),
  durationMinutes: requiredNumber("Duration", 5, 180),
  passingPercent: requiredNumber("Passing score", 1, 100),
  questionsPerAttempt: requiredNumber("Questions per attempt", 1, 100),
  retakeCooldownDays: requiredNumber("Retake cooldown", 0, 365),
});

export async function saveAssessmentAction(assessmentId: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseForm(assessmentSchema, fd);
  if (parsed.error) return parsed.error;
  if (parsed.data.level === 1 && parsed.data.category !== "general") return fail("Level 1 assessments use the General category.", { category: "Use General for Level 1" });
  if (parsed.data.level === 2 && parsed.data.category === "general") return fail("Level 2 assessments need an industry.", { category: "Choose an industry" });
  return attempt(async () => {
    if (assessmentId) {
      await db.update(assessments).set(parsed.data).where(eq(assessments.id, assessmentId));
      await audit(admin.id, "assessment.updated", "assessment", assessmentId);
    } else {
      const [a] = await db.insert(assessments).values({ ...parsed.data, isActive: false }).returning();
      await audit(admin.id, "assessment.created", "assessment", a!.id);
      return ok("Assessment created (inactive). Add questions, then activate it.");
    }
  }, "Assessment saved.");
}

export async function toggleAssessmentAction(assessmentId: string, isActive: boolean, _prev: ActionState): Promise<ActionState> {
  await requireAdmin();
  return attempt(async () => {
    if (isActive) {
      const [q] = await db.select({ id: questions.id }).from(questions).where(and(eq(questions.assessmentId, assessmentId), eq(questions.isActive, true))).limit(1);
      if (!q) throw new UserError("Add at least one active question first.");
    }
    await db.update(assessments).set({ isActive }).where(eq(assessments.id, assessmentId));
  });
}

export async function addQuestionAction(assessmentId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(
    z.object({
      topic: requiredText("Topic", 80),
      text: requiredText("Question", 1000),
      option0: requiredText("Option A", 300),
      option1: requiredText("Option B", 300),
      option2: optionalText(300),
      option3: optionalText(300),
      correctIndex: z.enum(["0", "1", "2", "3"]).transform(Number),
      explanation: optionalText(1000),
    }),
    fd,
  );
  if (parsed.error) return parsed.error;
  const d = parsed.data;
  const options = [d.option0, d.option1, d.option2, d.option3].filter((o): o is string => !!o);
  if (d.correctIndex >= options.length) return fail("The correct answer must be one of the filled options.", { correctIndex: "Pick a filled option" });
  return attempt(async () => {
    await db.insert(questions).values({ assessmentId, topic: d.topic, text: d.text, options, correctIndex: d.correctIndex, explanation: d.explanation });
  }, "Question added to the bank.");
}

export async function toggleQuestionAction(questionId: string, isActive: boolean, _prev: ActionState): Promise<ActionState> {
  await requireAdmin();
  return attempt(async () => {
    await db.update(questions).set({ isActive }).where(eq(questions.id, questionId));
  });
}

// ─── Finance ───────────────────────────────────────────────────────────────

export async function recordPaymentAction(invoiceId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseForm(z.object({ amount: requiredNumber("Amount", 1, 100_000_000), method: z.enum(values(PAYMENT_METHODS)), reference: optionalText(120) }), fd);
  if (parsed.error) return parsed.error;
  return attempt(async () => {
    const r = await recordPayment({ invoiceId, amount: Math.round(parsed.data.amount), method: parsed.data.method, reference: parsed.data.reference, recordedByUserId: admin.id });
    await audit(admin.id, "invoice.payment", "invoice", invoiceId, { amount: parsed.data.amount });
    return ok(r.fullyPaid ? "Payment recorded — invoice marked paid." : "Partial payment recorded.");
  });
}

export async function voidInvoiceAction(invoiceId: string, _prev: ActionState): Promise<ActionState> {
  const admin = await requireAdmin();
  return attempt(async () => {
    const inv = await voidInvoice(invoiceId);
    if (!inv) throw new UserError("Only unpaid invoices can be voided.");
    await audit(admin.id, "invoice.void", "invoice", invoiceId);
  }, "Invoice voided.");
}

export async function resolveReplacementAction(placementId: string, resolution: "fulfilled" | "refunded", _prev: ActionState): Promise<ActionState> {
  const admin = await requireAdmin();
  return attempt(async () => {
    await resolveReplacement(placementId, resolution);
    await audit(admin.id, `placement.replacement_${resolution}`, "placement", placementId);
  });
}

export async function setServiceStatusAction(requestId: string, status: "in_progress" | "fulfilled" | "cancelled", _prev: ActionState): Promise<ActionState> {
  await requireAdmin();
  return attempt(async () => {
    const [sr] = await db.update(serviceRequests).set({ status, updatedAt: new Date() }).where(eq(serviceRequests.id, requestId)).returning();
    if (sr && status === "cancelled" && sr.invoiceId) await voidInvoice(sr.invoiceId);
  });
}

// ─── Recruitment desk ("Find Jobs For Me") ────────────────────────────────

export async function recommendJobAction(candidateId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const jobId = str(fd, "jobId");
  if (!jobId) return fail("Choose a job.");
  return attempt(async () => {
    const [candidate] = await db.select().from(candidates).where(eq(candidates.id, candidateId)).limit(1);
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!candidate || !job || job.status !== "active") throw new UserError("Candidate or job not available.");
    const eds = (await educationsByCandidate([candidate.id])).get(candidate.id) ?? [];
    const match = matchCandidateToJob(toMatchCandidate(candidate, eds), job);
    const { recommendation, created } = await createRecommendation({ candidateId, jobId, source: "recruitment_team", score: match.score, reasons: match.reasons, message: str(fd, "message"), createdByUserId: admin.id });
    if (!created) throw new UserError("This job was already recommended to the candidate.");
    const { findJobsRequests, recommendations } = await import("@/db/schema");
    const [req] = await db.select().from(findJobsRequests).where(eq(findJobsRequests.candidateId, candidateId)).limit(1);
    if (req?.applyMode === "auto_apply") {
      await applyToJob({ candidateId, jobId, source: "find_jobs_for_me" });
      await db.update(recommendations).set({ status: "applied", respondedAt: new Date() }).where(eq(recommendations.id, recommendation.id));
      await notify(candidate.userId, { type: "job_match", title: `We applied to ${job.title} for you`, body: "Based on your Find Jobs For Me preferences.", link: "/candidate/applications" });
      return ok("Recommended and applied automatically (candidate chose auto-apply).");
    }
    await notify(candidate.userId, { type: "job_match", title: "Our recruiters recommended a job for you", body: `${job.title} — ${match.score}% match. Would you like us to apply?`, link: "/candidate/find-jobs" });
  }, "Recommendation sent — waiting for the candidate's consent.");
}

// ─── Communication moderation ──────────────────────────────────────────────

export async function moderateMessageAction(messageId: string, decision: "dismiss" | "block" | "suspend", _prev: ActionState): Promise<ActionState> {
  const admin = await requireAdmin();
  return attempt(async () => {
    const [msg] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    if (!msg) throw new UserError("Message not found.");
    await db.update(messages).set({ moderationStatus: decision === "dismiss" ? "dismissed" : "actioned" }).where(eq(messages.id, messageId));
    if (decision === "block") await db.update(conversations).set({ status: "blocked" }).where(eq(conversations.id, msg.conversationId));
    if (decision === "suspend" && msg.senderUserId) {
      await db.update(users).set({ status: "suspended" }).where(eq(users.id, msg.senderUserId));
      const { sessions } = await import("@/db/schema");
      await db.delete(sessions).where(eq(sessions.userId, msg.senderUserId));
    }
    await audit(admin.id, `message.${decision}`, "message", messageId);
  });
}

export async function setConversationStatusAction(conversationId: string, status: "open" | "blocked", _prev: ActionState): Promise<ActionState> {
  const admin = await requireAdmin();
  return attempt(async () => {
    await db.update(conversations).set({ status }).where(eq(conversations.id, conversationId));
    await audit(admin.id, `conversation.${status}`, "conversation", conversationId);
  });
}

// ─── Jobs runner ───────────────────────────────────────────────────────────

export async function runScheduledJobsAction(_prev: ActionState): Promise<ActionState> {
  const admin = await requireAdmin();
  return attempt(async () => {
    const r = await runScheduledJobs();
    await audit(admin.id, "scheduler.run", "system", null, r);
    return ok(`Done: ${r.reminders} reminders, ${r.milestones} milestones, ${r.overdue} overdue, ${r.renewals} renewals, ${r.recommended} recommendations, ${r.applied} auto-applications.`);
  });
}

export async function featureCompanyAction(companyId: string, days: number, _prev: ActionState): Promise<ActionState> {
  const admin = await requireAdmin();
  return attempt(async () => {
    await db.update(companies).set({ featuredUntil: days > 0 ? new Date(Date.now() + days * 86_400_000) : null }).where(eq(companies.id, companyId));
    await audit(admin.id, "company.featured", "company", companyId, { days });
  });
}
