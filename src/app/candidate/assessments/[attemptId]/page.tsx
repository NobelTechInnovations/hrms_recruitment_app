import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { assessmentAttempts, assessments, questions } from "@/db/schema";
import { submitAttemptAction } from "@/actions/candidate";
import { Alert, BarList, ButtonLink, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { hasNotPassed } from "@/lib/time";
import { requireCandidate } from "@/server/auth";
import { TestRunner } from "./test-runner";

export const metadata: Metadata = { title: "Assessment" };

export default async function AttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const { candidate } = await requireCandidate();
  const [row] = await db
    .select({ attempt: assessmentAttempts, assessment: assessments })
    .from(assessmentAttempts)
    .innerJoin(assessments, eq(assessments.id, assessmentAttempts.assessmentId))
    .where(and(eq(assessmentAttempts.id, attemptId), eq(assessmentAttempts.candidateId, candidate.id)))
    .limit(1);
  if (!row) notFound();
  const { attempt, assessment } = row;

  if (attempt.status === "in_progress" && hasNotPassed(attempt.expiresAt, 30_000)) {
    const qs = await db
      .select({ id: questions.id, topic: questions.topic, text: questions.text, options: questions.options })
      .from(questions)
      .where(inArray(questions.id, attempt.questionIds));
    const ordered = attempt.questionIds.map((id) => qs.find((q) => q.id === id)).filter((q): q is (typeof qs)[number] => !!q);
    return <TestRunner action={submitAttemptAction.bind(null, attempt.id)} questions={ordered} expiresAt={attempt.expiresAt.getTime()} title={assessment.title} />;
  }

  const breakdown = Object.entries(attempt.topicBreakdown ?? {});
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={assessment.title} description={`Submitted ${formatDateTime(attempt.submittedAt)}`} back={{ href: "/candidate/assessments", label: "Assessments" }} />
      {attempt.passed ? (
        <Alert tone="good" title={assessment.level === 1 ? "Level 1 Qualified ✓" : "Level 2 Industry Qualified ✓"}>
          You scored {attempt.scorePercent}% (pass mark {assessment.passingPercent}%). The badge now appears on your profile for companies.
        </Alert>
      ) : attempt.status === "in_progress" || attempt.status === "expired" ? (
        <Alert tone="bad" title="Time expired">
          The attempt wasn’t submitted in time. You can retake it after the {assessment.retakeCooldownDays}-day cooldown.
        </Alert>
      ) : (
        <Alert tone="warn" title={`You scored ${attempt.scorePercent}% — the pass mark is ${assessment.passingPercent}%`}>
          Review the topics below and retake the assessment after the {assessment.retakeCooldownDays}-day cooldown.
        </Alert>
      )}
      {breakdown.length ? (
        <Card>
          <CardHeader title="Score by topic" description="Correct answers per topic" />
          <CardBody>
            <BarList ariaLabel="Correct answers by topic" rows={breakdown.map(([topic, v]) => ({ label: topic, value: v.correct, hint: `${v.correct} of ${v.total} correct` }))} />
          </CardBody>
        </Card>
      ) : null}
      <ButtonLink href="/candidate/assessments" variant="secondary">
        Back to assessments
      </ButtonLink>
    </div>
  );
}
