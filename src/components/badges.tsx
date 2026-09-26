import type { Candidate, MatchReason } from "@/db/schema";
import { AVAILABILITY, INDUSTRIES, INVOICE_STATUSES, PLACEMENT_STATUSES, labelOf } from "@/lib/constants";
import { stageLabel } from "@/lib/pipeline";
import { VERIFICATION_LEVEL_LABELS, type VerificationLevel } from "@/lib/profile-score";
import { Badge, cx, type Tone } from "./ui";

export function CompanyVerificationBadge({ status, size = "sm" }: { status: string; size?: "sm" | "lg" }) {
  const verified = status === "verified";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md font-semibold tracking-wide ring-1 ring-inset",
        size === "lg" ? "px-2.5 py-1 text-sm" : "px-1.5 py-0.5 text-[11px]",
        verified
          ? "bg-green-50 text-green-800 ring-green-300 dark:bg-green-950/50 dark:text-green-200 dark:ring-green-800"
          : "bg-amber-50 text-amber-900 ring-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-800",
      )}
      title={verified ? "Registration, tax and business details verified by the platform" : status === "pending" ? "Verification is under review" : "This company has not completed verification"}
    >
      {verified ? "VERIFIED COMPANY ✓" : "UNVERIFIED COMPANY"}
    </span>
  );
}

export function CandidateVerificationBadges({ candidate, compact = false }: { candidate: Pick<Candidate, "identityVerifiedAt" | "educationVerifiedAt" | "experienceVerifiedAt" | "salaryVerifiedAt" | "locationVerifiedAt">; compact?: boolean }) {
  const items = [
    ["Identity", candidate.identityVerifiedAt],
    ["Education", candidate.educationVerifiedAt],
    ["Experience", candidate.experienceVerifiedAt],
    ["Salary", candidate.salaryVerifiedAt],
    ["Location", candidate.locationVerifiedAt],
  ] as const;
  const verified = items.filter(([, at]) => at);
  if (!verified.length) return compact ? null : <span className="text-sm text-ink-3">No verified documents yet</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {verified.map(([label]) => (
        <Badge key={label} tone="good">
          {label} Verified ✓
        </Badge>
      ))}
    </div>
  );
}

export function ScreeningBadges({ candidate }: { candidate: Pick<Candidate, "level1QualifiedAt" | "level2QualifiedAt" | "level2Category"> }) {
  if (!candidate.level1QualifiedAt && !candidate.level2QualifiedAt) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {candidate.level1QualifiedAt ? <Badge tone="accent">Level 1 Qualified ✓</Badge> : null}
      {candidate.level2QualifiedAt ? <Badge tone="purple">Level 2 {labelOf(INDUSTRIES, candidate.level2Category)} Qualified ✓</Badge> : null}
    </div>
  );
}

export function VerificationLevelBadge({ level }: { level: VerificationLevel }) {
  const tone: Record<VerificationLevel, Tone> = { unverified: "neutral", basic: "info", identity: "accent", professional: "purple", full: "good" };
  return <Badge tone={tone[level]}>{VERIFICATION_LEVEL_LABELS[level]}</Badge>;
}

export function AvailabilityBadge({ availability }: { availability: string }) {
  const a = AVAILABILITY.find((x) => x.value === availability);
  if (!a) return null;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-ink-2">
      <span aria-hidden>{a.emoji}</span>
      {a.label}
    </span>
  );
}

const STAGE_TONES: Record<string, Tone> = {
  applied: "neutral",
  screening: "info",
  shortlisted: "accent",
  assessment: "info",
  interview_1: "purple",
  interview_2: "purple",
  hr_interview: "purple",
  selected: "good",
  offer: "good",
  joined: "good",
  rejected: "bad",
  withdrawn: "neutral",
};

export function StageBadge({ stage }: { stage: string }) {
  return <Badge tone={STAGE_TONES[stage] ?? "neutral"}>{stageLabel(stage)}</Badge>;
}

const JOB_STATUS: Record<string, [string, Tone]> = {
  draft: ["Draft", "neutral"],
  pending_approval: ["Awaiting approval", "warn"],
  active: ["Active", "good"],
  paused: ["Paused", "neutral"],
  closed: ["Closed", "neutral"],
  rejected: ["Rejected", "bad"],
  suspended: ["Suspended", "bad"],
};
export function JobStatusBadge({ status }: { status: string }) {
  const [label, tone] = JOB_STATUS[status] ?? [status, "neutral"];
  return <Badge tone={tone}>{label}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  const tone: Record<string, Tone> = { issued: "info", paid: "good", overdue: "bad", void: "neutral", refunded: "warn" };
  return <Badge tone={tone[status] ?? "neutral"}>{labelOf(INVOICE_STATUSES, status)}</Badge>;
}

export function PlacementStatusBadge({ status }: { status: string }) {
  const tone: Record<string, Tone> = { pending_joining: "neutral", in_guarantee: "accent", fee_due: "warn", completed: "good", fee_waived: "neutral", cancelled: "bad" };
  return <Badge tone={tone[status] ?? "neutral"}>{labelOf(PLACEMENT_STATUSES, status)}</Badge>;
}

export function MatchScore({ score, eligible = true }: { score: number; eligible?: boolean }) {
  const tone: Tone = !eligible ? "warn" : score >= 80 ? "good" : score >= 60 ? "accent" : "neutral";
  return (
    <Badge tone={tone} title={eligible ? "Match score based on skills, experience, education, location, salary and notice period" : "Does not meet all mandatory requirements"}>
      {score}% match{eligible ? "" : " · requirements not met"}
    </Badge>
  );
}

export function MatchReasons({ reasons, failedMandatory = [] }: { reasons: MatchReason[]; failedMandatory?: string[] }) {
  const icon = { match: "✓", partial: "~", mismatch: "✕" } as const;
  const color = { match: "text-green-700 dark:text-green-400", partial: "text-amber-700 dark:text-amber-400", mismatch: "text-red-700 dark:text-red-400" } as const;
  return (
    <div className="space-y-2">
      {failedMandatory.length ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <span className="font-semibold">Mandatory requirements not met:</span> {failedMandatory.join("; ")}
        </p>
      ) : null}
      <ul className="space-y-1">
        {reasons.map((r) => (
          <li key={r.factor} className="flex gap-2 text-sm">
            <span aria-hidden className={cx("w-3 shrink-0 font-bold", color[r.status])}>
              {icon[r.status]}
            </span>
            <span className="text-ink-2">
              <span className="font-medium text-ink">{r.factor}:</span> {r.detail}
              <span className="sr-only"> ({r.status})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
