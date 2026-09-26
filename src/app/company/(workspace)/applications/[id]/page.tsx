import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Bot, CalendarPlus, FileText, Mail, Video } from "lucide-react";
import { db } from "@/db";
import { applicationEvents, applications, documents, interviewFeedback, interviews, jobs, placements, resumes, users } from "@/db/schema";
import { generateSummaryAction, moveStageAction, rescheduleInterviewAction, scheduleInterviewAction, setInterviewStatusAction, startConversationAction, submitFeedbackAction } from "@/actions/company";
import { AvailabilityBadge, CandidateVerificationBadges, MatchReasons, MatchScore, PlacementStatusBadge, ScreeningBadges, StageBadge, VerificationLevelBadge } from "@/components/badges";
import { ActionButton } from "@/components/forms";
import { PipelineProgress } from "@/components/pipeline-progress";
import { Alert, Badge, ButtonLink, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui";
import { ALL_STAGES, APPLICATION_SOURCES, CANDIDATE_DOC_TYPES, EDUCATION_LEVELS, INTERVIEW_MODES, INTERVIEW_STAGES, RECOMMENDATIONS, labelOf } from "@/lib/constants";
import { formatCtcRange, formatDate, formatDateTime, formatLpa, formatYears } from "@/lib/format";
import { averageScores } from "@/lib/interview-summary";
import { joiningDays, matchCandidateToJob } from "@/lib/matching";
import { can } from "@/lib/permissions";
import { allowedNextStages, stageIndex, stageLabel } from "@/lib/pipeline";
import { requireCompany } from "@/server/auth";
import { companyMembersList } from "@/server/company-queries";
import { highestEducation, loadCandidateBundle, scoreFor, toMatchCandidate } from "@/server/queries";

import { FeedbackForm, RescheduleForm, ScheduleForm, StageForm } from "./controls";

export const metadata: Metadata = { title: "Application" };

export default async function CompanyApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, member, company } = await requireCompany();
  const [row] = await db
    .select({ app: applications, job: jobs })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(and(eq(applications.id, id), eq(applications.companyId, company.id)))
    .limit(1);
  if (!row) notFound();
  const { app, job } = row;

  const ivs = await db.select({ interview: interviews, interviewer: users }).from(interviews).leftJoin(users, eq(users.id, interviews.interviewerUserId)).where(eq(interviews.applicationId, app.id)).orderBy(asc(interviews.scheduledAt));
  const isInterviewer = member.role === "interviewer";
  if (isInterviewer && !ivs.some((i) => i.interview.interviewerUserId === user.id)) redirect("/company/interviews");

  const bundle = (await loadCandidateBundle(app.candidateId))!;
  const c = bundle.candidate;
  const score = scoreFor(bundle);
  const match = matchCandidateToJob(toMatchCandidate(c, bundle.educations), job);
  const [events, feedbackRows, placement, members, sharedDocs, resume] = await Promise.all([
    db.select({ event: applicationEvents, actor: users.name }).from(applicationEvents).leftJoin(users, eq(users.id, applicationEvents.actorUserId)).where(eq(applicationEvents.applicationId, app.id)).orderBy(desc(applicationEvents.createdAt)),
    ivs.length
      ? db
          .select({ fb: interviewFeedback, author: users.name })
          .from(interviewFeedback)
          .innerJoin(users, eq(users.id, interviewFeedback.authorUserId))
          .where(inArray(interviewFeedback.interviewId, ivs.map((i) => i.interview.id)))
          .orderBy(desc(interviewFeedback.createdAt))
      : Promise.resolve([]),
    db.select().from(placements).where(eq(placements.applicationId, app.id)).limit(1),
    companyMembersList(company.id),
    c.shareableDocTypes.length
      ? db
          .select()
          .from(documents)
          .where(and(eq(documents.ownerType, "candidate"), eq(documents.ownerId, c.id), eq(documents.status, "approved"), inArray(documents.docType, c.shareableDocTypes)))
      : Promise.resolve([]),
    app.resumeId ? db.select().from(resumes).where(eq(resumes.id, app.resumeId)).limit(1) : Promise.resolve([]),
  ]);
  const summary = feedbackRows.find((f) => f.fb.aiSummary);
  const avg = feedbackRows.length ? averageScores(feedbackRows.map((f) => f.fb)) : null;
  const manage = can(member.role, "pipeline.manage");
  const schedule = can(member.role, "interviews.schedule");
  const current = stageIndex(app.stage);
  const rank = (s: string) => (s === "rejected" ? 100 : stageIndex(s) > current ? stageIndex(s) : 200 + stageIndex(s));
  const nextStages = allowedNextStages(app.stage)
    .sort((a, b) => rank(a) - rank(b))
    .map((s) => ({ value: s, label: stageIndex(s) >= 0 && stageIndex(s) < current ? `${labelOf(ALL_STAGES, s)} (move back)` : labelOf(ALL_STAGES, s) }));
  const days = joiningDays(c);
  const p = placement[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={c.fullName}
        back={isInterviewer ? { href: "/company/interviews", label: "Interviews" } : { href: `/company/jobs/${job.id}`, label: job.title }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            Applied for <Link href={`/company/jobs/${job.id}`} className="font-medium text-ink hover:text-accent">{job.title}</Link> · {formatDate(app.createdAt)} · {labelOf(APPLICATION_SOURCES, app.source)} <StageBadge stage={app.stage} /> <MatchScore score={match.score} eligible={match.eligible} />
          </span>
        }
        actions={
          <>
            <ButtonLink href={`/company/candidates/${c.id}?job=${job.id}`} variant="secondary">
              Full profile
            </ButtonLink>
            {can(member.role, "messages.send") ? (
              <ActionButton action={startConversationAction.bind(null, c.id)} hidden={{ jobId: job.id }} variant="secondary" size="md">
                <Mail className="h-4 w-4" aria-hidden /> Message
              </ActionButton>
            ) : null}
          </>
        }
      />
      {!match.eligible ? <Alert tone="warn" title="Doesn't meet all mandatory requirements">{match.failedMandatory.join(" · ")}</Alert> : null}

      <Card>
        <CardHeader title="Pipeline" />
        <CardBody className="space-y-5">
          <PipelineProgress stage={app.stage} history={events.map((e) => e.event)} />
          {manage ? <StageForm action={moveStageAction.bind(null, app.id)} options={nextStages} defaultCtc={p?.offeredCtc != null ? String(p.offeredCtc) : c.expectedCtc != null ? String(c.expectedCtc) : ""} /> : null}
        </CardBody>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Interviews" description="Scheduling, reminders, notes, feedback and history" />
            <CardBody className="space-y-5">
              {ivs.length ? (
                <ul className="space-y-4">
                  {ivs.map(({ interview, interviewer }) => {
                    const mine = feedbackRows.find((f) => f.fb.interviewId === interview.id && f.fb.authorUserId === user.id);
                    const others = feedbackRows.filter((f) => f.fb.interviewId === interview.id);
                    const canFeedback = can(member.role, "interviews.feedback") && (!isInterviewer || interview.interviewerUserId === user.id);
                    return (
                      <li key={interview.id} className="rounded-lg border border-line p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-ink">
                              {interview.title} <span className="text-sm font-normal text-ink-2">· {stageLabel(interview.stage)}</span>
                            </p>
                            <p className="text-sm text-ink-2">
                              {formatDateTime(interview.scheduledAt)} · {interview.durationMinutes} min · {labelOf(INTERVIEW_MODES, interview.mode)}
                              {interviewer ? ` · with ${interviewer.name}` : ""}
                            </p>
                            {interview.location ? <p className="text-sm text-ink-2">{interview.location}</p> : null}
                            {interview.notes ? <p className="mt-1 text-sm text-ink-3">Note: {interview.notes}</p> : null}
                            <div className="mt-1 flex flex-wrap gap-2">
                              <Badge tone={interview.status === "scheduled" ? "accent" : interview.status === "completed" ? "good" : "neutral"}>{interview.status.replace("_", "-")}</Badge>
                              {interview.rescheduleCount ? <Badge>Rescheduled {interview.rescheduleCount}×</Badge> : null}
                              {interview.reminderSentAt ? <Badge tone="info">Reminder sent</Badge> : null}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {interview.status === "scheduled" && interview.meetingUrl ? (
                              <ButtonLink href={interview.meetingUrl} target="_blank" rel="noopener noreferrer" size="sm">
                                <Video className="h-3.5 w-3.5" aria-hidden /> Join
                              </ButtonLink>
                            ) : null}
                            <ButtonLink href={`/api/interviews/${interview.id}/ics`} size="sm" variant="ghost" prefetch={false}>
                              <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> .ics
                            </ButtonLink>
                            {interview.status === "scheduled" ? (
                              <>
                                <ActionButton action={setInterviewStatusAction.bind(null, interview.id, "completed")}>Mark completed</ActionButton>
                                <ActionButton action={setInterviewStatusAction.bind(null, interview.id, "no_show")} variant="ghost">
                                  No-show
                                </ActionButton>
                                {schedule ? (
                                  <ActionButton action={setInterviewStatusAction.bind(null, interview.id, "cancelled")} variant="ghost" confirm="Cancel this interview? The candidate will be notified.">
                                    Cancel
                                  </ActionButton>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        </div>
                        {interview.status === "scheduled" && schedule ? (
                          <div className="mt-3">
                            <RescheduleForm action={rescheduleInterviewAction.bind(null, interview.id)} />
                          </div>
                        ) : null}
                        {others.length ? (
                          <div className="mt-3 space-y-2 border-t border-line pt-3">
                            {others.map(({ fb, author }) => (
                              <div key={fb.id} className="text-sm">
                                <p className="font-medium text-ink">
                                  {author} · <span className="font-normal">{labelOf(RECOMMENDATIONS, fb.recommendation)}</span>
                                </p>
                                <p className="text-ink-2">
                                  Technical {fb.technical}/5 · Communication {fb.communication}/5 · Role fit {fb.roleFit}/5 · Experience {fb.experience}/5
                                </p>
                                {fb.strengths ? <p className="text-ink-2">+ {fb.strengths}</p> : null}
                                {fb.concerns ? <p className="text-ink-2">− {fb.concerns}</p> : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {canFeedback && interview.status !== "cancelled" ? (
                          <details className="mt-3 border-t border-line pt-3" open={!mine && interview.status === "completed"}>
                            <summary className="cursor-pointer text-sm font-medium text-accent">{mine ? "Edit your feedback" : "Add structured feedback"}</summary>
                            <div className="mt-3">
                              <FeedbackForm
                                action={submitFeedbackAction.bind(null, interview.id)}
                                d={mine ? { ...mine.fb, strengths: mine.fb.strengths ?? "", concerns: mine.fb.concerns ?? "", salaryNotes: mine.fb.salaryNotes ?? "", availabilityNotes: mine.fb.availabilityNotes ?? "" } : undefined}
                              />
                            </div>
                          </details>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-ink-2">No interviews yet.</p>
              )}
              {schedule && !["rejected", "withdrawn", "joined"].includes(app.stage) ? (
                <details className="rounded-lg border border-dashed border-line-strong p-4" open={!ivs.length}>
                  <summary className="cursor-pointer text-sm font-medium text-ink">Schedule an interview</summary>
                  <div className="mt-4">
                    <ScheduleForm
                      action={scheduleInterviewAction.bind(null, app.id)}
                      stages={INTERVIEW_STAGES.map((s) => ({ value: s, label: stageLabel(s) }))}
                      defaultStage={INTERVIEW_STAGES.find((s) => INTERVIEW_STAGES.indexOf(s) > INTERVIEW_STAGES.indexOf(app.stage as never)) ?? "interview_1"}
                      interviewers={members.map((m) => ({ value: m.user.id, label: `${m.user.name}${m.user.id === user.id ? " (you)" : ""}` }))}
                    />
                  </div>
                </details>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Bot className="h-4 w-4 text-accent" aria-hidden /> Interview AI assistant
                </span>
              }
              description="Summarises structured feedback: technical skills, communication, role fit, experience, salary and availability."
              action={feedbackRows.length && can(member.role, "interviews.feedback") ? <ActionButton action={generateSummaryAction.bind(null, app.id)}>{summary ? "Regenerate" : "Generate summary"}</ActionButton> : null}
            />
            <CardBody>
              {summary ? (
                <>
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-ink">{summary.fb.aiSummary}</pre>
                  <p className="mt-2 text-xs text-ink-3">{summary.fb.aiSummarySource === "claude" ? "Generated with Claude" : "Generated by the built-in summariser"}</p>
                </>
              ) : (
                <p className="text-sm text-ink-2">{feedbackRows.length ? "Generate a summary of the feedback so far." : "Summaries appear once interviewers submit structured feedback."}</p>
              )}
              {avg ? (
                <p className="mt-3 text-sm text-ink-2">
                  Averages — technical {avg.technical.toFixed(1)} · communication {avg.communication.toFixed(1)} · role fit {avg.roleFit.toFixed(1)} · experience {avg.experience.toFixed(1)}
                </p>
              ) : null}
            </CardBody>
          </Card>

          {!isInterviewer ? (
            <Card>
              <CardHeader title="History" />
              <CardBody>
                <ol className="space-y-3 border-l border-line pl-4">
                  {events.map(({ event, actor }) => (
                    <li key={event.id} className="text-sm">
                      <p className="text-ink">
                        {event.fromStage ? `${stageLabel(event.fromStage)} → ` : ""}
                        <span className="font-medium">{stageLabel(event.toStage)}</span>
                        {actor ? <span className="text-ink-2"> by {actor}</span> : null}
                      </p>
                      {event.note ? <p className="text-ink-2">{event.note}</p> : null}
                      <p className="text-xs text-ink-3">{formatDateTime(event.createdAt)}</p>
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Candidate" action={<VerificationLevelBadge level={score.level} />} />
            <CardBody className="space-y-4 text-sm">
              <p className="text-ink-2">{c.headline}</p>
              <div className="flex flex-wrap items-center gap-2">
                <AvailabilityBadge availability={c.availability} />
              </div>
              <CandidateVerificationBadges candidate={c} />
              <ScreeningBadges candidate={c} />
              <DescriptionList
                columns={2}
                items={[
                  { label: "Experience", value: formatYears(c.experienceYears) },
                  { label: "Education", value: labelOf(EDUCATION_LEVELS, highestEducation(bundle.educations)) },
                  { label: "Location", value: c.currentLocation ?? "—" },
                  { label: "Can join in", value: days == null ? "—" : days === 0 ? "Immediately" : `${days} days` },
                  { label: "Profile completion", value: `${score.completion}%` },
                  { label: "Assessments", value: [c.level1Score != null ? `L1 ${c.level1Score}%` : null, c.level2Score != null ? `L2 ${c.level2Score}%` : null].filter(Boolean).join(" · ") || "—" },
                ]}
              />
              <div className="flex flex-wrap gap-1.5">
                {c.skills.map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
              </div>
              <p className="rounded-md bg-subtle px-3 py-2 text-xs text-ink-2">
                Contact via platform only: <span className="font-mono text-ink">{c.maskedEmail}</span>
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="CTC match" />
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: "Current CTC", value: formatLpa(c.currentCtc) },
                  { label: "Expected CTC", value: formatLpa(c.expectedCtc) },
                  { label: "Your range", value: formatCtcRange(job.minCtc, job.maxCtc) },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Why they match" />
            <CardBody>
              <MatchReasons reasons={match.reasons} failedMandatory={match.failedMandatory} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Application materials" />
            <CardBody className="space-y-2 text-sm">
              {resume[0] ? (
                <a href={`/api/resumes/${resume[0].id}/pdf`} className="flex items-center gap-2 text-accent hover:underline">
                  <FileText className="h-4 w-4" aria-hidden /> {resume[0].title} (PDF)
                </a>
              ) : null}
              {app.uploadedResumeDocId ? (
                <a href={`/api/files/${app.uploadedResumeDocId}`} target="_blank" className="flex items-center gap-2 text-accent hover:underline">
                  <FileText className="h-4 w-4" aria-hidden /> Uploaded resume
                </a>
              ) : null}
              {sharedDocs.map((d) => (
                <a key={d.id} href={`/api/files/${d.id}`} target="_blank" className="flex items-center gap-2 text-accent hover:underline">
                  <FileText className="h-4 w-4" aria-hidden /> {labelOf(CANDIDATE_DOC_TYPES, d.docType)} (verified, shared by candidate)
                </a>
              ))}
              {!resume[0] && !app.uploadedResumeDocId && !sharedDocs.length ? <p className="text-ink-2">No documents shared. Verification badges confirm what the platform checked.</p> : null}
              {app.coverNote ? <p className="whitespace-pre-line border-t border-line pt-2 text-ink-2">{app.coverNote}</p> : null}
            </CardBody>
          </Card>
          {p ? (
            <Card>
              <CardHeader title="Placement" action={<PlacementStatusBadge status={p.status} />} />
              <CardBody>
                <DescriptionList
                  columns={1}
                  items={[
                    { label: "Selected on", value: formatDate(p.selectedAt) },
                    { label: "Offered CTC", value: formatLpa(p.offeredCtc) },
                    { label: "Joining date", value: formatDate(p.joiningDate ?? p.expectedJoiningDate) },
                    { label: `${p.guaranteeDays}-day milestone`, value: formatDate(p.milestoneDate) },
                  ]}
                />
                {can(member.role, "billing.manage") ? (
                  <Link href="/company/billing" className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
                    Manage in billing →
                  </Link>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
