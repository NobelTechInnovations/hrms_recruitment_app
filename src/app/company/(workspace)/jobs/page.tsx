import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { JobStatusBadge } from "@/components/badges";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { formatCtcRange, formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getPlan } from "@/lib/plans";
import { requireCompany } from "@/server/auth";

export const metadata: Metadata = { title: "Jobs" };

export default async function CompanyJobsPage() {
  const { member, company } = await requireCompany("jobs.view");
  const rows = await db
    .select({
      job: jobs,
      applicants: sql<number>`(select count(*) from applications a where a.job_id = ${sql.raw('"jobs"."id"')})`,
      active: sql<number>`(select count(*) from applications a where a.job_id = ${sql.raw('"jobs"."id"')} and a.stage not in ('rejected','withdrawn','joined'))`,
    })
    .from(jobs)
    .where(eq(jobs.companyId, company.id))
    .orderBy(desc(jobs.createdAt));
  const plan = getPlan(company.planCode);
  const activeCount = rows.filter((r) => r.job.status === "active").length;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        description={`${activeCount} active${plan.activeJobLimit ? ` of ${plan.activeJobLimit} allowed on the ${plan.name} plan` : ""}`}
        actions={can(member.role, "jobs.manage") ? <ButtonLink href="/company/jobs/new">Post a job</ButtonLink> : null}
      />
      {rows.length ? (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Job</Th>
                <Th>Status</Th>
                <Th>CTC</Th>
                <Th>Applicants</Th>
                <Th>Views</Th>
                <Th>Posted</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ job, applicants, active }) => (
                <tr key={job.id}>
                  <Td>
                    <Link href={`/company/jobs/${job.id}`} className="font-medium hover:text-accent">
                      {job.title}
                    </Link>
                    <p className="text-xs text-ink-3">
                      {job.location} · {job.vacancies} {job.vacancies === 1 ? "opening" : "openings"}
                    </p>
                    {job.priorityUntil && job.priorityUntil > new Date() ? <Badge tone="accent" className="mt-1">Priority</Badge> : null}
                  </Td>
                  <Td>
                    <JobStatusBadge status={job.status} />
                  </Td>
                  <Td>{formatCtcRange(job.minCtc, job.maxCtc)}</Td>
                  <Td>
                    {Number(applicants)} <span className="text-ink-3">({Number(active)} in progress)</span>
                  </Td>
                  <Td>{job.viewCount}</Td>
                  <Td>{formatDate(job.publishedAt ?? job.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : (
        <EmptyState title="No jobs yet" description="Create detailed job postings with mandatory requirements so the platform can match relevant candidates automatically." action={can(member.role, "jobs.manage") ? <ButtonLink href="/company/jobs/new" size="sm">Post your first job</ButtonLink> : null} />
      )}
    </div>
  );
}
