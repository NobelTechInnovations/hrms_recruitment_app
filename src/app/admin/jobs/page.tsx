import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, jobReports, jobs, users } from "@/db/schema";
import { moderateJobAction, resolveReportAction } from "@/actions/admin";
import { CompanyVerificationBadge, JobStatusBadge } from "@/components/badges";
import { DecisionForms } from "@/components/decision";
import { ActionButton } from "@/components/forms";
import { Badge, Card, EmptyState, PageHeader, Table, Tabs, Td, Th } from "@/components/ui";
import { formatCtcRange, formatDate, timeAgo } from "@/lib/format";
import { adminCounts } from "@/server/admin-queries";

export const metadata: Metadata = { title: "Job moderation" };

export default async function AdminJobsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "pending" } = await searchParams;
  const counts = await adminCounts();
  const all = await db.select({ job: jobs, company: companies }).from(jobs).innerJoin(companies, eq(companies.id, jobs.companyId)).orderBy(desc(jobs.createdAt));
  const reports = tab === "reports" ? await db.select({ report: jobReports, job: jobs, reporter: users.name }).from(jobReports).innerJoin(jobs, eq(jobs.id, jobReports.jobId)).innerJoin(users, eq(users.id, jobReports.reporterUserId)).orderBy(desc(jobReports.createdAt)) : [];
  const rows = tab === "pending" ? all.filter((r) => r.job.status === "pending_approval") : all.filter((r) => r.job.status !== "draft");
  return (
    <div className="space-y-4">
      <PageHeader title="Jobs" description="Moderation, approval, suspension and reports." />
      <Tabs
        items={[
          { href: "/admin/jobs", label: "Awaiting approval", active: tab === "pending", count: counts.pendingJobs },
          { href: "/admin/jobs?tab=all", label: "All jobs", active: tab === "all" },
          { href: "/admin/jobs?tab=reports", label: "Reports", active: tab === "reports", count: counts.openReports },
        ]}
      />
      {tab === "reports" ? (
        reports.length ? (
          <Card>
            <Table>
              <thead>
                <tr>
                  <Th>Job</Th>
                  <Th>Reason</Th>
                  <Th>Reported by</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {reports.map(({ report, job, reporter }) => (
                  <tr key={report.id}>
                    <Td>
                      <Link href={`/jobs/${job.id}`} className="font-medium hover:text-accent">{job.title}</Link>
                      <div className="mt-1"><JobStatusBadge status={job.status} /></div>
                    </Td>
                    <Td>
                      {report.reason}
                      {report.details ? <p className="text-xs text-ink-2">{report.details}</p> : null}
                    </Td>
                    <Td>
                      {reporter}
                      <p className="text-xs text-ink-3">{timeAgo(report.createdAt)}</p>
                    </Td>
                    <Td><Badge tone={report.status === "open" ? "warn" : "neutral"}>{report.status}</Badge></Td>
                    <Td className="space-y-2 text-right">
                      {report.status === "open" ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          {job.status === "active" ? <DecisionForms reject={moderateJobAction.bind(null, job.id, "suspend")} rejectLabel="Suspend job" /> : null}
                          <ActionButton action={resolveReportAction.bind(null, report.id, "resolved")}>Resolve</ActionButton>
                          <ActionButton action={resolveReportAction.bind(null, report.id, "dismissed")} variant="ghost">Dismiss</ActionButton>
                        </div>
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ) : (
          <EmptyState title="No reports" />
        )
      ) : rows.length ? (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Job</Th>
                <Th>Company</Th>
                <Th>CTC</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th>Moderation</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ job, company }) => (
                <tr key={job.id}>
                  <Td>
                    <Link href={`/jobs/${job.id}`} className="font-medium hover:text-accent">{job.title}</Link>
                    <p className="text-xs text-ink-3">{job.location} · {job.requiredSkills.slice(0, 3).join(", ")}</p>
                  </Td>
                  <Td>
                    <p>{company.name}</p>
                    <CompanyVerificationBadge status={company.verificationStatus} />
                  </Td>
                  <Td>{formatCtcRange(job.minCtc, job.maxCtc)}</Td>
                  <Td>
                    <JobStatusBadge status={job.status} />
                    {job.moderationNote ? <p className="mt-1 text-xs text-ink-2">{job.moderationNote}</p> : null}
                  </Td>
                  <Td>{formatDate(job.createdAt)}</Td>
                  <Td>
                    {job.status === "pending_approval" ? (
                      <DecisionForms approve={moderateJobAction.bind(null, job.id, "approve")} reject={moderateJobAction.bind(null, job.id, "reject")} />
                    ) : job.status === "active" ? (
                      <DecisionForms reject={moderateJobAction.bind(null, job.id, "suspend")} rejectLabel="Suspend" />
                    ) : job.status === "suspended" ? (
                      <ActionButton action={moderateJobAction.bind(null, job.id, "reinstate")}>Reinstate</ActionButton>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : (
        <EmptyState title={tab === "pending" ? "No jobs awaiting approval" : "No jobs"} />
      )}
    </div>
  );
}
