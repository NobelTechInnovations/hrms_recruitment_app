import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Eye, Pencil, Sparkles } from "lucide-react";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { setJobStatusAction } from "@/actions/company";
import { AvailabilityBadge, JobStatusBadge, MatchScore } from "@/components/badges";
import { ActionButton } from "@/components/forms";
import { JobMeta } from "@/components/job-card";
import { Alert, Badge, ButtonLink, Card, CardBody, CardHeader, PageHeader, StatTile } from "@/components/ui";
import { ALL_STAGES } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { describeMandatory } from "@/lib/matching";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/server/auth";
import { companyApplications } from "@/server/company-queries";

export const metadata: Metadata = { title: "Job" };

export default async function CompanyJobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  const { notice } = await searchParams;
  const { member, company } = await requireCompany("jobs.view");
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.companyId, company.id))).limit(1);
  if (!job) notFound();
  const apps = await companyApplications(company.id, { jobId: job.id });
  const manage = can(member.role, "jobs.manage");
  const byStage = ALL_STAGES.map((s) => ({ ...s, apps: apps.filter((a) => a.app.stage === s.value) })).filter((s) => s.apps.length || !["withdrawn"].includes(s.value));
  const mandatory = describeMandatory(job);
  return (
    <div className="space-y-6">
      <PageHeader
        title={job.title}
        back={{ href: "/company/jobs", label: "Jobs" }}
        description={<span className="flex flex-wrap items-center gap-2"><JobStatusBadge status={job.status} /> {job.department ? <span>{job.department}</span> : null}</span>}
        actions={
          <>
            <ButtonLink href={`/company/jobs/${job.id}/matches`} variant="secondary">
              <Sparkles className="h-4 w-4" aria-hidden /> Matched candidates
            </ButtonLink>
            {job.status === "active" ? (
              <ButtonLink href={`/jobs/${job.id}`} variant="ghost">
                <Eye className="h-4 w-4" aria-hidden /> Public view
              </ButtonLink>
            ) : null}
            {manage ? (
              <>
                <ButtonLink href={`/company/jobs/${job.id}/edit`} variant="secondary">
                  <Pencil className="h-4 w-4" aria-hidden /> Edit
                </ButtonLink>
                {["draft", "rejected"].includes(job.status) ? <ActionButton action={setJobStatusAction.bind(null, job.id, "publish")} variant="primary" size="md">Publish</ActionButton> : null}
                {job.status === "active" ? <ActionButton action={setJobStatusAction.bind(null, job.id, "pause")} size="md">Pause</ActionButton> : null}
                {["paused", "closed"].includes(job.status) ? <ActionButton action={setJobStatusAction.bind(null, job.id, "resume")} variant="primary" size="md">Re-open</ActionButton> : null}
                {["active", "paused"].includes(job.status) ? <ActionButton action={setJobStatusAction.bind(null, job.id, "close")} variant="danger" size="md" confirm="Close this job? It will stop accepting applications.">Close</ActionButton> : null}
              </>
            ) : null}
          </>
        }
      />
      {notice ? <Alert tone={notice.startsWith("Saved as a draft —") ? "warn" : "good"} title={notice} /> : null}
      {job.status === "pending_approval" ? <Alert tone="info" title="Awaiting moderation">Jobs from unverified companies are reviewed before going live. Get verified to publish instantly.</Alert> : null}
      {job.status === "rejected" || job.status === "suspended" ? <Alert tone="bad" title={job.status === "rejected" ? "Rejected by moderation" : "Suspended by moderation"}>{job.moderationNote ?? "Contact support for details."}</Alert> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Applicants" value={apps.length} />
        <StatTile label="In interviews" value={apps.filter((a) => ["interview_1", "interview_2", "hr_interview"].includes(a.app.stage)).length} />
        <StatTile label="Offers / joined" value={apps.filter((a) => ["offer", "joined"].includes(a.app.stage)).length} hint={`${job.vacancies} ${job.vacancies === 1 ? "vacancy" : "vacancies"}`} />
        <StatTile label="Views" value={job.viewCount} />
      </div>

      <Card>
        <CardHeader title="Hiring pipeline" description="Click a candidate to review, move stages, schedule interviews and give feedback." />
        <div className="overflow-x-auto p-4">
          <div className="flex min-w-max gap-3">
            {byStage.map((col) => (
              <div key={col.value} className="w-60 shrink-0 rounded-lg bg-subtle p-2.5">
                <p className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-ink-2">
                  {col.label}
                  <span className="rounded-full bg-surface px-1.5 text-ink-3">{col.apps.length}</span>
                </p>
                <ul className="space-y-2">
                  {col.apps.map(({ app, candidate }) => (
                    <li key={app.id}>
                      <Link href={`/company/applications/${app.id}`} className="block rounded-md border border-line bg-surface p-2.5 text-sm hover:border-line-strong">
                        <p className="font-medium text-ink">{candidate.fullName}</p>
                        <p className="truncate text-xs text-ink-2">{candidate.headline ?? candidate.currentDesignation ?? "—"}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {app.matchScore != null ? <MatchScore score={app.matchScore} /> : null}
                          {candidate.level2QualifiedAt ? <Badge tone="purple">L2 ✓</Badge> : candidate.level1QualifiedAt ? <Badge tone="accent">L1 ✓</Badge> : null}
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <AvailabilityBadge availability={candidate.availability} />
                        </div>
                        <p className="mt-1 text-[11px] text-ink-3">Applied {timeAgo(app.createdAt)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Job details" />
        <CardBody className="space-y-3 text-sm">
          <JobMeta job={job} />
          <div className="flex flex-wrap gap-1.5">
            {job.requiredSkills.map((s) => (
              <Badge key={s} tone="accent">{s}</Badge>
            ))}
            {job.preferredSkills.map((s) => (
              <Badge key={s}>{s} (preferred)</Badge>
            ))}
          </div>
          {mandatory.length ? (
            <p className="text-ink-2">
              <span className="font-medium text-ink">Mandatory:</span> {mandatory.join(" · ")}
            </p>
          ) : null}
          <p className="whitespace-pre-line text-ink-2">{job.description}</p>
        </CardBody>
      </Card>
    </div>
  );
}
