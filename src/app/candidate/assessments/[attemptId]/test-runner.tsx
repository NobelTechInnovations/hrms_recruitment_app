"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ActionState } from "@/lib/forms";
import { buttonClass, cx } from "@/components/ui";

type Q = { id: string; topic: string; text: string; options: string[] };

export function TestRunner({ action, questions, expiresAt, title }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; questions: Q[]; expiresAt: number; title: string }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [remaining, setRemaining] = useState(() => Math.max(0, expiresAt - Date.now()));
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    const t = setInterval(() => {
      const left = Math.max(0, expiresAt - Date.now());
      setRemaining(left);
      if (left === 0 && !submitted.current) {
        submitted.current = true;
        formRef.current?.requestSubmit();
      }
    }, 500);
    return () => clearInterval(t);
  }, [expiresAt]);

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const done = Object.keys(answered).length;

  return (
    <form ref={formRef} action={formAction} onSubmit={() => (submitted.current = true)}>
      <div className="sticky top-14 z-20 -mx-4 mb-6 flex items-center justify-between gap-4 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{title}</p>
          <p className="text-xs text-ink-2">
            {done} of {questions.length} answered
          </p>
        </div>
        <p role="timer" aria-live="off" className={cx("rounded-lg px-3 py-1.5 font-mono text-lg font-semibold [font-variant-numeric:tabular-nums]", remaining < 60_000 ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-subtle text-ink")}>
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </p>
      </div>
      {state?.error ? <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-100">{state.error}</p> : null}
      <ol className="space-y-5">
        {questions.map((q, i) => (
          <li key={q.id} className="rounded-xl border border-line bg-surface p-5">
            <fieldset>
              <legend className="text-sm text-ink">
                <span className="mr-2 text-xs font-medium uppercase tracking-wide text-ink-3">
                  Q{i + 1} · {q.topic}
                </span>
                <span className="mt-1 block text-base font-medium">{q.text}</span>
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.options.map((opt, idx) => (
                  <label key={idx} className="flex cursor-pointer items-start gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink hover:bg-subtle has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                    <input type="radio" name={`q_${q.id}`} value={idx} className="mt-0.5 accent-[var(--accent)]" onChange={() => setAnswered((a) => ({ ...a, [q.id]: true }))} />
                    {opt}
                  </label>
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("primary")}
          onClick={(e) => {
            if (done < questions.length && !window.confirm(`You've answered ${done} of ${questions.length} questions. Submit anyway?`)) e.preventDefault();
          }}
        >
          {pending ? "Submitting…" : "Submit answers"}
        </button>
      </div>
    </form>
  );
}
