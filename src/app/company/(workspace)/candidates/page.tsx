import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { Search } from "lucide-react";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { AvailabilityBadge, CandidateVerificationBadges, MatchScore, ScreeningBadges, VerificationLevelBadge } from "@/components/badges";
import { Alert, Avatar, Card, EmptyState, Input, Label, PageHeader, Select } from "@/components/ui";
import { AVAILABILITY, EDUCATION_LEVELS, INDUSTRIES } from "@/lib/constants";
import { formatLpa, formatYears } from "@/lib/format";
import { VERIFICATION_LEVEL_LABELS } from "@/lib/profile-score";
import { requireCompany } from "@/server/auth";
import { searchCandidates, type CandidateFilters } from "@/server/candidate-search";

export const metadata: Metadata = { title: "Search candidates" };

export default async function CandidateSearchPage({ searchParams }: { searchParams: Promise<CandidateFilters> }) {
  const { company } = await requireCompany("candidates.search");
  const f = await searchParams;
  const companyJobs = await db.select().from(jobs).where(and(eq(jobs.companyId, company.id), eq(jobs.status, "active")));
  const job = companyJobs.find((j) => j.id === f.job) ?? null;
  const verified = company.verificationStatus === "verified";
  const results = verified ? await searchCandidates(f, job) : [];
  return (
    <div className="space-y-6">
      <PageHeader title="Search candidates" description="Only candidates who opted into search are shown. Contact details are never displayed — reach out through the platform." />
      {!verified ? <Alert tone="warn" title="Candidate search unlocks after your company is verified.">This protects candidates’ privacy. Complete verification under Company &amp; verification.</Alert> : null}
      <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
        <Card className="h-fit p-4">
          <form method="get" className="space-y-3">
            <div>
              <Label htmlFor="job">Match against job</Label>
              <Select id="job" name="job" defaultValue={f.job ?? ""} options={companyJobs.map((j) => ({ value: j.id, label: j.title }))} placeholder="No job selected" />
            </div>
            <div>
              <Label htmlFor="q">Keywords</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-ink-3" aria-hidden />
                <Input id="q" name="q" defaultValue={f.q} placeholder="Name, title or skill" className="pl-8" />
              </div>
            </div>
            <div>
              <Label htmlFor="skills">Must-have skills</Label>
              <Input id="skills" name="skills" defaultValue={f.skills} placeholder="React, SQL" />
            </div>
            <div>
              <Label htmlFor="industry">Industry</Label>
              <Select id="industry" name="industry" defaultValue={f.industry ?? ""} options={INDUSTRIES} placeholder="Any" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="minExp">Min exp</Label>
                <Input id="minExp" name="minExp" type="number" min={0} defaultValue={f.minExp} />
              </div>
              <div>
                <Label htmlFor="maxExp">Max exp</Label>
                <Input id="maxExp" name="maxExp" type="number" min={0} defaultValue={f.maxExp} />
              </div>
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" defaultValue={f.location} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="maxCtc">Max expected CTC</Label>
                <Input id="maxCtc" name="maxCtc" type="number" min={0} step="0.5" defaultValue={f.maxCtc} />
              </div>
              <div>
                <Label htmlFor="maxNotice">Joins within (days)</Label>
                <Input id="maxNotice" name="maxNotice" type="number" min={0} defaultValue={f.maxNotice} />
              </div>
            </div>
            <div>
              <Label htmlFor="availability">Availability</Label>
              <Select id="availability" name="availability" defaultValue={f.availability ?? ""} options={AVAILABILITY.map((a) => ({ value: a.value, label: `${a.emoji} ${a.label}` }))} placeholder="Actively looking" />
            </div>
            <div>
              <Label htmlFor="verification">Verification level (min)</Label>
              <Select id="verification" name="verification" defaultValue={f.verification ?? ""} options={(["basic", "identity", "professional", "full"] as const).map((v) => ({ value: v, label: VERIFICATION_LEVEL_LABELS[v] }))} placeholder="Any" />
            </div>
            <div>
              <Label htmlFor="screening">Screening</Label>
              <Select id="screening" name="screening" defaultValue={f.screening ?? ""} options={[{ value: "l1", label: "Level 1 qualified" }, { value: "l2", label: "Level 2 qualified" }]} placeholder="Any" />
            </div>
            <div>
              <Label htmlFor="education">Education (min)</Label>
              <Select id="education" name="education" defaultValue={f.education ?? ""} options={EDUCATION_LEVELS.filter((e) => e.value !== "any")} placeholder="Any" />
            </div>
            <div className="flex gap-2 pt-1">
              <button className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover dark:text-black">Search</button>
              <Link href="/company/candidates" className="rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-subtle">Reset</Link>
            </div>
          </form>
        </Card>
        <div className="space-y-3">
          {verified ? <p className="text-sm text-ink-2">{results.length} {results.length === 1 ? "candidate" : "candidates"}{job ? ` · ranked by match for ${job.title}` : ""}</p> : null}
          {results.map(({ candidate: c, score, match }) => (
            <Card key={c.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <Avatar name={c.fullName} src={c.photoKey ? `/api/photos/${c.id}` : null} size={44} />
                  <div className="min-w-0">
                    <Link href={`/company/candidates/${c.id}${job ? `?job=${job.id}` : ""}`} className="font-semibold text-ink hover:text-accent">
                      {c.fullName}
                    </Link>
                    <p className="text-sm text-ink-2">
                      {c.headline ?? c.currentDesignation ?? "—"} · {formatYears(c.experienceYears)} · {c.currentLocation ?? "—"} · expects {formatLpa(c.expectedCtc)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <VerificationLevelBadge level={score.level} />
                      <AvailabilityBadge availability={c.availability} />
                      <ScreeningBadges candidate={c} />
                    </div>
                    <div className="mt-1.5">
                      <CandidateVerificationBadges candidate={c} compact />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {match ? <MatchScore score={match.score} eligible={match.eligible} /> : null}
                  <span className="text-xs text-ink-3">Profile {score.completion}% complete</span>
                </div>
              </div>
            </Card>
          ))}
          {verified && !results.length ? <EmptyState title="No candidates match these filters" /> : null}
        </div>
      </div>
    </div>
  );
}
