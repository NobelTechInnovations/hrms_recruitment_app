import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { CalendarPlus, Mail, Video } from "lucide-react";
import { db } from "@/db";
import { applicationEvents, applications, companies, interviews, jobs, resumes } from "@/db/schema";
import { messageCompanyAboutApplicationAction, withdrawApplicationAction } from "@/actions/candidate";
import { CompanyVerificationBadge, StageBadge } from "@/components/badges";
import { ActionButton } from "@/components/forms";
import { JobMeta } from "@/components/job-card";
import { PipelineProgress } from "@/components/pipeline-progress";
import { Alert, Badge, ButtonLink, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { INTERVIEW_MODES, labelOf } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { googleCalendarUrl } from "@/lib/ics";
import { isTerminal, stageLabel } from "@/lib/pipeline";
import { requireCandidate } from "@/server/auth";

export const metadata: Metadata = { title: "Application" };

export default async function CandidateApplicationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ applied?: string }> }) {
  const { id } = await params;
  const { applied } = await searchParams;
  const { candidate } = await requireCandidate();
  const [row] = await db
    .select({ app: applications, job: jobs, company: companies })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(companies, eq(companies.id, applications.companyId))
    .where(and(eq(applications.id, id), eq(applications.candidateId, candidate.id)))
    .limit(1);
  if (!row) notFound();
  const { app, job, company } = row;
  const [events, ivs, resume] = await Promise.all([
    db.select().from(applicationEvents).where(eq(applicationEvents.applicationId, app.id)).orderBy(asc(applicationEvents.createdAt)),
    db.select().from(interviews).where(eq(interviews.applicationId, app.id)).orderBy(asc(interviews.scheduledAt)),
    app.resumeId ? db.select().from(resumes).where(eq(resumes.id, app.resumeId)).limit(1) : Promise.resolve([]),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title={job.title}
        back={{ href: "/candidate/applications", label: "Applications" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {company.name} <CompanyVerificationBadge status={company.verificationStatus} /> <StageBadge stage={app.stage} />
          </span>
        }
        actions={
          <>
            <ActionButton action={messageCompanyAboutApplicationAction.bind(null, app.id)} variant="secondary" size="md">
              <Mail className="h-4 w-4" aria-hidden /> Message company
            </ActionButton>
            {!isTerminal(app.stage) ? (
              <ActionButton action={withdrawApplicationAction.bind(null, app.id)} variant="danger" size="md" confirm="Withdraw this application? This can't be undone.">
                Withdraw
              </ActionButton>
            ) : null}
          </>
        }
      />
      {applied ? <Alert tone="good" title="Application submitted">The hiring team has been notified. You’ll get updates here and by notification as your application moves through the pipeline.</Alert> : null}
      <Card>
        <CardHeader title="Progress" />
        <CardBody>
          <PipelineProgress stage={app.stage} history={events} />
          {app.stage === "rejected" && app.rejectionReason ? <p className="mt-2 text-sm text-ink-2">Feedback: {app.rejectionReason}</p> : null}
        </CardBody>
      </Card>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Interviews" />
            <CardBody>
              {ivs.length ? (
                <ul className="divide-y divide-line">
                  {ivs.map((iv) => (
                    <li key={iv.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="font-medium text-ink">{iv.title}</p>
                        <p className="text-sm text-ink-2">
                          {formatDateTime(iv.scheduledAt)} · {iv.durationMinutes} min · {labelOf(INTERVIEW_MODES, iv.mode)}
                          {iv.location ? ` · ${iv.location}` : ""}
                        </p>
                        <div className="mt-1">
                          <Badge tone={iv.status === "scheduled" ? "accent" : iv.status === "completed" ? "good" : "neutral"}>{iv.status === "scheduled" ? "Scheduled" : iv.status === "completed" ? "Completed" : iv.status === "cancelled" ? "Cancelled" : "No-show"}</Badge>
                          {iv.rescheduleCount ? <span className="ml-2 text-xs text-ink-3">Rescheduled {iv.rescheduleCount}×</span> : null}
                        </div>
                      </div>
                      {iv.status === "scheduled" ? (
                        <div className="flex flex-wrap gap-2">
                          {iv.meetingUrl ? (
                            <ButtonLink href={iv.meetingUrl} target="_blank" rel="noopener noreferrer" size="sm">
                              <Video className="h-3.5 w-3.5" aria-hidden /> Join
                            </ButtonLink>
                          ) : null}
                          <ButtonLink href={`/api/interviews/${iv.id}/ics`} size="sm" variant="secondary" prefetch={false}>
                            <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> .ics
                          </ButtonLink>
                          <ButtonLink href={googleCalendarUrl({ title: `${iv.title} — ${company.name}`, start: iv.scheduledAt, durationMinutes: iv.durationMinutes, location: iv.meetingUrl ?? iv.location, details: job.title })} target="_blank" rel="noopener noreferrer" size="sm" variant="ghost">
                            Google Calendar
                          </ButtonLink>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-2">No interviews scheduled yet.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Job" action={<Link href={`/jobs/${job.id}`} className="text-sm font-medium text-accent hover:underline">View posting</Link>} />
            <CardBody className="space-y-3">
              <JobMeta job={job} />
              <p className="line-clamp-4 text-sm text-ink-2">{job.description}</p>
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="What you sent" />
            <CardBody className="space-y-2 text-sm">
              <p>
                <span className="text-ink-3">Resume:</span> {resume[0] ? <Link className="text-accent hover:underline" href={`/candidate/resumes/${resume[0].id}`}>{resume[0].title}</Link> : app.uploadedResumeDocId ? "Uploaded file" : "Profile only"}
              </p>
              {app.coverNote ? <p className="whitespace-pre-line text-ink-2">{app.coverNote}</p> : null}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="History" />
            <CardBody>
              <ol className="space-y-3 border-l border-line pl-4">
                {events.map((e) => (
                  <li key={e.id} className="text-sm">
                    <p className="font-medium text-ink">{stageLabel(e.toStage)}</p>
                    <p className="text-xs text-ink-3">{formatDateTime(e.createdAt)}</p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
