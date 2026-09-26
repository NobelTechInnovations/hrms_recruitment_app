import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { AvailabilityBadge, MatchScore, StageBadge } from "@/components/badges";
import { Card, EmptyState, PageHeader, Select, Table, Td, Th } from "@/components/ui";
import { ALL_STAGES, APPLICATION_SOURCES, labelOf } from "@/lib/constants";
import { formatDate, formatLpa, formatYears, timeAgo } from "@/lib/format";
import { requireCompany } from "@/server/auth";
import { companyApplications } from "@/server/company-queries";

export const metadata: Metadata = { title: "Pipeline" };

export default async function CompanyApplicationsPage({ searchParams }: { searchParams: Promise<{ job?: string; stage?: string; sort?: string }> }) {
  const { company } = await requireCompany("pipeline.view");
  const { job, stage, sort } = await searchParams;
  const [rows, jobOptions] = await Promise.all([
    companyApplications(company.id, { jobId: job || undefined, stage: stage || undefined }),
    db.select({ id: jobs.id, title: jobs.title }).from(jobs).where(and(eq(jobs.companyId, company.id))),
  ]);
  const sorted = sort === "match" ? [...rows].sort((a, b) => (b.app.matchScore ?? 0) - (a.app.matchScore ?? 0)) : rows;
  return (
    <div className="space-y-6">
      <PageHeader title="Pipeline" description="Track every application across jobs. Filter, sort by match and open a candidate to act." />
      <Card className="p-4">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <div className="min-w-48 flex-1">
            <label htmlFor="job" className="mb-1 block text-sm font-medium text-ink">Job</label>
            <Select id="job" name="job" defaultValue={job ?? ""} options={jobOptions.map((j) => ({ value: j.id, label: j.title }))} placeholder="All jobs" />
          </div>
          <div className="min-w-40">
            <label htmlFor="stage" className="mb-1 block text-sm font-medium text-ink">Stage</label>
            <Select id="stage" name="stage" defaultValue={stage ?? ""} options={ALL_STAGES} placeholder="All stages" />
          </div>
          <div className="min-w-40">
            <label htmlFor="sort" className="mb-1 block text-sm font-medium text-ink">Sort</label>
            <Select id="sort" name="sort" defaultValue={sort ?? ""} options={[{ value: "match", label: "Best match" }]} placeholder="Most recent" />
          </div>
          <button className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent-hover dark:text-black">Apply</button>
          {job || stage || sort ? <Link href="/company/applications" className="px-2 py-2 text-sm text-ink-2 hover:text-ink">Reset</Link> : null}
        </form>
      </Card>
      {sorted.length ? (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Candidate</Th>
                <Th>Job</Th>
                <Th>Match</Th>
                <Th>Experience / CTC</Th>
                <Th>Stage</Th>
                <Th>Applied</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ app, job: j, candidate }) => (
                <tr key={app.id}>
                  <Td>
                    <Link href={`/company/applications/${app.id}`} className="font-medium hover:text-accent">
                      {candidate.fullName}
                    </Link>
                    <div className="mt-0.5">
                      <AvailabilityBadge availability={candidate.availability} />
                    </div>
                  </Td>
                  <Td>
                    <p>{j.title}</p>
                    <p className="text-xs text-ink-3">{labelOf(APPLICATION_SOURCES, app.source)}</p>
                  </Td>
                  <Td>{app.matchScore != null ? <MatchScore score={app.matchScore} /> : "—"}</Td>
                  <Td>
                    {formatYears(candidate.experienceYears)}
                    <p className="text-xs text-ink-3">expects {formatLpa(candidate.expectedCtc)}</p>
                  </Td>
                  <Td>
                    <StageBadge stage={app.stage} />
                    <p className="mt-0.5 text-xs text-ink-3">updated {timeAgo(app.updatedAt)}</p>
                  </Td>
                  <Td>{formatDate(app.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : (
        <EmptyState title="No applications match these filters" />
      )}
    </div>
  );
}
