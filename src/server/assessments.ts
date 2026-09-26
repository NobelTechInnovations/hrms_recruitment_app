// Candidate screening (README §4): timed, server-scored assessments.

import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { assessmentAttempts, assessments, candidates, questions, type Assessment, type Candidate } from "@/db/schema";
import { canStartAttempt, drawQuestions, scoreAttempt } from "@/lib/assessment-engine";
import { labelOf, INDUSTRIES } from "@/lib/constants";
import { notify } from "./notify";
import { UserError } from "@/lib/errors";

export class AssessmentError extends UserError {}

const GRACE_MS = 30_000; // allow for network latency on submit

export async function attemptEligibility(assessment: Assessment, candidate: Candidate) {
  const attempts = await db
    .select()
    .from(assessmentAttempts)
    .where(and(eq(assessmentAttempts.assessmentId, assessment.id), eq(assessmentAttempts.candidateId, candidate.id)))
    .orderBy(desc(assessmentAttempts.startedAt));
  const inProgress = attempts.find((a) => a.status === "in_progress" && a.expiresAt.getTime() + GRACE_MS > Date.now());
  const lastFailed = attempts.find((a) => a.status !== "in_progress" && !a.passed);
  const alreadyPassed = attempts.some((a) => a.passed);
  const eligibility = canStartAttempt({
    level: assessment.level,
    level1Qualified: !!candidate.level1QualifiedAt,
    alreadyPassed,
    lastFailedAt: lastFailed ? (lastFailed.submittedAt ?? lastFailed.expiresAt) : null,
    cooldownDays: assessment.retakeCooldownDays,
  });
  return { attempts, inProgress, eligibility };
}

export async function startAttempt(assessmentId: string, candidate: Candidate) {
  const [assessment] = await db.select().from(assessments).where(eq(assessments.id, assessmentId)).limit(1);
  if (!assessment || !assessment.isActive) throw new AssessmentError("Assessment not available.");
  if (assessment.level === 2 && candidate.level2QualifiedAt) {
    throw new AssessmentError(`You are already Level 2 qualified in ${labelOf(INDUSTRIES, candidate.level2Category)}.`);
  }
  const { inProgress, eligibility } = await attemptEligibility(assessment, candidate);
  if (inProgress) return inProgress;
  if (!eligibility.ok) throw new AssessmentError(eligibility.reason);

  const pool = await db
    .select({ id: questions.id, topic: questions.topic })
    .from(questions)
    .where(and(eq(questions.assessmentId, assessment.id), eq(questions.isActive, true)));
  if (pool.length === 0) throw new AssessmentError("This assessment has no questions yet.");
  const picked = drawQuestions(pool, assessment.questionsPerAttempt);
  const now = new Date();
  const [attempt] = await db
    .insert(assessmentAttempts)
    .values({
      assessmentId: assessment.id,
      candidateId: candidate.id,
      questionIds: picked.map((q) => q.id),
      startedAt: now,
      expiresAt: new Date(now.getTime() + assessment.durationMinutes * 60_000),
    })
    .returning();
  return attempt!;
}

export async function submitAttempt(attemptId: string, candidate: Candidate, answers: Record<string, number>) {
  const [attempt] = await db
    .select()
    .from(assessmentAttempts)
    .where(and(eq(assessmentAttempts.id, attemptId), eq(assessmentAttempts.candidateId, candidate.id)))
    .limit(1);
  if (!attempt) throw new AssessmentError("Attempt not found.");
  if (attempt.status !== "in_progress") throw new AssessmentError("This attempt has already been submitted.");
  const [assessment] = await db.select().from(assessments).where(eq(assessments.id, attempt.assessmentId)).limit(1);
  if (!assessment) throw new AssessmentError("Assessment not found.");

  const now = new Date();
  const late = now.getTime() > attempt.expiresAt.getTime() + GRACE_MS;
  const qs = await db
    .select({ id: questions.id, topic: questions.topic, correctIndex: questions.correctIndex })
    .from(questions)
    .where(inArray(questions.id, attempt.questionIds));
  // Only accept answers for questions in this attempt.
  const clean: Record<string, number> = {};
  for (const id of attempt.questionIds) if (typeof answers[id] === "number") clean[id] = answers[id]!;
  const result = scoreAttempt(qs, late ? {} : clean);
  const passed = !late && result.percent >= assessment.passingPercent;

  await db
    .update(assessmentAttempts)
    .set({ answers: clean, submittedAt: now, scorePercent: result.percent, passed, status: late ? "expired" : "submitted", topicBreakdown: result.breakdown })
    .where(eq(assessmentAttempts.id, attempt.id));

  if (passed) {
    if (assessment.level === 1) {
      await db.update(candidates).set({ level1QualifiedAt: now, level1Score: result.percent, updatedAt: now }).where(eq(candidates.id, candidate.id));
      await notify(candidate.userId, {
        type: "assessment",
        title: "You are Level 1 Qualified ✓",
        body: `You scored ${result.percent}%. Please complete your Level 2 assessment to stand out to employers in your industry.`,
        link: "/candidate/assessments",
      });
    } else {
      await db
        .update(candidates)
        .set({ level2QualifiedAt: now, level2Score: result.percent, level2Category: assessment.category, updatedAt: now })
        .where(eq(candidates.id, candidate.id));
      await notify(candidate.userId, {
        type: "assessment",
        title: "You are Level 2 Industry Qualified ✓",
        body: `You scored ${result.percent}% in ${assessment.title}.`,
        link: "/candidate/assessments",
      });
    }
  }
  return { ...result, passed, late, passingPercent: assessment.passingPercent };
}

/** Close attempts that ran out of time without being submitted. */
export async function expireStaleAttempts(now = new Date()): Promise<number> {
  const rows = await db
    .update(assessmentAttempts)
    .set({ status: "expired", passed: false, scorePercent: 0, submittedAt: now })
    .where(and(eq(assessmentAttempts.status, "in_progress"), lt(assessmentAttempts.expiresAt, new Date(now.getTime() - GRACE_MS))))
    .returning({ id: assessmentAttempts.id });
  return rows.length;
}
