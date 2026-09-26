import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Video } from "lucide-react";
import { setAvailabilityAction } from "@/actions/candidate";
import { AvailabilityBadge, CandidateVerificationBadges, MatchScore, ScreeningBadges, VerificationLevelBadge } from "@/components/badges";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Alert, ButtonLink, Card, CardBody, CardHeader, Checklist, EmptyState, Meter, Select, StatTile } from "@/components/ui";
import { AVAILABILITY } from "@/lib/constants";
import { formatCtcRange, formatDateTime, pluralize } from "@/lib/format";
import { requireCandidate } from "@/server/auth";
import { candidateApplicationStats, candidateInterviews } from "@/server/candidate-queries";
import { matchesForCandidate } from "@/server/matching-service";
import { loadCandidateBundle, scoreFor } from "@/server/queries";

export const metadata: Metadata = { title: "Dashboard" };

export default async function CandidateDashboard() {
  const { candidate } = await requireCandidate();
  const bundle = (await loadCandidateBundle(candidate.id))!;
  const score = scoreFor(bundle);
  const [stats, upcoming, matches] = await Promise.all([candidateApplicationStats(candidate.id), candidateInterviews(candidate.id, true), matchesForCandidate(candidate, { minScore: 60 })]);
  const missing = score.completionItems.filter((i) => !i.done);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Welcome back, {candidate.fullName.split(" ")[0]}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <VerificationLevelBadge level={score.level} />
            <AvailabilityBadge availability={candidate.availability} />
          </div>
        </div>
        <ButtonLink href="/jobs">Browse jobs</ButtonLink>
      </div>

      {!candidate.level1QualifiedAt ? (
        <Alert tone="info" title="Take the Level 1 aptitude assessment">
          Qualified candidates stand out to employers and unlock the Level 2 industry assessment.{" "}
          <Link href="/candidate/assessments" className="font-medium underline">
            Start now
          </Link>
        </Alert>
      ) : !candidate.level2QualifiedAt ? (
        <Alert tone="info" title="Please complete your Level 2 assessment.">
          Industry-qualified candidates are prioritised in company searches.{" "}
          <Link href="/candidate/assessments" className="font-medium underline">
            Choose your track
          </Link>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Applied" value={stats.applied} href="/candidate/applications" />
        <StatTile label="Shortlisted" value={stats.shortlisted} href="/candidate/applications?stage=shortlisted" />
        <StatTile label="Upcoming interviews" value={stats.interviews} href="/candidate/interviews" />
        <StatTile label="Offers" value={stats.offers} href="/candidate/applications?stage=offer" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Your profile" action={<Link href="/candidate/score" className="text-sm font-medium text-accent hover:underline">Details</Link>} />
          <CardBody className="space-y-4">
            <Meter value={score.completion} label="Profile completion" />
            {missing.length ? (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-3">Complete next</p>
                <Checklist items={missing.slice(0, 4)} />
                <ButtonLink href="/candidate/profile" variant="secondary" size="sm" className="mt-3">
                  Update profile
                </ButtonLink>
              </div>
            ) : null}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-3">Verification</p>
              <Checklist items={score.verification.slice(0, 3)} />
              <div className="mt-2">
                <CandidateVerificationBadges candidate={candidate} compact />
              </div>
            </div>
            <ScreeningBadges candidate={candidate} />
            <ActionForm action={setAvailabilityAction} className="flex items-end gap-2" showSuccess={false}>
              <div className="flex-1">
                <label htmlFor="availability" className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-3">
                  Availability
                </label>
                <Select id="availability" name="availability" defaultValue={candidate.availability} options={AVAILABILITY.map((a) => ({ value: a.value, label: `${a.emoji} ${a.label}` }))} />
              </div>
              <SubmitButton variant="secondary">Save</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Recommended jobs"
            description={matches.length ? `${pluralize(matches.length, "job")} match your profile` : undefined}
            action={<Link href="/candidate/matches" className="text-sm font-medium text-accent hover:underline">See all</Link>}
          />
          <CardBody>
            {matches.length ? (
              <ul className="divide-y divide-line">
                {matches.slice(0, 5).map((m) => (
                  <li key={m.job.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link href={`/jobs/${m.job.id}`} className="font-medium text-ink hover:text-accent">
                        {m.job.title}
                      </Link>
                      <p className="text-sm text-ink-2">
                        {m.company.name} · {m.job.location} · {formatCtcRange(m.job.minCtc, m.job.maxCtc)}
                      </p>
                    </div>
                    <MatchScore score={m.match.score} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No strong matches yet" description="Add more skills and complete your profile to improve matching." />
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Upcoming interviews" action={<Link href="/candidate/interviews" className="text-sm font-medium text-accent hover:underline">All interviews</Link>} />
        <CardBody>
          {upcoming.length ? (
            <ul className="divide-y divide-line">
              {upcoming.slice(0, 4).map(({ interview, job, company }) => (
                <li key={interview.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <CalendarDays className="mt-0.5 h-4 w-4 text-ink-3" aria-hidden />
                    <div>
                      <p className="font-medium text-ink">{interview.title}</p>
                      <p className="text-sm text-ink-2">
                        {job.title} · {company.name} · {formatDateTime(interview.scheduledAt)}
                      </p>
                    </div>
                  </div>
                  {interview.meetingUrl ? (
                    <ButtonLink href={interview.meetingUrl} target="_blank" rel="noopener noreferrer" size="sm" variant="secondary">
                      <Video className="h-3.5 w-3.5" aria-hidden /> Join
                    </ButtonLink>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">No interviews scheduled.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
