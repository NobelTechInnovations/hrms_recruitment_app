// Hiring pipeline rules (README §10):
// Applied → Screening → Shortlisted → Assessment → Interview 1 → Interview 2 → HR Interview → Selected → Offer → Joined

import { ALL_STAGES, PIPELINE_STAGES, labelOf, type ApplicationStage } from "./constants";

const ORDER = PIPELINE_STAGES.map((s) => s.value) as string[];

export function stageIndex(stage: string): number {
  return ORDER.indexOf(stage);
}

export function isTerminal(stage: string): boolean {
  return stage === "rejected" || stage === "withdrawn" || stage === "joined";
}

export function stageLabel(stage: string): string {
  return labelOf(ALL_STAGES, stage);
}

export type Actor = "company" | "candidate";

export function canTransition(from: string, to: string, actor: Actor): { ok: true } | { ok: false; reason: string } {
  if (from === to) return { ok: false, reason: "The application is already at this stage." };
  if (isTerminal(from)) return { ok: false, reason: `The application is already ${stageLabel(from).toLowerCase()}.` };

  if (actor === "candidate") {
    return to === "withdrawn" ? { ok: true } : { ok: false, reason: "Candidates can only withdraw an application." };
  }

  if (to === "withdrawn") return { ok: false, reason: "Only the candidate can withdraw an application." };
  if (to === "rejected") return { ok: true };
  if (stageIndex(to) < 0) return { ok: false, reason: "Unknown stage." };

  const fromIdx = stageIndex(from);
  const toIdx = stageIndex(to);
  // Once selected, the placement record exists — only move forward in order.
  if (fromIdx >= stageIndex("selected") && toIdx < fromIdx) {
    return { ok: false, reason: "A selected candidate can't be moved back to an earlier stage. Reject instead." };
  }
  if (to === "offer" && from !== "selected") return { ok: false, reason: "Mark the candidate as Selected before making an offer." };
  if (to === "joined" && from !== "offer") return { ok: false, reason: "The candidate must have an offer before joining." };
  return { ok: true };
}

export function allowedNextStages(from: string): ApplicationStage[] {
  return ALL_STAGES.map((s) => s.value).filter((to) => canTransition(from, to, "company").ok) as ApplicationStage[];
}

/** Candidate-facing notification text for a stage change. */
export function stageMessage(stage: string, jobTitle: string, companyName: string): { title: string; body: string } {
  const role = `${jobTitle} at ${companyName}`;
  switch (stage) {
    case "screening":
      return { title: "Your application is being screened", body: `${companyName} has started reviewing your application for ${jobTitle}.` };
    case "shortlisted":
      return { title: "Your application has been shortlisted.", body: `Great news — you've been shortlisted for ${role}.` };
    case "assessment":
      return { title: "Assessment stage", body: `${companyName} has moved you to the assessment stage for ${jobTitle}.` };
    case "interview_1":
    case "interview_2":
    case "hr_interview":
      return { title: `Moved to ${stageLabel(stage)}`, body: `You've progressed to the ${stageLabel(stage)} round for ${role}.` };
    case "selected":
      return { title: "You've been selected! 🎉", body: `${companyName} has selected you for ${jobTitle}. An offer will follow.` };
    case "offer":
      return { title: "You have an offer", body: `${companyName} has made you an offer for ${jobTitle}.` };
    case "joined":
      return { title: "Welcome aboard", body: `Congratulations on joining ${companyName} as ${jobTitle}.` };
    case "rejected":
      return { title: "Application update", body: `${companyName} has decided not to move forward with your application for ${jobTitle}.` };
    default:
      return { title: "Application update", body: `Your application for ${role} moved to ${stageLabel(stage)}.` };
  }
}
