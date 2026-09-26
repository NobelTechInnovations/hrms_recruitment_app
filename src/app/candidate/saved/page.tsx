import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, jobs, savedJobs } from "@/db/schema";
import { toggleSaveJobAction } from "@/actions/candidate";
import { ActionButton } from "@/components/forms";
import { JobCard } from "@/components/job-card";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { requireCandidate } from "@/server/auth";

export const metadata: Metadata = { title: "Saved jobs" };

export default async function SavedJobsPage() {
  const { candidate } = await requireCandidate();
  const rows = await db
    .select({ job: jobs, company: companies })
    .from(savedJobs)
    .innerJoin(jobs, eq(jobs.id, savedJobs.jobId))
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(eq(savedJobs.candidateId, candidate.id))
    .orderBy(desc(savedJobs.createdAt));
  return (
    <div className="space-y-6">
      <PageHeader title="Saved jobs" />
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((r) => (
            <JobCard key={r.job.id} {...r} footer={<ActionButton action={toggleSaveJobAction.bind(null, r.job.id)} variant="ghost">Remove</ActionButton>} />
          ))}
        </div>
      ) : (
        <EmptyState title="No saved jobs" description="Save jobs while browsing to compare them later." action={<ButtonLink href="/jobs" size="sm">Browse jobs</ButtonLink>} />
      )}
    </div>
  );
}
