import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { candidates, findJobsRequests, recommendations } from "@/db/schema";
import { recommendJobAction } from "@/actions/admin";
import { CompanyVerificationBadge, MatchReasons, MatchScore } from "@/components/badges";
import { Badge, Card, CardBody, CardHeader, DescriptionList, EmptyState, PageHeader } from "@/components/ui";
import { formatCtcRange, formatLpa } from "@/lib/format";
import { matchesForCandidate } from "@/server/matching-service";
import { InviteForm } from "@/app/company/(workspace)/jobs/[id]/matches/invite-form";

export const metadata: Metadata = { title: "Find matches" };

export default async function DeskCandidatePage({ params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params;
  const [candidate] = await db.select().from(candidates).where(eq(candidates.id, candidateId)).limit(1);
  if (!candidate) notFound();
  const [req] = await db.select().from(findJobsRequests).where(eq(findJobsRequests.candidateId, candidateId)).limit(1);
  const effective = req
    ? { ...candidate, expectedCtc: req.expectedCtc ?? candidate.expectedCtc, preferredLocations: req.preferredLocations.length ? req.preferredLocations : candidate.preferredLocations, workModePreference: req.workMode, industry: req.preferredIndustry ?? candidate.industry, noticePeriodDays: req.joiningAvailabilityDays ?? candidate.noticePeriodDays }
    : candidate;
  const [matches, recs] = await Promise.all([matchesForCandidate(effective, { minScore: 0, eligibleOnly: false }), db.select().from(recommendations).where(eq(recommendations.candidateId, candidateId))]);
  const recMap = new Map(recs.map((r) => [r.jobId, r]));
  return (
    <div className="space-y-6">
      <PageHeader title={`Find jobs for ${candidate.fullName}`} back={{ href: "/admin/recruitment", label: "Desk" }} />
      {req ? (
        <Card>
          <CardHeader title="Candidate preferences" />
          <CardBody>
            <DescriptionList
              columns={3}
              items={[
                { label: "Desired role", value: req.desiredRole },
                { label: "Locations", value: req.preferredLocations.join(", ") || "Any" },
                { label: "Expected CTC", value: formatLpa(req.expectedCtc) },
                { label: "Work mode", value: req.workMode },
                { label: "Joining", value: req.joiningAvailabilityDays != null ? `${req.joiningAvailabilityDays} days` : "—" },
                { label: "Consent", value: req.applyMode === "auto_apply" ? "Apply automatically" : "Ask before applying" },
              ]}
            />
          </CardBody>
        </Card>
      ) : null}
      {matches.length ? (
        <div className="space-y-3">
          {matches.map((m) => {
            const rec = recMap.get(m.job.id);
            return (
              <Card key={m.job.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/jobs/${m.job.id}`} className="font-semibold text-ink hover:text-accent">{m.job.title}</Link>
                    <p className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
                      {m.company.name} <CompanyVerificationBadge status={m.company.verificationStatus} /> · {m.job.location} · {formatCtcRange(m.job.minCtc, m.job.maxCtc)}
                    </p>
                  </div>
                  <MatchScore score={m.match.score} eligible={m.match.eligible} />
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-accent">Match explanation</summary>
                  <div className="mt-2"><MatchReasons reasons={m.match.reasons} failedMandatory={m.match.failedMandatory} /></div>
                </details>
                <div className="mt-3 border-t border-line pt-3">
                  {rec ? <Badge tone={rec.status === "applied" ? "good" : rec.status === "declined" ? "neutral" : "accent"}>Recommended · {rec.status}</Badge> : <InviteForm action={recommendJobAction.bind(null, candidate.id)} jobId={m.job.id} label="Recommend to candidate" placeholder="Note from the recruitment team" />}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No active jobs to match" />
      )}
    </div>
  );
}
