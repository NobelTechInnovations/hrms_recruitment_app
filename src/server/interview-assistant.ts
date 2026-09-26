import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { DECISION_DISCLAIMER, summarizeFeedbackRules, type FeedbackInput } from "@/lib/interview-summary";

const MODEL = process.env.INTERVIEW_ASSISTANT_MODEL ?? "claude-opus-5";

const SYSTEM_PROMPT = `You help recruiters digest structured interview feedback.
Write a concise summary (under 220 words) for the hiring team covering, in this order:
technical skills, communication, role fit, experience, salary expectations, joining availability.
Base every statement strictly on the feedback provided; if something was not discussed, say so.
Do not recommend hiring or rejecting and do not rank the candidate against others — the employer makes the final decision.
Do not mention or infer protected characteristics (age, gender, religion, caste, disability, marital status, etc.).
Use plain text with short bullet points.`;

export type SummaryResult = { summary: string; source: "rules" | "claude" };

/**
 * Summarise interview feedback. Uses Claude when ANTHROPIC_API_KEY is configured and
 * falls back to the deterministic rule-based summary otherwise (or on any API failure).
 */
export async function summarizeInterviewFeedback(entries: FeedbackInput[], ctx: { candidateName: string; jobTitle: string }): Promise<SummaryResult> {
  const fallback: SummaryResult = { summary: summarizeFeedbackRules(entries, ctx), source: "rules" };
  if (!process.env.ANTHROPIC_API_KEY || entries.length === 0) return fallback;

  try {
    const client = new Anthropic({ timeout: 60_000 });
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      // Re-run on a fallback model if the primary declines, instead of failing the request.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Candidate: ${ctx.candidateName}\nRole: ${ctx.jobTitle}\n\nInterview feedback (ratings are 1–5):\n${JSON.stringify(entries, null, 2)}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") return fallback;
    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("\n")
      .trim();
    if (!text) return fallback;
    return { summary: `${text}\n\n${DECISION_DISCLAIMER}`, source: "claude" };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`[interview-assistant] Claude API error ${error.status}: ${error.message}`);
    } else {
      console.error("[interview-assistant] Claude request failed", error);
    }
    return fallback;
  }
}
