import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, Video } from "lucide-react";
import { Badge, ButtonLink, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { INTERVIEW_MODES, labelOf } from "@/lib/constants";
import { formatDateTime, formatWhen } from "@/lib/format";
import { isUpcoming } from "@/lib/time";
import { requireCandidate } from "@/server/auth";
import { candidateInterviews } from "@/server/candidate-queries";

export const metadata: Metadata = { title: "Interviews" };

export default async function CandidateInterviewsPage() {
  const { candidate } = await requireCandidate();
  const all = await candidateInterviews(candidate.id);
  const upcoming = all.filter((r) => r.interview.status === "scheduled" && isUpcoming(r.interview.scheduledAt)).reverse();
  const past = all.filter((r) => !upcoming.includes(r));
  return (
    <div className="space-y-6">
      <PageHeader title="Interviews" description="Join video interviews, add them to your calendar and see your interview history." />
      <Card>
        <CardHeader title="Upcoming" />
        <CardBody>
          {upcoming.length ? (
            <ul className="divide-y divide-line">
              {upcoming.map(({ interview, job, company, application }) => (
                <li key={interview.id} className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium text-ink">
                      {interview.title} — <Link className="hover:text-accent" href={`/candidate/applications/${application.id}`}>{job.title}</Link>
                    </p>
                    <p className="text-sm text-ink-2">
                      {company.name} · {formatDateTime(interview.scheduledAt)} ({formatWhen(interview.scheduledAt)}) · {interview.durationMinutes} min · {labelOf(INTERVIEW_MODES, interview.mode)}
                    </p>
                    {interview.location ? <p className="text-sm text-ink-2">{interview.location}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    {interview.meetingUrl ? (
                      <ButtonLink href={interview.meetingUrl} target="_blank" rel="noopener noreferrer" size="sm">
                        <Video className="h-3.5 w-3.5" aria-hidden /> Join
                      </ButtonLink>
                    ) : null}
                    <ButtonLink href={`/api/interviews/${interview.id}/ics`} size="sm" variant="secondary" prefetch={false}>
                      <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> Add to calendar
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
        <CardHeader title="History" />
        <CardBody>
          {past.length ? (
            <ul className="divide-y divide-line">
              {past.map(({ interview, job, company }) => (
                <li key={interview.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 text-sm">
                  <span>
                    <span className="font-medium text-ink">{interview.title}</span> <span className="text-ink-2">· {job.title} · {company.name} · {formatDateTime(interview.scheduledAt)}</span>
                  </span>
                  <Badge tone={interview.status === "completed" ? "good" : "neutral"}>{interview.status.replace("_", "-")}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">No past interviews.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
