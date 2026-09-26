import type { Metadata } from "next";
import { MatchReasons } from "@/components/badges";
import { JobCard } from "@/components/job-card";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { requireCandidate } from "@/server/auth";
import { matchesForCandidate } from "@/server/matching-service";

export const metadata: Metadata = { title: "Jobs for you" };

export default async function MatchesPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { candidate } = await requireCandidate();
  const { all } = await searchParams;
  const showAll = all === "1";
  const matches = await matchesForCandidate(candidate, { minScore: showAll ? 0 : 60, eligibleOnly: !showAll });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs for you"
        description={`${matches.length} ${matches.length === 1 ? "job matches" : "jobs match"} your profile. Each match explains itself — skills, experience, education, location, CTC and notice period.`}
        actions={
          <ButtonLink href={showAll ? "/candidate/matches" : "/candidate/matches?all=1"} variant="secondary" size="sm">
            {showAll ? "Show strong matches only" : "Include weaker matches"}
          </ButtonLink>
        }
      />
      {matches.length ? (
        <div className="space-y-3">
          {matches.map((m) => (
            <div key={m.job.id}>
              <JobCard job={m.job} company={m.company} match={m.match} />
              <details className="-mt-2 rounded-b-xl border border-t-0 border-line bg-surface px-5 pb-4 pt-5">
                <summary className="cursor-pointer text-sm font-medium text-accent">Why this matches</summary>
                <div className="mt-3">
                  <MatchReasons reasons={m.match.reasons} failedMandatory={m.match.failedMandatory} />
                </div>
              </details>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No matches yet" description="Add skills, preferred locations and expected CTC to your profile to get matched." action={<ButtonLink href="/candidate/profile" size="sm">Update profile</ButtonLink>} />
      )}
    </div>
  );
}
