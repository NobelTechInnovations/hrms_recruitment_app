import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, recommendations } from "@/db/schema";
import { inviteCandidateAction } from "@/actions/company";
import { AvailabilityBadge, CandidateVerificationBadges, MatchReasons, MatchScore, ScreeningBadges } from "@/components/badges";
import { Alert, Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatLpa, formatYears } from "@/lib/format";
import { requireCompany } from "@/server/auth";
import { matchesForJob } from "@/server/matching-service";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Matched candidates" };

export default async function JobMatchesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ all?: string }> }) {
  const { id } = await params;
  const { all } = await searchParams;
  const { company } = await requireCompany("candidates.search");
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.companyId, company.id))).limit(1);
  if (!job) notFound();
  const showAll = all === "1";
  const matches = company.verificationStatus === "verified" ? await matchesForJob(job, { minScore: showAll ? 0 : 60, eligibleOnly: !showAll }) : [];
  const invited = new Set((await db.select({ candidateId: recommendations.candidateId }).from(recommendations).where(eq(recommendations.jobId, job.id))).map((r) => r.candidateId));
  return (
    <div className="space-y-6">
      <PageHeader
        title={`${matches.length} ${matches.length === 1 ? "Candidate Matches" : "Candidates Match"} Your Job`}
        description={<>For <Link href={`/company/jobs/${job.id}`} className="text-accent hover:underline">{job.title}</Link>. Only candidates who allow recommendations are shown; contact details stay private.</>}
        back={{ href: `/company/jobs/${job.id}`, label: "Back to job" }}
        actions={<ButtonLink href={showAll ? `/company/jobs/${job.id}/matches` : `/company/jobs/${job.id}/matches?all=1`} variant="secondary" size="sm">{showAll ? "Only eligible, strong matches" : "Include partial matches"}</ButtonLink>}
      />
      {company.verificationStatus !== "verified" ? <Alert tone="warn" title="Candidate matching unlocks after company verification." /> : null}
      {job.status !== "active" ? <Alert tone="info" title="Publish this job to invite candidates." /> : null}
      {matches.length ? (
        <div className="space-y-3">
          {matches.map(({ candidate, match }) => (
            <Card key={candidate.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/company/candidates/${candidate.id}?job=${job.id}`} className="text-base font-semibold text-ink hover:text-accent">
                    {candidate.fullName}
                  </Link>
                  <p className="text-sm text-ink-2">
                    {candidate.headline ?? candidate.currentDesignation} · {formatYears(candidate.experienceYears)} · {candidate.currentLocation ?? "—"} · expects {formatLpa(candidate.expectedCtc)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <AvailabilityBadge availability={candidate.availability} />
                    <ScreeningBadges candidate={candidate} />
                  </div>
                  <div className="mt-2">
                    <CandidateVerificationBadges candidate={candidate} compact />
                  </div>
                </div>
                <MatchScore score={match.score} eligible={match.eligible} />
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-accent">Why this candidate matches</summary>
                <div className="mt-2">
                  <MatchReasons reasons={match.reasons} failedMandatory={match.failedMandatory} />
                </div>
              </details>
              <div className="mt-3 border-t border-line pt-3">
                {invited.has(candidate.id) ? <Badge tone="good">Invited</Badge> : job.status === "active" ? <InviteForm action={inviteCandidateAction.bind(null, candidate.id)} jobId={job.id} /> : null}
              </div>
            </Card>
          ))}
        </div>
      ) : company.verificationStatus === "verified" ? (
        <EmptyState title="No matching candidates yet" description="Try including partial matches, or relax mandatory requirements." />
      ) : null}
    </div>
  );
}
