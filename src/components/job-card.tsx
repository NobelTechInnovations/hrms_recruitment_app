import Link from "next/link";
import { Briefcase, Clock, IndianRupee, MapPin, Star } from "lucide-react";
import type { Company, Job } from "@/db/schema";
import { EMPLOYMENT_TYPES, WORK_MODES, labelOf } from "@/lib/constants";
import { formatCtcRange, formatExperience, timeAgo } from "@/lib/format";
import type { MatchResult } from "@/lib/matching";
import { CompanyVerificationBadge, MatchScore } from "./badges";
import { Badge, Card } from "./ui";

export function JobMeta({ job }: { job: Job }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
      <span className="inline-flex items-center gap-1">
        <MapPin className="h-3.5 w-3.5" aria-hidden />
        {job.location.toLowerCase() === job.workMode ? labelOf(WORK_MODES, job.workMode) : `${job.location} · ${labelOf(WORK_MODES, job.workMode)}`}
      </span>
      <span className="inline-flex items-center gap-1">
        <IndianRupee className="h-3.5 w-3.5" aria-hidden />
        {formatCtcRange(job.minCtc, job.maxCtc)}
      </span>
      <span className="inline-flex items-center gap-1">
        <Briefcase className="h-3.5 w-3.5" aria-hidden />
        {formatExperience(job.minExperience, job.maxExperience)} · {labelOf(EMPLOYMENT_TYPES, job.employmentType)}
      </span>
    </div>
  );
}

export function JobCard({ job, company, match, priority, featured, href, footer }: { job: Job; company: Company; match?: MatchResult; priority?: boolean; featured?: boolean; href?: string; footer?: React.ReactNode }) {
  return (
    <Card className="p-5 transition-colors hover:border-line-strong">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={href ?? `/jobs/${job.id}`} className="text-base font-semibold text-ink hover:text-accent">
            {job.title}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <Link href={`/companies/${company.id}`} className="font-medium text-ink-2 hover:text-ink">
              {company.name}
            </Link>
            <CompanyVerificationBadge status={company.verificationStatus} />
            {featured ? (
              <Badge tone="warn">
                <Star className="h-3 w-3" aria-hidden /> Featured employer
              </Badge>
            ) : null}
            {priority ? <Badge tone="accent">Priority</Badge> : null}
          </div>
        </div>
        {match ? <MatchScore score={match.score} eligible={match.eligible} /> : null}
      </div>
      <div className="mt-3">
        <JobMeta job={job} />
      </div>
      {job.requiredSkills.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.requiredSkills.slice(0, 6).map((s) => (
            <Badge key={s}>{s}</Badge>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" aria-hidden /> Posted {timeAgo(job.publishedAt)}
          {job.vacancies > 1 ? ` · ${job.vacancies} openings` : ""}
        </span>
        {footer}
      </div>
    </Card>
  );
}
