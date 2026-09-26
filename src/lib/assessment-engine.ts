// Platform screening (README §4): Level 1 aptitude, Level 2 industry/role assessment.

import type { TopicBreakdown } from "@/db/schema";

const DAY = 86_400_000;

function shuffle<T>(items: T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Draw `count` questions, spreading them evenly across topics. */
export function drawQuestions<T extends { id: string; topic: string }>(pool: T[], count: number, rng: () => number = Math.random): T[] {
  const byTopic = new Map<string, T[]>();
  for (const q of shuffle(pool, rng)) {
    const list = byTopic.get(q.topic) ?? [];
    list.push(q);
    byTopic.set(q.topic, list);
  }
  const buckets = shuffle([...byTopic.values()], rng);
  const out: T[] = [];
  while (out.length < count && buckets.some((b) => b.length > 0)) {
    for (const bucket of buckets) {
      const q = bucket.shift();
      if (q) out.push(q);
      if (out.length >= count) break;
    }
  }
  return out;
}

export function scoreAttempt(
  questions: { id: string; topic: string; correctIndex: number }[],
  answers: Record<string, number>,
): { correct: number; total: number; percent: number; breakdown: TopicBreakdown } {
  const breakdown: TopicBreakdown = {};
  let correct = 0;
  for (const q of questions) {
    const entry = (breakdown[q.topic] ??= { correct: 0, total: 0 });
    entry.total++;
    if (answers[q.id] === q.correctIndex) {
      entry.correct++;
      correct++;
    }
  }
  const total = questions.length;
  return { correct, total, percent: total === 0 ? 0 : Math.round((correct / total) * 100), breakdown };
}

export type AttemptEligibility = { ok: true } | { ok: false; reason: string; retryAt?: Date };

export function canStartAttempt(args: {
  level: number;
  level1Qualified: boolean;
  alreadyPassed: boolean;
  lastFailedAt: Date | null;
  cooldownDays: number;
  now?: Date;
}): AttemptEligibility {
  const now = args.now ?? new Date();
  if (args.alreadyPassed) return { ok: false, reason: "You have already qualified in this assessment." };
  if (args.level === 2 && !args.level1Qualified) return { ok: false, reason: "Qualify in the Level 1 aptitude assessment first." };
  if (args.lastFailedAt) {
    const retryAt = new Date(args.lastFailedAt.getTime() + args.cooldownDays * DAY);
    if (retryAt > now) return { ok: false, reason: `You can retake this assessment after the ${args.cooldownDays}-day cooldown.`, retryAt };
  }
  return { ok: true };
}
