// Interview AI Assistant — deterministic summary of structured interviewer feedback
// (README §17). The platform summarises; the employer always makes the final decision.

export type FeedbackInput = {
  interviewTitle: string;
  interviewer: string;
  technical: number;
  communication: number;
  roleFit: number;
  experience: number;
  recommendation: "strong_yes" | "yes" | "maybe" | "no";
  strengths?: string | null;
  concerns?: string | null;
  salaryNotes?: string | null;
  availabilityNotes?: string | null;
};

export const DECISION_DISCLAIMER = "This summary supports — but does not replace — the hiring team's judgement. The final hiring decision rests with the employer.";

const RECOMMENDATION_LABEL: Record<FeedbackInput["recommendation"], string> = {
  strong_yes: "strong yes",
  yes: "yes",
  maybe: "maybe",
  no: "no",
};

function band(score: number): string {
  if (score >= 4.5) return "Excellent";
  if (score >= 3.5) return "Strong";
  if (score >= 2.5) return "Adequate";
  if (score >= 1.5) return "Weak";
  return "Poor";
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fmt = (n: number) => n.toFixed(1);

export function averageScores(entries: Pick<FeedbackInput, "technical" | "communication" | "roleFit" | "experience">[]) {
  return {
    technical: avg(entries.map((e) => e.technical)),
    communication: avg(entries.map((e) => e.communication)),
    roleFit: avg(entries.map((e) => e.roleFit)),
    experience: avg(entries.map((e) => e.experience)),
  };
}

export function summarizeFeedbackRules(entries: FeedbackInput[], ctx: { candidateName: string; jobTitle: string }): string {
  if (entries.length === 0) return "No interview feedback has been submitted yet.";
  const a = averageScores(entries);
  const overall = avg([a.technical, a.communication, a.roleFit, a.experience]);

  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.recommendation, (counts.get(e.recommendation) ?? 0) + 1);
  const consensus = [...counts.entries()]
    .sort((x, y) => y[1] - x[1])
    .map(([k, n]) => `${n}× ${RECOMMENDATION_LABEL[k as FeedbackInput["recommendation"]]}`)
    .join(", ");

  const collect = (pick: (e: FeedbackInput) => string | null | undefined) =>
    entries
      .map((e) => ({ text: pick(e)?.trim(), who: e.interviewer }))
      .filter((x): x is { text: string; who: string } => !!x.text)
      .map((x) => `${x.text} (${x.who})`);

  const lines: string[] = [];
  lines.push(
    `${ctx.candidateName} — ${ctx.jobTitle}: ${entries.length} interview${entries.length === 1 ? "" : "s"} reviewed, overall ${fmt(overall)}/5 (${band(overall)}). Interviewer recommendations: ${consensus}.`,
  );
  lines.push("");
  lines.push(`• Technical skills: ${fmt(a.technical)}/5 — ${band(a.technical)}`);
  lines.push(`• Communication: ${fmt(a.communication)}/5 — ${band(a.communication)}`);
  lines.push(`• Role fit: ${fmt(a.roleFit)}/5 — ${band(a.roleFit)}`);
  lines.push(`• Experience: ${fmt(a.experience)}/5 — ${band(a.experience)}`);

  const strengths = collect((e) => e.strengths);
  const concerns = collect((e) => e.concerns);
  const salary = collect((e) => e.salaryNotes);
  const availability = collect((e) => e.availabilityNotes);
  if (strengths.length) lines.push("", `Strengths: ${strengths.join("; ")}`);
  if (concerns.length) lines.push("", `Concerns: ${concerns.join("; ")}`);
  lines.push("", `Salary expectations: ${salary.length ? salary.join("; ") : "not discussed"}`);
  lines.push(`Joining availability: ${availability.length ? availability.join("; ") : "not discussed"}`);

  const weakest = (Object.entries(a) as [string, number][]).sort((x, y) => x[1] - y[1])[0]!;
  const labels: Record<string, string> = { technical: "technical skills", communication: "communication", roleFit: "role fit", experience: "experience" };
  if (weakest[1] < 3) lines.push("", `Suggested follow-up: probe ${labels[weakest[0]]} further before deciding.`);

  lines.push("", DECISION_DISCLAIMER);
  return lines.join("\n");
}
