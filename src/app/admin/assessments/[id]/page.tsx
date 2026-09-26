import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assessmentAttempts, assessments, candidates, questions } from "@/db/schema";
import { addQuestionAction, saveAssessmentAction, toggleAssessmentAction, toggleQuestionAction } from "@/actions/admin";
import { ActionButton } from "@/components/forms";
import { Badge, BarList, Card, CardBody, CardHeader, PageHeader, StatTile, Table, Td, Th } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { AssessmentForm, QuestionForm } from "../assessment-forms";

export const metadata: Metadata = { title: "Assessment" };

export default async function AdminAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [a] = await db.select().from(assessments).where(eq(assessments.id, id)).limit(1);
  if (!a) notFound();
  const [qs, attempts] = await Promise.all([
    db.select().from(questions).where(eq(questions.assessmentId, a.id)).orderBy(questions.topic),
    db.select({ attempt: assessmentAttempts, name: candidates.fullName }).from(assessmentAttempts).innerJoin(candidates, eq(candidates.id, assessmentAttempts.candidateId)).where(eq(assessmentAttempts.assessmentId, a.id)).orderBy(desc(assessmentAttempts.startedAt)),
  ]);
  const done = attempts.filter((x) => x.attempt.status !== "in_progress");
  const passed = done.filter((x) => x.attempt.passed).length;
  const avg = done.length ? Math.round(done.reduce((s, x) => s + (x.attempt.scorePercent ?? 0), 0) / done.length) : 0;
  const topicTotals = new Map<string, { correct: number; total: number }>();
  for (const { attempt } of done) {
    for (const [topic, v] of Object.entries(attempt.topicBreakdown ?? {})) {
      const t = topicTotals.get(topic) ?? { correct: 0, total: 0 };
      t.correct += v.correct;
      t.total += v.total;
      topicTotals.set(topic, t);
    }
  }
  const topics = [...new Set(qs.map((q) => q.topic))];
  return (
    <div className="space-y-6">
      <PageHeader
        title={a.title}
        back={{ href: "/admin/assessments", label: "Assessments" }}
        description={<Badge tone={a.isActive ? "good" : "neutral"}>{a.isActive ? "Active" : "Inactive"}</Badge>}
        actions={<ActionButton action={toggleAssessmentAction.bind(null, a.id, !a.isActive)} variant={a.isActive ? "danger" : "primary"} size="md">{a.isActive ? "Deactivate" : "Activate"}</ActionButton>}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Completed attempts" value={done.length} />
        <StatTile label="Pass rate" value={done.length ? `${Math.round((passed / done.length) * 100)}%` : "—"} hint={`${passed} passed`} />
        <StatTile label="Average score" value={done.length ? `${avg}%` : "—"} hint={`Pass mark ${a.passingPercent}%`} />
        <StatTile label="Active questions" value={qs.filter((q) => q.isActive).length} hint={`${a.questionsPerAttempt} drawn per attempt`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Accuracy by topic" description="Share of correct answers across all attempts" />
          <CardBody>
            {topicTotals.size ? <BarList ariaLabel="Accuracy by topic" valueSuffix="%" rows={[...topicTotals.entries()].map(([t, v]) => ({ label: t, value: Math.round((v.correct / Math.max(1, v.total)) * 100), hint: `${v.correct}/${v.total} correct` }))} /> : <p className="text-sm text-ink-2">Topic analytics appear after attempts with recorded answers.</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Settings & passing criteria" />
          <CardBody>
            <AssessmentForm action={saveAssessmentAction.bind(null, a.id)} d={{ ...a, description: a.description ?? "" }} />
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader title="Question bank" description={`${qs.length} questions across ${topics.length} topics`} />
        <Table>
          <thead>
            <tr>
              <Th>Topic</Th>
              <Th>Question</Th>
              <Th>Answer</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {qs.map((q) => (
              <tr key={q.id} className={q.isActive ? "" : "opacity-60"}>
                <Td className="whitespace-nowrap">{q.topic}</Td>
                <Td>
                  {q.text}
                  <p className="text-xs text-ink-3">{q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("   ")}</p>
                </Td>
                <Td>{String.fromCharCode(65 + q.correctIndex)}</Td>
                <Td><Badge tone={q.isActive ? "good" : "neutral"}>{q.isActive ? "Active" : "Retired"}</Badge></Td>
                <Td>
                  <ActionButton action={toggleQuestionAction.bind(null, q.id, !q.isActive)} variant="ghost">{q.isActive ? "Retire" : "Restore"}</ActionButton>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <CardBody className="border-t border-line">
          <p className="mb-3 font-medium text-ink">Add a question</p>
          <QuestionForm action={addQuestionAction.bind(null, a.id)} topics={topics} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Recent attempts" />
        <Table>
          <thead>
            <tr>
              <Th>Candidate</Th>
              <Th>Started</Th>
              <Th>Score</Th>
              <Th>Result</Th>
            </tr>
          </thead>
          <tbody>
            {attempts.slice(0, 50).map(({ attempt, name }) => (
              <tr key={attempt.id}>
                <Td>{name}</Td>
                <Td>{formatDateTime(attempt.startedAt)}</Td>
                <Td>{attempt.scorePercent != null ? `${attempt.scorePercent}%` : "—"}</Td>
                <Td>{attempt.status === "in_progress" ? <Badge tone="info">In progress</Badge> : attempt.passed ? <Badge tone="good">Passed</Badge> : <Badge tone="bad">{attempt.status === "expired" ? "Expired" : "Failed"}</Badge>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
