import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, findJobsRequests, jobs, recommendations } from "@/db/schema";
import { respondRecommendationAction, setFindJobsStatusAction } from "@/actions/candidate";
import { CompanyVerificationBadge, MatchReasons, MatchScore } from "@/components/badges";
import { ActionButton } from "@/components/forms";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { formatCtcRange, formatDateTime, timeAgo } from "@/lib/format";
import { requireCandidate } from "@/server/auth";
import { FindJobsForm } from "./find-jobs-form";

export const metadata: Metadata = { title: "Find Jobs For Me" };

const SOURCE_LABEL = { auto_match: "Matched for you", recruitment_team: "Recommended by our recruiters", company_invite: "Invitation from company" } as const;

export default async function FindJobsPage() {
  const { candidate } = await requireCandidate();
  const [req] = await db.select().from(findJobsRequests).where(eq(findJobsRequests.candidateId, candidate.id)).limit(1);
  const recs = await db
    .select({ rec: recommendations, job: jobs, company: companies })
    .from(recommendations)
    .innerJoin(jobs, eq(jobs.id, recommendations.jobId))
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(eq(recommendations.candidateId, candidate.id))
    .orderBy(desc(recommendations.createdAt));
  const pending = recs.filter((r) => r.rec.status === "pending");
  const handled = recs.filter((r) => r.rec.status !== "pending");
  const s = (v: unknown) => (v == null ? "" : String(v));
  return (
    <div className="space-y-6">
      <PageHeader
        title="Find Jobs For Me"
        description="Tell us what you want. Our matching system and recruitment team find suitable jobs: Match → Recommend → Apply (with your consent) → Schedule interview."
        actions={
          req ? (
            <div className="flex items-center gap-2">
              <Badge tone={req.status === "active" ? "good" : "neutral"}>{req.status === "active" ? "Active" : "Paused"}</Badge>
              <ActionButton action={setFindJobsStatusAction.bind(null, req.status === "active" ? "paused" : "active")} variant="secondary">
                {req.status === "active" ? "Pause" : "Resume"}
              </ActionButton>
            </div>
          ) : null
        }
      />
      <Card>
        <CardHeader title="Recommendations waiting for you" description={req?.lastMatchedAt ? `Last matched ${timeAgo(req.lastMatchedAt)}` : undefined} />
        <CardBody>
          {pending.length ? (
            <ul className="space-y-4">
              {pending.map(({ rec, job, company }) => (
                <li key={rec.id} className="rounded-lg border border-line p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-ink-3">{SOURCE_LABEL[rec.source]}</p>
                      <Link href={`/jobs/${job.id}`} className="font-semibold text-ink hover:text-accent">
                        {job.title}
                      </Link>
                      <p className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
                        {company.name} <CompanyVerificationBadge status={company.verificationStatus} /> · {job.location} · {formatCtcRange(job.minCtc, job.maxCtc)}
                      </p>
                      {rec.message ? <p className="mt-2 text-sm italic text-ink-2">“{rec.message}”</p> : null}
                    </div>
                    <MatchScore score={rec.score} />
                  </div>
                  {rec.reasons.length ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-medium text-accent">Why we recommended this</summary>
                      <div className="mt-2">
                        <MatchReasons reasons={rec.reasons} />
                      </div>
                    </details>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <ActionButton action={respondRecommendationAction.bind(null, rec.id, "accept")} variant="primary" size="md">
                      Yes, apply for me
                    </ActionButton>
                    <ActionButton action={respondRecommendationAction.bind(null, rec.id, "decline")} variant="ghost" size="md">
                      Not interested
                    </ActionButton>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No new recommendations" description={req ? "We'll notify you as soon as a suitable job appears." : "Activate the service below to start receiving recommendations."} />
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={req ? "Your preferences" : "Activate Find Jobs For Me"} description="Free for candidates. We never apply without your permission unless you choose automatic applications." />
        <CardBody>
          <FindJobsForm
            active={!!req}
            d={{
              desiredRole: s(req?.desiredRole ?? candidate.currentDesignation),
              preferredLocations: (req?.preferredLocations ?? candidate.preferredLocations).join(", "),
              expectedCtc: s(req?.expectedCtc ?? candidate.expectedCtc),
              experienceYears: s(req?.experienceYears ?? candidate.experienceYears),
              preferredIndustry: s(req?.preferredIndustry ?? candidate.industry),
              workMode: s(req?.workMode ?? candidate.workModePreference),
              joiningAvailabilityDays: s(req?.joiningAvailabilityDays ?? candidate.noticePeriodDays),
              applyMode: s(req?.applyMode),
              notes: s(req?.notes),
            }}
          />
        </CardBody>
      </Card>
      {handled.length ? (
        <Card>
          <CardHeader title="Past recommendations" />
          <CardBody>
            <ul className="divide-y divide-line text-sm">
              {handled.map(({ rec, job, company }) => (
                <li key={rec.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <Link href={`/jobs/${job.id}`} className="font-medium text-ink hover:text-accent">
                      {job.title}
                    </Link>{" "}
                    <span className="text-ink-2">· {company.name} · {formatDateTime(rec.createdAt)}</span>
                  </span>
                  <Badge tone={rec.status === "applied" ? "good" : rec.status === "declined" ? "neutral" : "accent"}>{rec.status === "applied" ? "Applied" : rec.status === "declined" ? "Declined" : "Accepted"}</Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
