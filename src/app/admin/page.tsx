import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { runScheduledJobsAction } from "@/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { BarList, Card, CardBody, CardHeader, PageHeader, StatTile } from "@/components/ui";
import { formatINR, timeAgo } from "@/lib/format";
import { adminCounts, adminOverview } from "@/server/admin-queries";

export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminOverviewPage() {
  const [o, c, audits] = await Promise.all([
    adminOverview(),
    adminCounts(),
    db.select({ log: auditLogs, actor: users.name }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorUserId)).orderBy(desc(auditLogs.createdAt)).limit(12),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform overview"
        actions={
          <ActionForm action={runScheduledJobsAction} className="flex flex-col items-end">
            <SubmitButton variant="secondary" pendingText="Running…">Run scheduled jobs now</SubmitButton>
          </ActionForm>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        <StatTile label="Candidates" value={o.candidates} href="/admin/users?role=candidate" />
        <StatTile label="Companies" value={o.companies} hint={`${o.verifiedCompanies} verified`} href="/admin/users?role=company" />
        <StatTile label="Active jobs" value={o.activeJobs} href="/admin/jobs?tab=all" />
        <StatTile label="Applications" value={o.applications} href="/admin/recruitment" />
        <StatTile label="Upcoming interviews" value={o.upcomingInterviews} href="/admin/recruitment" />
        <StatTile label="In 60-day period" value={o.inGuarantee} href="/admin/finance?tab=tracking" />
        <StatTile label="Outstanding" value={formatINR(o.outstanding)} href="/admin/finance?tab=pending" />
        <StatTile label="Collected" value={formatINR(o.collected)} href="/admin/finance" />
        <StatTile label="Pending verification" value={c.verification} hint={`${c.pendingCompanies} companies · ${c.pendingDocs} documents`} href="/admin/verification" />
        <StatTile label="Flagged messages" value={c.flagged} href="/admin/communication" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Platform hiring funnel" description="Applications that reached each stage" />
          <CardBody>
            <BarList ariaLabel="Platform hiring funnel" rows={o.funnel} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Work queues" />
          <CardBody>
            <ul className="divide-y divide-line text-sm">
              {[
                ["Company verifications", c.pendingCompanies, "/admin/verification"],
                ["Candidate documents", c.pendingDocs, "/admin/verification?tab=documents"],
                ["Jobs awaiting approval", c.pendingJobs, "/admin/jobs"],
                ["Open job reports", c.openReports, "/admin/jobs?tab=reports"],
                ["Messages to moderate", c.flagged, "/admin/communication"],
              ].map(([label, count, href]) => (
                <li key={label as string} className="flex items-center justify-between py-2.5">
                  <Link href={href as string} className="text-ink hover:text-accent">
                    {label}
                  </Link>
                  <span className={Number(count) ? "font-semibold text-ink" : "text-ink-3"}>{count}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader title="Audit log" description="Recent administrative actions" />
        <CardBody>
          {audits.length ? (
            <ul className="divide-y divide-line text-sm">
              {audits.map(({ log, actor }) => (
                <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-mono text-xs text-ink">{log.action}</span> <span className="text-ink-2">on {log.entityType}{actor ? ` by ${actor}` : ""}</span>
                  </span>
                  <span className="text-xs text-ink-3">{timeAgo(log.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">No admin actions yet.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
