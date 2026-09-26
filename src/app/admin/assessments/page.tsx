import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { assessments } from "@/db/schema";
import { saveAssessmentAction } from "@/actions/admin";
import { Badge, Card, CardBody, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui";
import { ASSESSMENT_CATEGORIES, labelOf } from "@/lib/constants";
import { AssessmentForm } from "./assessment-forms";

export const metadata: Metadata = { title: "Assessments" };

// Correlated subqueries need the outer table qualified explicitly.
const OUTER_ID = sql.raw('"assessments"."id"');

export default async function AdminAssessmentsPage() {
  const rows = await db
    .select({
      a: assessments,
      questions: sql<number>`(select count(*) from questions q where q.assessment_id = ${OUTER_ID} and q.is_active = 1)`,
      attempts: sql<number>`(select count(*) from assessment_attempts t where t.assessment_id = ${OUTER_ID} and t.status != 'in_progress')`,
      passed: sql<number>`(select count(*) from assessment_attempts t where t.assessment_id = ${OUTER_ID} and t.passed = 1)`,
    })
    .from(assessments)
    .orderBy(assessments.level, assessments.title);
  return (
    <div className="space-y-6">
      <PageHeader title="Assessments" description="Aptitude tests, industry tests, question bank, attempts, passing criteria and analytics." />
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Assessment</Th>
              <Th>Level</Th>
              <Th>Question bank</Th>
              <Th>Pass mark</Th>
              <Th>Attempts</Th>
              <Th>Pass rate</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ a, questions: q, attempts, passed }) => (
              <tr key={a.id}>
                <Td>
                  <Link href={`/admin/assessments/${a.id}`} className="font-medium hover:text-accent">{a.title}</Link>
                  <p className="text-xs text-ink-3">{labelOf(ASSESSMENT_CATEGORIES, a.category)}</p>
                </Td>
                <Td>Level {a.level}</Td>
                <Td>{Number(q)} active · {a.questionsPerAttempt} per attempt</Td>
                <Td>{a.passingPercent}%</Td>
                <Td>{Number(attempts)}</Td>
                <Td>{Number(attempts) ? `${Math.round((Number(passed) / Number(attempts)) * 100)}%` : "—"}</Td>
                <Td><Badge tone={a.isActive ? "good" : "neutral"}>{a.isActive ? "Active" : "Inactive"}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Card>
        <CardHeader title="New assessment" description="Create a new Level 2 track (e.g. Marketing) or a replacement Level 1 test." />
        <CardBody>
          <AssessmentForm action={saveAssessmentAction.bind(null, null)} />
        </CardBody>
      </Card>
    </div>
  );
}
