import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { Bookmark, Building2 } from "lucide-react";
import { db } from "@/db";
import { applications, companies, documents, jobs, resumes, savedJobs } from "@/db/schema";
import { applyAction, reportJobAction, toggleSaveJobAction } from "@/actions/candidate";
import { CompanyVerificationBadge, MatchReasons, MatchScore, StageBadge } from "@/components/badges";
import { ActionButton } from "@/components/forms";
import { JobMeta } from "@/components/job-card";
import { Alert, Badge, ButtonLink, Card, CardBody, CardHeader, DescriptionList } from "@/components/ui";
import { COMPANY_SIZES, EDUCATION_LEVELS, INDUSTRIES, labelOf } from "@/lib/constants";
import { formatCtcRange, formatLpa, timeAgo } from "@/lib/format";
import { describeMandatory, joiningDays, matchCandidateToJob } from "@/lib/matching";
import { getCandidateForUser, getCurrentUser } from "@/server/auth";
import { companyTrustStats, educationsByCandidate, formatResponseTime, toMatchCandidate } from "@/server/queries";
import { ApplyForm, ReportForm } from "./job-actions";

async function load(id: string) {
  const [row] = await db.select({ job: jobs, company: companies }).from(jobs).innerJoin(companies, eq(companies.id, jobs.companyId)).where(eq(jobs.id, id)).limit(1);
  return row;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const row = await load((await params).id);
  return { title: row ? `${row.job.title} at ${row.company.name}` : "Job not found" };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-3">{title}</h2>
      <div className="mt-2 text-sm leading-6 text-ink">{children}</div>
    </div>
  );
}

function Lines({ text }: { text: string }) {
  const lines = text.split(/\n+/).filter(Boolean);
  if (lines.length === 1) return <p className="whitespace-pre-line">{text}</p>;
  return (
    <ul className="list-disc space-y-1 pl-5">
      {lines.map((l, i) => (
        <li key={i}>{l.replace(/^[-•*]\s*/, "")}</li>
      ))}
    </ul>
  );
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await load(id);
  const user = await getCurrentUser();
  if (!row) notFound();
  const { job, company } = row;
  const isOwnerCompany = user?.role === "company";
  if (job.status !== "active" && user?.role !== "admin" && !isOwnerCompany) {
    // Closed jobs remain visible to applicants; hide drafts/pending/suspended from the public.
    if (!["closed", "paused"].includes(job.status)) notFound();
  }
  await db.update(jobs).set({ viewCount: sql`${jobs.viewCount} + 1` }).where(eq(jobs.id, job.id));

  const candidate = user?.role === "candidate" ? await getCandidateForUser(user.id) : null;
  const trust = await companyTrustStats(company.id);
  const mandatory = describeMandatory(job);

  let match = null;
  let application = null;
  let saved = false;
  let resumeOptions: { value: string; label: string }[] = [];
  if (candidate) {
    const eds = (await educationsByCandidate([candidate.id])).get(candidate.id) ?? [];
    match = matchCandidateToJob(toMatchCandidate(candidate, eds), job);
    [application] = await db
      .select()
      .from(applications)
      .where(and(eq(applications.jobId, job.id), eq(applications.candidateId, candidate.id)))
      .limit(1);
    saved = !!(await db.select().from(savedJobs).where(and(eq(savedJobs.jobId, job.id), eq(savedJobs.candidateId, candidate.id))).limit(1))[0];
    const [rs, uploaded] = await Promise.all([
      db.select().from(resumes).where(eq(resumes.candidateId, candidate.id)),
      db
        .select()
        .from(documents)
        .where(and(eq(documents.ownerType, "candidate"), eq(documents.ownerId, candidate.id), eq(documents.docType, "resume"))),
    ]);
    resumeOptions = [
      ...rs.sort((a, b) => Number(b.isDefault) - Number(a.isDefault)).map((r) => ({ value: `resume:${r.id}`, label: `${r.title}${r.isDefault ? " (default)" : ""}` })),
      ...uploaded.map((d) => ({ value: `doc:${d.id}`, label: `Uploaded: ${d.fileName}` })),
    ];
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link href="/jobs" className="text-sm text-ink-2 hover:text-ink">
        ← All jobs
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{job.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link href={`/companies/${company.id}`} className="font-medium text-ink-2 hover:text-ink">
              {company.name}
            </Link>
            <CompanyVerificationBadge status={company.verificationStatus} />
            {job.department ? <span className="text-sm text-ink-3">· {job.department}</span> : null}
          </div>
          <div className="mt-3">
            <JobMeta job={job} />
          </div>
          <p className="mt-2 text-xs text-ink-3">
            Posted {timeAgo(job.publishedAt)} · {job.vacancies} {job.vacancies === 1 ? "opening" : "openings"} · {job.viewCount + 1} views
          </p>
        </div>
        {match ? <MatchScore score={match.score} eligible={match.eligible} /> : null}
      </div>

      {company.verificationStatus !== "verified" ? (
        <div className="mt-4">
          <Alert tone="warn" title="UNVERIFIED COMPANY">
            This company has not completed platform verification yet. Never pay any fee to apply or to get an interview.
          </Alert>
        </div>
      ) : null}
      {job.status !== "active" ? (
        <div className="mt-4">
          <Alert tone="info" title="This job is no longer accepting applications." />
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardBody className="space-y-6">
            <Section title="About the role">
              <Lines text={job.description} />
            </Section>
            {job.responsibilities ? (
              <Section title="Responsibilities">
                <Lines text={job.responsibilities} />
              </Section>
            ) : null}
            <Section title="Skills">
              <div className="flex flex-wrap gap-1.5">
                {job.requiredSkills.map((s) => (
                  <Badge key={s} tone="accent">
                    {s}
                  </Badge>
                ))}
                {job.preferredSkills.map((s) => (
                  <Badge key={s} title="Preferred">
                    {s} (preferred)
                  </Badge>
                ))}
              </div>
            </Section>
            {mandatory.length ? (
              <Section title="Mandatory requirements">
                <ul className="list-disc space-y-1 pl-5">
                  {mandatory.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </Section>
            ) : null}
            <DescriptionList
              items={[
                { label: "Industry", value: labelOf(INDUSTRIES, job.industry) },
                { label: "Education", value: labelOf(EDUCATION_LEVELS, job.educationLevel) },
                { label: "Salary / CTC", value: formatCtcRange(job.minCtc, job.maxCtc) },
                { label: "Joining timeline", value: job.joiningWithinDays != null ? `Within ${job.joiningWithinDays} days` : "Flexible" },
                { label: "Notice period", value: job.maxNoticePeriodDays != null ? `Up to ${job.maxNoticePeriodDays} days` : "Any" },
                { label: "Incentives", value: job.incentives ?? "—" },
                { label: "Benefits", value: job.benefits ?? "—" },
              ]}
            />
            {job.interviewProcess ? (
              <Section title="Interview process">
                <p className="whitespace-pre-line">{job.interviewProcess}</p>
                {job.interviewRequirements ? <p className="mt-2 text-ink-2">{job.interviewRequirements}</p> : null}
              </Section>
            ) : null}
          </CardBody>
        </Card>

        <div className="space-y-4">
          {candidate ? (
            <>
              <Card>
                <CardHeader title={application ? "Your application" : "Apply"} />
                <CardBody>
                  {application ? (
                    <div className="space-y-3 text-sm">
                      <p className="flex items-center gap-2">
                        Status: <StageBadge stage={application.stage} />
                      </p>
                      <ButtonLink href={`/candidate/applications/${application.id}`} variant="secondary" className="w-full">
                        Track application
                      </ButtonLink>
                    </div>
                  ) : job.status === "active" ? (
                    <>
                      {match && !match.eligible ? (
                        <div className="mb-3">
                          <Alert tone="warn" title="You don't meet all mandatory requirements">
                            You can still apply, but the company will see which requirements are not met.
                          </Alert>
                        </div>
                      ) : null}
                      <ApplyForm action={applyAction.bind(null, job.id)} resumeOptions={resumeOptions} />
                    </>
                  ) : (
                    <p className="text-sm text-ink-2">Applications are closed.</p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <ActionButton action={toggleSaveJobAction.bind(null, job.id)} variant="ghost">
                      <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} aria-hidden />
                      {saved ? "Saved" : "Save job"}
                    </ActionButton>
                  </div>
                </CardBody>
              </Card>
              {match ? (
                <Card>
                  <CardHeader title="Why this matches you" description="Transparent factors — not an opaque AI score." />
                  <CardBody className="space-y-4">
                    <MatchReasons reasons={match.reasons} failedMandatory={match.failedMandatory} />
                  </CardBody>
                </Card>
              ) : null}
              <Card>
                <CardHeader title="CTC match" />
                <CardBody>
                  <DescriptionList
                    columns={1}
                    items={[
                      { label: "Your current CTC", value: formatLpa(candidate.currentCtc) },
                      { label: "Your expected CTC", value: formatLpa(candidate.expectedCtc) },
                      { label: "Company range", value: formatCtcRange(job.minCtc, job.maxCtc) },
                      { label: "You can join in", value: (() => { const d = joiningDays(candidate); return d == null ? "Not specified" : d === 0 ? "Immediately" : `${d} days`; })() },
                    ]}
                  />
                </CardBody>
              </Card>
              <ReportForm action={reportJobAction.bind(null, job.id)} />
            </>
          ) : !user ? (
            <Card className="p-5">
              <p className="text-sm text-ink">Sign in or create a free profile to apply, see how well you match and track your application.</p>
              <div className="mt-4 flex gap-2">
                <ButtonLink href={`/login?next=/jobs/${job.id}`}>Sign in to apply</ButtonLink>
                <ButtonLink href="/register" variant="secondary">
                  Register
                </ButtonLink>
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="About the company" action={<Building2 className="h-4 w-4 text-ink-3" aria-hidden />} />
            <CardBody className="space-y-3 text-sm">
              <CompanyVerificationBadge status={company.verificationStatus} size="lg" />
              {company.description ? <p className="text-ink-2">{company.description}</p> : null}
              <DescriptionList
                columns={2}
                items={[
                  { label: "Industry", value: labelOf(INDUSTRIES, company.industry) },
                  { label: "Size", value: labelOf(COMPANY_SIZES, company.size) },
                  { label: "Location", value: company.city ?? "—" },
                  { label: "Jobs posted", value: trust.jobsPosted },
                  { label: "Successful hires", value: trust.successfulHires },
                  { label: "Avg. response", value: formatResponseTime(trust.avgResponseHours) },
                ]}
              />
              <Link href={`/companies/${company.id}`} className="inline-block font-medium text-accent hover:underline">
                View trust profile →
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
