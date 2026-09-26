import { describe, expect, it } from "vitest";
import { canStartAttempt, drawQuestions, scoreAttempt } from "@/lib/assessment-engine";

function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const pool = ["Logic", "Quant", "Verbal"].flatMap((topic) => Array.from({ length: 5 }, (_, i) => ({ id: `${topic}-${i}`, topic, correctIndex: i % 4 })));

describe("drawQuestions", () => {
  it("spreads questions across topics without duplicates", () => {
    const qs = drawQuestions(pool, 9, seeded(42));
    expect(qs).toHaveLength(9);
    expect(new Set(qs.map((q) => q.id)).size).toBe(9);
    for (const topic of ["Logic", "Quant", "Verbal"]) expect(qs.filter((q) => q.topic === topic)).toHaveLength(3);
  });
  it("returns the whole pool when asked for more than exists", () => {
    expect(drawQuestions(pool, 50, seeded(1))).toHaveLength(15);
  });
});

describe("scoreAttempt", () => {
  it("scores and breaks down by topic", () => {
    const qs = pool.slice(0, 5);
    const answers = { "Logic-0": 0, "Logic-1": 1, "Logic-2": 0 };
    const r = scoreAttempt(qs, answers);
    expect(r).toMatchObject({ correct: 2, total: 5, percent: 40 });
    expect(r.breakdown.Logic).toEqual({ correct: 2, total: 5 });
  });
});

describe("canStartAttempt", () => {
  const now = new Date("2026-09-10T00:00:00Z");
  it("requires level 1 before level 2", () => {
    expect(canStartAttempt({ level: 2, level1Qualified: false, alreadyPassed: false, lastFailedAt: null, cooldownDays: 7, now }).ok).toBe(false);
  });
  it("enforces the retake cooldown", () => {
    const r = canStartAttempt({ level: 1, level1Qualified: false, alreadyPassed: false, lastFailedAt: new Date("2026-09-08T00:00:00Z"), cooldownDays: 7, now });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryAt?.toISOString()).toBe("2026-09-15T00:00:00.000Z");
    expect(canStartAttempt({ level: 1, level1Qualified: false, alreadyPassed: false, lastFailedAt: new Date("2026-09-01T00:00:00Z"), cooldownDays: 7, now }).ok).toBe(true);
  });
  it("blocks re-taking a passed assessment", () => {
    expect(canStartAttempt({ level: 1, level1Qualified: true, alreadyPassed: true, lastFailedAt: null, cooldownDays: 7, now }).ok).toBe(false);
  });
});
