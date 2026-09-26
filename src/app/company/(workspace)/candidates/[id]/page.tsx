import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Mail } from "lucide-react";
import { db } from "@/db";
import { applications, jobs, recommendations } from "@/db/schema";
import { inviteCandidateAction, startConversationAction } from "@/actions/company";
import { AvailabilityBadge, CandidateVerificationBadges, MatchReasons, MatchScore, ScreeningBadges, StageBadge, VerificationLevelBadge } from "@/components/badges";
import { ActionButton } from "@/components/forms";
import { Alert, Avatar, Badge, Card, CardBody, CardHeader, DescriptionList, Meter, PageHeader, Select } from "@/components/ui";
import { EDUCATION_LEVELS, INDUSTRIES, labelOf } from "@/lib/constants";
import { formatLpa, formatYears } from "@/lib/format";
import { joiningDays, matchCandidateToJob } from "@/lib/matching";
import { can } from "@/lib/permissions";
import { companyCanViewCandidate, hasApplication } from "@/server/access";
import { requireCompany } from "@/server/auth";
import { canCompanyContact } from "@/server/messaging";
import { highestEducation, loadCandidateBundle, scoreFor, toMatchCandidate } from "@/server/queries";
import { InviteForm } from "../../jobs/[id]/matches/invite-form";

export const metadata: Metadata = { title: "Candidate profile" };

function month(ym: string | null) {
  if (!ym) return "Present";
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export default async function CompanyCandidatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ job?: string }> }) {
  const { id } = await params;
  const { job: jobId } = await searchParams;
  const { member, company } = await requireCompany();
  const bundle = await loadCandidateBundle(id);
  if (!bundle) notFound();
  const c = bundle.candidate;
  if (!(await companyCanViewCandidate(company, c))) {
    return (
      <div className="max-w-xl">
        <PageHeader title="Profile not available" back={{ href: "/company/candidates", label: "Search" }} />
        <Alert tone="info" title="This candidate has limited their profile visibility.">They can still find and apply to your jobs.</Alert>
      </div>
    );
  }
  const score = scoreFor(bundle);
  const applied = await hasApplication(company.id, c.id);
  const [companyJobs, apps, invites, contact] = await Promise.all([
    db.select().from(jobs).where(and(eq(jobs.companyId, company.id), eq(jobs.status, "active"))),
    db.select({ app: applications, job: jobs }).from(applications).innerJoin(jobs, eq(jobs.id, applications.jobId)).where(and(eq(applications.companyId, company.id), eq(applications.candidateId, c.id))),
    db.select({ jobId: recommendations.jobId }).from(recommendations).where(eq(recommendations.candidateId, c.id)),
    canCompanyContact(company, c),
  ]);
  const job = companyJobs.find((j) => j.id === jobId) ?? null;
  const match = job ? matchCandidateToJob(toMatchCandidate(c, bundle.educations), job) : null;
  const invitedJobIds = new Set(invites.map((i) => i.jobId));
  const inviteable = companyJobs.filter((j) => !invitedJobIds.has(j.id) && !apps.some((a) => a.job.id === j.id));
  const days = joiningDays(c);

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar name={c.fullName} src={c.photoKey ? `/api/photos/${c.id}` : null} size={48} />
            {c.fullName}
          </span>
        }
        back={{ href: "/company/candidates", label: "Search" }}
        description={<span className="flex flex-wrap items-center gap-2">{c.headline} <VerificationLevelBadge level={score.level} /> <AvailabilityBadge availability={c.availability} /></span>}
        actions={
          can(member.role, "messages.send") && contact.ok ? (
            <ActionButton action={startConversationAction.bind(null, c.id)} hidden={job ? { jobId: job.id } : undefined} variant="secondary" size="md">
              <Mail className="h-4 w-4" aria-hidden /> Message via platform
            </ActionButton>
          ) : null
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {c.summary ? (
            <Card>
              <CardHeader title="Summary" />
              <CardBody>
                <p className="whitespace-pre-line text-sm text-ink">{c.summary}</p>
              </CardBody>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Experience" />
            <CardBody className="space-y-4">
              {bundle.experiences.length ? (
                bundle.experiences.map((e) => (
                  <div key={e.id}>
                    <p className="font-medium text-ink">
                      {e.title} · {e.company}
                    </p>
                    <p className="text-sm text-ink-2">
                      {month(e.startDate)} – {e.isCurrent ? "Present" : month(e.endDate)}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                    {e.description ? <p className="mt-1 whitespace-pre-line text-sm text-ink-2">{e.description}</p> : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink-2">{c.experienceYears === 0 ? "Fresher" : "No experience listed."}</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Education & certifications" />
            <CardBody className="space-y-3 text-sm">
              {bundle.educations.map((e) => (
                <p key={e.id}>
                  <span className="font-medium text-ink">{e.degree}</span> <span className="text-ink-2">· {e.institution}{e.endYear ? ` · ${e.endYear}` : ""}</span>
                </p>
              ))}
              {bundle.certifications.map((x) => (
                <p key={x.id}>
                  <Badge tone="info">Certification</Badge> <span className="text-ink">{x.name}</span> <span className="text-ink-2">{x.issuer ? `· ${x.issuer}` : ""}</span>
                </p>
              ))}
              {bundle.projects.map((p) => (
                <p key={p.id}>
                  <Badge>Project</Badge> <span className="text-ink">{p.name}</span> <span className="text-ink-2">{p.description ? `· ${p.description}` : ""}</span>
                </p>
              ))}
            </CardBody>
          </Card>
          {apps.length ? (
            <Card>
              <CardHeader title="Applications to your company" />
              <CardBody>
                <ul className="space-y-2 text-sm">
                  {apps.map(({ app, job: j }) => (
                    <li key={app.id} className="flex items-center justify-between gap-2">
                      <Link href={`/company/applications/${app.id}`} className="font-medium text-ink hover:text-accent">
                        {j.title}
                      </Link>
                      <StageBadge stage={app.stage} />
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Verified qualifications" />
            <CardBody className="space-y-3">
              <Meter value={score.completion} label="Profile completion" />
              <CandidateVerificationBadges candidate={c} />
              <ScreeningBadges candidate={c} />
              <p className="text-xs text-ink-3">
                Assessment scores: {c.level1Score != null ? `Level 1 ${c.level1Score}%` : "Level 1 not taken"}
                {c.level2Score != null ? ` · Level 2 (${labelOf(INDUSTRIES, c.level2Category)}) ${c.level2Score}%` : ""}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Snapshot" />
            <CardBody className="space-y-3">
              <DescriptionList
                columns={2}
                items={[
                  { label: "Experience", value: formatYears(c.experienceYears) },
                  { label: "Education", value: labelOf(EDUCATION_LEVELS, highestEducation(bundle.educations)) },
                  { label: "Current CTC", value: formatLpa(c.currentCtc) },
                  { label: "Expected CTC", value: formatLpa(c.expectedCtc) },
                  { label: "Can join in", value: days == null ? "—" : days === 0 ? "Immediately" : `${days} days` },
                  { label: "Location", value: c.currentLocation ?? "—" },
                  { label: "Industry", value: labelOf(INDUSTRIES, c.industry) },
                  { label: "Languages", value: c.languages.join(", ") || "—" },
                ]}
              />
              <div className="flex flex-wrap gap-1.5">
                {c.skills.map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
              </div>
              {applied && (c.linkedinUrl || c.portfolioUrl) ? (
                <p className="text-sm">
                  {c.linkedinUrl ? <a className="text-accent hover:underline" href={c.linkedinUrl} target="_blank" rel="noopener noreferrer nofollow">LinkedIn</a> : null}
                  {c.linkedinUrl && c.portfolioUrl ? " · " : ""}
                  {c.portfolioUrl ? <a className="text-accent hover:underline" href={c.portfolioUrl} target="_blank" rel="noopener noreferrer nofollow">Portfolio</a> : null}
                </p>
              ) : null}
              <p className="rounded-md bg-subtle px-3 py-2 text-xs text-ink-2">
                Email and phone are private. Relay address: <span className="font-mono text-ink">{c.maskedEmail}</span>
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Match against a job" />
            <CardBody className="space-y-3">
              <form method="get" className="flex gap-2">
                <label htmlFor="job" className="sr-only">Job</label>
                <Select id="job" name="job" defaultValue={job?.id ?? ""} options={companyJobs.map((j) => ({ value: j.id, label: j.title }))} placeholder="Choose a job" />
                <button className="rounded-lg border border-line-strong px-3 text-sm hover:bg-subtle">Check</button>
              </form>
              {match ? (
                <>
                  <MatchScore score={match.score} eligible={match.eligible} />
                  <MatchReasons reasons={match.reasons} failedMandatory={match.failedMandatory} />
                </>
              ) : null}
            </CardBody>
          </Card>
          {can(member.role, "candidates.search") && company.verificationStatus === "verified" && c.allowRecommendations && inviteable.length ? (
            <Card>
              <CardHeader title="Invite to apply" description="The candidate decides whether to apply." />
              <CardBody className="space-y-3">
                {inviteable.map((j) => (
                  <div key={j.id}>
                    <p className="mb-1 text-sm font-medium text-ink">{j.title}</p>
                    <InviteForm action={inviteCandidateAction.bind(null, c.id)} jobId={j.id} />
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
