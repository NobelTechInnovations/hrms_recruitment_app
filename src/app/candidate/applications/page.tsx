import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { applications, companies, jobs } from "@/db/schema";
import { CompanyVerificationBadge, StageBadge } from "@/components/badges";
import { ButtonLink, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { APPLICATION_SOURCES, labelOf } from "@/lib/constants";
import { formatDate, timeAgo } from "@/lib/format";
import { stageIndex } from "@/lib/pipeline";
import { requireCandidate } from "@/server/auth";

export const metadata: Metadata = { title: "Applications" };

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const { candidate } = await requireCandidate();
  const { stage } = await searchParams;
  let rows = await db
    .select({ app: applications, job: jobs, company: companies })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(companies, eq(companies.id, applications.companyId))
    .where(eq(applications.candidateId, candidate.id))
    .orderBy(desc(applications.updatedAt));
  if (stage) rows = rows.filter((r) => stageIndex(r.app.stage) >= stageIndex(stage));
  return (
    <div className="space-y-6">
      <PageHeader title="Applications" description="Track every application from Applied to Joined." actions={stage ? <ButtonLink href="/candidate/applications" size="sm" variant="secondary">Show all</ButtonLink> : null} />
      {rows.length ? (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Job</Th>
                <Th>Company</Th>
                <Th>Applied</Th>
                <Th>Source</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ app, job, company }) => (
                <tr key={app.id}>
                  <Td>
                    <Link href={`/candidate/applications/${app.id}`} className="font-medium hover:text-accent">
                      {job.title}
                    </Link>
                    <p className="text-xs text-ink-3">Updated {timeAgo(app.updatedAt)}</p>
                  </Td>
                  <Td>
                    <p>{company.name}</p>
                    <CompanyVerificationBadge status={company.verificationStatus} />
                  </Td>
                  <Td>{formatDate(app.createdAt)}</Td>
                  <Td className="text-ink-2">{labelOf(APPLICATION_SOURCES, app.source)}</Td>
                  <Td>
                    <StageBadge stage={app.stage} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : (
        <EmptyState title="No applications yet" action={<ButtonLink href="/jobs" size="sm">Browse jobs</ButtonLink>} />
      )}
    </div>
  );
}
