import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assessmentAttempts, assessments, type Assessment } from "@/db/schema";
import { startAttemptAction } from "@/actions/candidate";
import { ScreeningBadges } from "@/components/badges";
import { ActionButton } from "@/components/forms";
import { Badge, ButtonLink, Card, CardBody, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui";
import { INDUSTRIES, labelOf } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { requireCandidate } from "@/server/auth";
import { attemptEligibility } from "@/server/assessments";

export const metadata: Metadata = { title: "Assessments" };

async function AssessmentCard({ a, candidate, recommended }: { a: Assessment; candidate: Awaited<ReturnType<typeof requireCandidate>>["candidate"]; recommended?: boolean }) {
  const { inProgress, eligibility, attempts } = await attemptEligibility(a, candidate);
  const passed = attempts.find((x) => x.passed);
  const otherL2 = a.level === 2 && candidate.level2QualifiedAt && candidate.level2Category !== a.category;
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{a.title}</p>
          <p className="mt-1 text-sm text-ink-2">{a.description}</p>
        </div>
        {recommended ? <Badge tone="accent">Your industry</Badge> : null}
      </div>
      <p className="mt-3 text-xs text-ink-3">
        {a.questionsPerAttempt} questions · {a.durationMinutes} minutes · pass mark {a.passingPercent}%
      </p>
      <div className="mt-4 flex-1" />
      {passed ? (
        <Badge tone="good" className="self-start">
          Qualified ✓ · {passed.scorePercent}% on {formatDate(passed.submittedAt)}
        </Badge>
      ) : inProgress ? (
        <ButtonLink href={`/candidate/assessments/${inProgress.id}`} className="self-start">
          Resume attempt
        </ButtonLink>
      ) : otherL2 ? (
        <p className="text-sm text-ink-2">You’re already Level 2 qualified in {labelOf(INDUSTRIES, candidate.level2Category)}.</p>
      ) : eligibility.ok ? (
        <ActionButton action={startAttemptAction.bind(null, a.id)} variant="primary" size="md" confirm={`Start “${a.title}”? The ${a.durationMinutes}-minute timer begins immediately.`}>
          Start assessment
        </ActionButton>
      ) : (
        <p className="text-sm text-ink-2">
          {eligibility.reason}
          {eligibility.retryAt ? ` Next attempt: ${formatDateTime(eligibility.retryAt)}.` : ""}
        </p>
      )}
    </Card>
  );
}

export default async function AssessmentsPage() {
  const { candidate } = await requireCandidate();
  const all = await db.select().from(assessments).where(eq(assessments.isActive, true));
  const level1 = all.find((a) => a.level === 1);
  const level2 = all.filter((a) => a.level === 2).sort((a, b) => Number(b.category === candidate.industry) - Number(a.category === candidate.industry));
  const history = await db
    .select({ attempt: assessmentAttempts, assessment: assessments })
    .from(assessmentAttempts)
    .innerJoin(assessments, eq(assessments.id, assessmentAttempts.assessmentId))
    .where(and(eq(assessmentAttempts.candidateId, candidate.id)))
    .orderBy(desc(assessmentAttempts.startedAt));

  return (
    <div className="space-y-6">
      <PageHeader title="Screening assessments" description="Pass platform assessments once and show companies verified results — instead of repeating screening tests for every application." actions={<ScreeningBadges candidate={candidate} />} />
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Level 1 — Aptitude & basic screening</h2>
        <div className="grid gap-4 md:grid-cols-2">{level1 ? <AssessmentCard a={level1} candidate={candidate} /> : <p className="text-sm text-ink-2">Not available.</p>}</div>
      </section>
      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink-3">Level 2 — Industry / role assessment</h2>
        <p className="mb-3 text-sm text-ink-2">Choose the track that matches your career category. Requires Level 1.</p>
        <div className="grid gap-4 md:grid-cols-2">
          {level2.map((a) => (
            <AssessmentCard key={a.id} a={a} candidate={candidate} recommended={a.category === candidate.industry} />
          ))}
        </div>
      </section>
      <Card>
        <CardHeader title="Attempt history" />
        {history.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Assessment</Th>
                <Th>Date</Th>
                <Th>Score</Th>
                <Th>Result</Th>
              </tr>
            </thead>
            <tbody>
              {history.map(({ attempt, assessment }) => (
                <tr key={attempt.id}>
                  <Td>
                    <Link href={`/candidate/assessments/${attempt.id}`} className="font-medium hover:text-accent">
                      {assessment.title}
                    </Link>
                  </Td>
                  <Td>{formatDateTime(attempt.startedAt)}</Td>
                  <Td>{attempt.scorePercent != null ? `${attempt.scorePercent}%` : "—"}</Td>
                  <Td>
                    {attempt.status === "in_progress" ? <Badge tone="info">In progress</Badge> : attempt.passed ? <Badge tone="good">Passed</Badge> : attempt.status === "expired" ? <Badge tone="bad">Time expired</Badge> : <Badge tone="bad">Not passed</Badge>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <CardBody>
            <p className="text-sm text-ink-2">No attempts yet.</p>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
