import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { MatchScore, PlacementStatusBadge, StageBadge } from "@/components/badges";
import { Alert, BarList, ButtonLink, Card, CardBody, CardHeader, EmptyState, StatTile } from "@/components/ui";
import { formatDate, formatDateTime, timeAgo } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/server/auth";
import { companyApplications, companyCrmStats, companyInterviewList, companyPlacements } from "@/server/company-queries";

export const metadata: Metadata = { title: "Hiring CRM" };

export default async function CompanyDashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { user, member, company } = await requireCompany();
  const { denied } = await searchParams;
  const isInterviewer = member.role === "interviewer";
  const [stats, upcoming, recent, placements, jobRows] = await Promise.all([
    companyCrmStats(company.id),
    companyInterviewList(company.id, { upcomingOnly: true, interviewerUserId: isInterviewer ? user.id : undefined }),
    isInterviewer ? Promise.resolve([]) : companyApplications(company.id),
    can(member.role, "billing.manage") ? companyPlacements(company.id) : Promise.resolve([]),
    db
      .select({ job: jobs, n: sql<number>`(select count(*) from applications a where a.job_id = ${sql.raw('"jobs"."id"')})` })
      .from(jobs)
      .where(and(eq(jobs.companyId, company.id), eq(jobs.status, "active")))
      .orderBy(desc(jobs.publishedAt)),
  ]);
  const tracking = placements.filter((p) => ["pending_joining", "in_guarantee", "fee_due"].includes(p.placement.status));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Hiring CRM</h1>
          <p className="mt-1 text-sm text-ink-2">Manage your entire recruitment pipeline from one place.</p>
        </div>
        {can(member.role, "jobs.manage") ? <ButtonLink href="/company/jobs/new">Post a job</ButtonLink> : null}
      </div>
      {denied ? <Alert tone="warn" title="You don't have access to that page with your role." /> : null}
      {company.verificationStatus !== "verified" ? (
        <Alert tone="warn" title={company.verificationStatus === "pending" ? "Verification in progress — your profile shows UNVERIFIED COMPANY until approved" : "Your company shows as UNVERIFIED COMPANY"}>
          {company.verificationStatus === "pending"
            ? "Our team is reviewing your documents. Jobs you publish meanwhile are reviewed before going live, and candidate search unlocks after verification."
            : company.verificationStatus === "rejected"
              ? `Verification was not approved${company.verificationNote ? `: ${company.verificationNote}` : ""}. Update your details and resubmit.`
              : "Complete your company profile and upload registration documents to get verified. Verified companies publish instantly and can search candidates."}{" "}
          {can(member.role, "company.edit") ? (
            <Link href="/company/profile" className="font-medium underline">
              Go to verification
            </Link>
          ) : null}
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Open jobs" value={stats.openJobs} href="/company/jobs" />
        <StatTile label="Applications" value={stats.applications} href="/company/applications" />
        <StatTile label="Shortlisted" value={stats.shortlisted} href="/company/applications?stage=shortlisted" />
        <StatTile label="Interviews" value={stats.interviews} hint="Upcoming" href="/company/interviews" />
        <StatTile label="Offers" value={stats.offers} href="/company/applications?stage=offer" />
        <StatTile label="Joined" value={stats.joined} href="/company/applications?stage=joined" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader title="Hiring funnel" description="Applications that reached each stage, across all jobs" />
          <CardBody>
            {stats.applications ? <BarList ariaLabel="Hiring funnel by stage" rows={stats.funnel.map((f) => ({ label: f.label, value: f.value, hint: stats.applications ? `${Math.round((f.value / stats.applications) * 100)}% of applications` : undefined, href: `/company/applications?stage=${f.stage}` }))} /> : <EmptyState title="No applications yet" description="Post a job to start receiving matched candidates." />}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Upcoming interviews" action={<Link href="/company/interviews" className="text-sm font-medium text-accent hover:underline">All</Link>} />
          <CardBody>
            {upcoming.length ? (
              <ul className="space-y-3">
                {upcoming.slice(0, 6).map(({ interview, candidate, job, application }) => (
                  <li key={interview.id} className="text-sm">
                    <Link href={`/company/applications/${application.id}`} className="font-medium text-ink hover:text-accent">
                      {candidate.fullName}
                    </Link>
                    <p className="text-ink-2">
                      {interview.title} · {job.title}
                    </p>
                    <p className="text-xs text-ink-3">{formatDateTime(interview.scheduledAt)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-2">No interviews scheduled.</p>
            )}
          </CardBody>
        </Card>
      </div>

      {!isInterviewer ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Recent applications" action={<Link href="/company/applications" className="text-sm font-medium text-accent hover:underline">Pipeline</Link>} />
            <CardBody>
              {recent.length ? (
                <ul className="divide-y divide-line">
                  {recent.slice(0, 6).map(({ app, job, candidate }) => (
                    <li key={app.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <Link href={`/company/applications/${app.id}`} className="font-medium text-ink hover:text-accent">
                          {candidate.fullName}
                        </Link>
                        <p className="truncate text-xs text-ink-2">
                          {job.title} · {timeAgo(app.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {app.matchScore != null ? <MatchScore score={app.matchScore} /> : null}
                        <StageBadge stage={app.stage} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-2">No applications yet.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Open jobs" action={<Link href="/company/jobs" className="text-sm font-medium text-accent hover:underline">All jobs</Link>} />
            <CardBody>
              {jobRows.length ? (
                <ul className="divide-y divide-line">
                  {jobRows.slice(0, 6).map(({ job, n }) => (
                    <li key={job.id} className="flex items-center justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0">
                      <Link href={`/company/jobs/${job.id}`} className="font-medium text-ink hover:text-accent">
                        {job.title}
                      </Link>
                      <span className="text-ink-2">
                        {Number(n)} applicants · <Link className="text-accent hover:underline" href={`/company/jobs/${job.id}/matches`}>matches</Link>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-2">No open jobs.</p>
              )}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tracking.length ? (
        <Card>
          <CardHeader title="60-day placement tracking" action={<Link href="/company/billing" className="text-sm font-medium text-accent hover:underline">Billing & placements</Link>} />
          <CardBody>
            <ul className="divide-y divide-line">
              {tracking.map(({ placement, candidate, job }) => (
                <li key={placement.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0">
                  <span>
                    <span className="font-medium text-ink">{candidate.fullName}</span> <span className="text-ink-2">· {job.title}</span>
                  </span>
                  <span className="flex items-center gap-2 text-ink-2">
                    {placement.joiningDate ? `Joined ${formatDate(placement.joiningDate)} · milestone ${formatDate(placement.milestoneDate)}` : `Selected ${formatDate(placement.selectedAt)}`}
                    <PlacementStatusBadge status={placement.status} />
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
