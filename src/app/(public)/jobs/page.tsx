import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Bookmark } from "lucide-react";
import { JobCard } from "@/components/job-card";
import { ButtonLink, Card, EmptyState, Input, Label, Select } from "@/components/ui";
import { ActionButton } from "@/components/forms";
import { toggleSaveJobAction } from "@/actions/candidate";
import { EDUCATION_LEVELS, EMPLOYMENT_TYPES, INDUSTRIES, WORK_MODES } from "@/lib/constants";
import { getCandidateForUser, getCurrentUser } from "@/server/auth";
import { hiringCompanies, searchJobs, type JobFilters } from "@/server/job-search";

export const metadata: Metadata = { title: "Browse jobs" };

export default async function JobsPage({ searchParams }: { searchParams: Promise<JobFilters> }) {
  const filters = await searchParams;
  const user = await getCurrentUser();
  const candidate = user?.role === "candidate" ? await getCandidateForUser(user.id) : null;
  const [{ rows, total, page, pages, sort }, companyOptions] = await Promise.all([searchJobs(filters, candidate), hiringCompanies()]);

  const qs = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, ...overrides })) if (v) p.set(k, v);
    return `/jobs?${p.toString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Find verified jobs</h1>
          <p className="mt-1 text-sm text-ink-2">
            {total} {total === 1 ? "job" : "jobs"} · Save job → Apply → Track application → Interview → Offer
          </p>
        </div>
        {candidate ? (
          <ButtonLink href="/candidate/find-jobs" variant="secondary" size="sm">
            Let us find jobs for me
          </ButtonLink>
        ) : null}
      </div>
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <Card className="h-fit p-4 lg:sticky lg:top-20">
          <form className="space-y-3" method="get">
            <div>
              <Label htmlFor="q">Keywords</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-ink-3" aria-hidden />
                <Input id="q" name="q" defaultValue={filters.q} placeholder="Title, skill or company" className="pl-8" />
              </div>
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" defaultValue={filters.location} placeholder="e.g. Bengaluru or Remote" />
            </div>
            <div>
              <Label htmlFor="industry">Industry</Label>
              <Select id="industry" name="industry" defaultValue={filters.industry ?? ""} options={INDUSTRIES} placeholder="All industries" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="workMode">Work mode</Label>
                <Select id="workMode" name="workMode" defaultValue={filters.workMode ?? ""} options={WORK_MODES} placeholder="Any" />
              </div>
              <div>
                <Label htmlFor="employmentType">Job type</Label>
                <Select id="employmentType" name="employmentType" defaultValue={filters.employmentType ?? ""} options={EMPLOYMENT_TYPES} placeholder="Any" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="minSalary">Min CTC (LPA)</Label>
                <Input id="minSalary" name="minSalary" type="number" min={0} step="0.5" defaultValue={filters.minSalary} />
              </div>
              <div>
                <Label htmlFor="experience">Experience (yrs)</Label>
                <Input id="experience" name="experience" type="number" min={0} max={40} defaultValue={filters.experience} />
              </div>
            </div>
            <div>
              <Label htmlFor="skills">Skills</Label>
              <Input id="skills" name="skills" defaultValue={filters.skills} placeholder="React, SQL" />
            </div>
            <div>
              <Label htmlFor="education">My education</Label>
              <Select id="education" name="education" defaultValue={filters.education ?? ""} options={EDUCATION_LEVELS.filter((e) => e.value !== "any")} placeholder="Any" />
            </div>
            <div>
              <Label htmlFor="company">Company</Label>
              <Select id="company" name="company" defaultValue={filters.company ?? ""} options={companyOptions.map((c) => ({ value: c.id, label: c.name }))} placeholder="All companies" />
            </div>
            <div>
              <Label htmlFor="posted">Date posted</Label>
              <Select
                id="posted"
                name="posted"
                defaultValue={filters.posted ?? ""}
                options={[
                  { value: "1", label: "Last 24 hours" },
                  { value: "7", label: "Last 7 days" },
                  { value: "30", label: "Last 30 days" },
                ]}
                placeholder="Any time"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="verified" value="1" defaultChecked={filters.verified === "1"} className="h-4 w-4 accent-[var(--accent)]" />
              Verified companies only
            </label>
            {filters.sort ? <input type="hidden" name="sort" value={filters.sort} /> : null}
            <div className="flex gap-2 pt-1">
              <button type="submit" className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover dark:text-black">
                Apply filters
              </button>
              <Link href="/jobs" className="rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-subtle">
                Reset
              </Link>
            </div>
          </form>
        </Card>
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-ink-2">
            <span>Sort by:</span>
            {[
              ...(candidate ? [["match", "Best match"]] : []),
              ["newest", "Newest"],
              ["salary", "Highest CTC"],
            ].map(([value, label]) => (
              <Link key={value} href={qs({ sort: value, page: undefined })} aria-current={sort === value ? "true" : undefined} className={sort === value ? "rounded-md bg-accent-soft px-2 py-1 font-medium text-accent-ink" : "rounded-md px-2 py-1 hover:bg-subtle"}>
                {label}
              </Link>
            ))}
          </div>
          {rows.length === 0 ? (
            <EmptyState title="No jobs match these filters" description="Try removing a filter or broadening the location." action={<ButtonLink href="/jobs" variant="secondary" size="sm">Clear filters</ButtonLink>} />
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <JobCard
                  key={r.job.id}
                  {...r}
                  footer={
                    candidate ? (
                      <ActionButton action={toggleSaveJobAction.bind(null, r.job.id)} variant="ghost">
                        <Bookmark className={`h-3.5 w-3.5 ${r.saved ? "fill-current" : ""}`} aria-hidden />
                        {r.saved ? "Saved" : "Save"}
                      </ActionButton>
                    ) : null
                  }
                />
              ))}
            </div>
          )}
          {pages > 1 ? (
            <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Pagination">
              {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="text-accent hover:underline">← Previous</Link> : <span />}
              <span className="text-ink-2">
                Page {page} of {pages}
              </span>
              {page < pages ? <Link href={qs({ page: String(page + 1) })} className="text-accent hover:underline">Next →</Link> : <span />}
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}
