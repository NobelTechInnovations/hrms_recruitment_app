import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, Video } from "lucide-react";
import { Badge, ButtonLink, Card, CardBody, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { INTERVIEW_MODES, labelOf } from "@/lib/constants";
import { formatDateTime, formatWhen } from "@/lib/format";
import { stageLabel } from "@/lib/pipeline";
import { isUpcoming } from "@/lib/time";
import { requireCompany } from "@/server/auth";
import { companyInterviewList } from "@/server/company-queries";

export const metadata: Metadata = { title: "Interviews" };

export default async function CompanyInterviewsPage({ searchParams }: { searchParams: Promise<{ mine?: string }> }) {
  const { user, member, company } = await requireCompany();
  const { mine } = await searchParams;
  const onlyMine = member.role === "interviewer" || mine === "1";
  const all = await companyInterviewList(company.id, { interviewerUserId: onlyMine ? user.id : undefined });
  const upcoming = all.filter((r) => r.interview.status === "scheduled" && isUpcoming(r.interview.scheduledAt)).reverse();
  const past = all.filter((r) => !upcoming.includes(r));
  return (
    <div className="space-y-6">
      <PageHeader
        title="Interviews"
        description={member.role === "interviewer" ? "Interviews assigned to you." : "All interviews across your jobs."}
        actions={member.role !== "interviewer" ? <ButtonLink href={onlyMine ? "/company/interviews" : "/company/interviews?mine=1"} variant="secondary" size="sm">{onlyMine ? "Show all" : "Only mine"}</ButtonLink> : null}
      />
      <Card>
        <CardHeader title="Upcoming" />
        <CardBody>
          {upcoming.length ? (
            <ul className="divide-y divide-line">
              {upcoming.map(({ interview, candidate, job, application, interviewer }) => (
                <li key={interview.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <Link href={`/company/applications/${application.id}`} className="font-medium text-ink hover:text-accent">
                      {candidate.fullName}
                    </Link>
                    <p className="text-sm text-ink-2">
                      {interview.title} · {job.title} · {stageLabel(interview.stage)}
                    </p>
                    <p className="text-sm text-ink-2">
                      {formatDateTime(interview.scheduledAt)} ({formatWhen(interview.scheduledAt)}) · {labelOf(INTERVIEW_MODES, interview.mode)}
                      {interviewer ? ` · ${interviewer.name}` : " · unassigned"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {interview.meetingUrl ? (
                      <ButtonLink href={interview.meetingUrl} target="_blank" rel="noopener noreferrer" size="sm">
                        <Video className="h-3.5 w-3.5" aria-hidden /> Join
                      </ButtonLink>
                    ) : null}
                    <ButtonLink href={`/api/interviews/${interview.id}/ics`} size="sm" variant="secondary" prefetch={false}>
                      <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> Calendar
                    </ButtonLink>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No upcoming interviews" />
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Interview history" />
        {past.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Candidate</Th>
                <Th>Interview</Th>
                <Th>When</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {past.map(({ interview, candidate, job, application }) => (
                <tr key={interview.id}>
                  <Td>
                    <Link href={`/company/applications/${application.id}`} className="font-medium hover:text-accent">
                      {candidate.fullName}
                    </Link>
                  </Td>
                  <Td>
                    {interview.title}
                    <p className="text-xs text-ink-3">{job.title}</p>
                  </Td>
                  <Td>{formatDateTime(interview.scheduledAt)}</Td>
                  <Td>
                    <Badge tone={interview.status === "completed" ? "good" : interview.status === "scheduled" ? "warn" : "neutral"}>{interview.status === "scheduled" ? "Awaiting outcome" : interview.status.replace("_", "-")}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <CardBody>
            <p className="text-sm text-ink-2">No past interviews.</p>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
