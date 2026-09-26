import type { Metadata } from "next";
import { CandidateVerificationBadges, ScreeningBadges, VerificationLevelBadge } from "@/components/badges";
import { Card, CardBody, CardHeader, Checklist, Meter, PageHeader } from "@/components/ui";
import { labelOf, INDUSTRIES } from "@/lib/constants";
import { VERIFICATION_LEVEL_DESCRIPTIONS, VERIFICATION_LEVEL_LABELS, type VerificationLevel } from "@/lib/profile-score";
import { requireCandidate } from "@/server/auth";
import { loadCandidateBundle, scoreFor } from "@/server/queries";
import { cx } from "@/components/ui";

export const metadata: Metadata = { title: "Profile score" };

const LEVELS: VerificationLevel[] = ["basic", "identity", "professional", "full"];

export default async function ScorePage() {
  const { candidate } = await requireCandidate();
  const b = (await loadCandidateBundle(candidate.id))!;
  const score = scoreFor(b);
  const reached = LEVELS.indexOf(score.level as VerificationLevel);
  return (
    <div className="space-y-6">
      <PageHeader title="Profile score" description="A transparent view of what companies see — specific verified facts and assessment results, not an opaque “AI hiring score”." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile completion" />
          <CardBody className="space-y-4">
            <p className="text-5xl font-semibold text-ink">{score.completion}%</p>
            <Meter value={score.completion} label="Profile completion" showValue={false} />
            <Checklist items={score.completionItems} />
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Verification" action={<VerificationLevelBadge level={score.level} />} />
            <CardBody className="space-y-4">
              <Checklist items={score.verification} />
              <CandidateVerificationBadges candidate={candidate} />
              <ol className="space-y-2 border-t border-line pt-4">
                {LEVELS.map((lvl, i) => (
                  <li key={lvl} className="flex items-start gap-3 text-sm">
                    <span aria-hidden className={cx("mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", i <= reached ? "bg-green-600 text-white" : "bg-subtle text-ink-3")}>
                      {i + 1}
                    </span>
                    <span>
                      <span className={cx("font-medium", i <= reached ? "text-ink" : "text-ink-2")}>{VERIFICATION_LEVEL_LABELS[lvl]}</span>
                      <span className="block text-ink-2">{VERIFICATION_LEVEL_DESCRIPTIONS[lvl]}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Screening" />
            <CardBody className="space-y-3">
              <Checklist items={score.screening} />
              <ScreeningBadges candidate={candidate} />
              <p className="text-sm text-ink-2">
                {candidate.level1Score != null ? `Level 1 score: ${candidate.level1Score}%. ` : ""}
                {candidate.level2Score != null ? `Level 2 (${labelOf(INDUSTRIES, candidate.level2Category)}) score: ${candidate.level2Score}%.` : ""}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Professional profile" />
            <CardBody>
              <Checklist items={score.professional} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
