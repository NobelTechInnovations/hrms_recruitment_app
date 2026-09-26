import { PIPELINE_STAGES } from "@/lib/constants";
import { stageIndex, stageLabel } from "@/lib/pipeline";
import { cx } from "./ui";

export function PipelineProgress({ stage, history }: { stage: string; history: { toStage: string }[] }) {
  const terminal = stage === "rejected" || stage === "withdrawn";
  const reached = terminal ? Math.max(-1, ...history.map((h) => stageIndex(h.toStage))) : stageIndex(stage);
  return (
    <div>
      <ol className="flex flex-wrap gap-y-3" aria-label="Hiring pipeline">
        {PIPELINE_STAGES.map((s, i) => {
          const done = i < reached || (i === reached && s.value === "joined");
          const current = i === reached && !terminal && s.value !== "joined";
          return (
            <li key={s.value} className="flex items-center" aria-current={current ? "step" : undefined}>
              <span
                className={cx(
                  "whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
                  done && "bg-green-50 text-green-800 dark:bg-green-950/50 dark:text-green-200",
                  current && "bg-accent text-white dark:text-black",
                  !done && !current && "bg-subtle text-ink-3",
                  terminal && i === reached && "ring-1 ring-red-300",
                )}
              >
                {done ? "✓ " : ""}
                {s.label}
              </span>
              {i < PIPELINE_STAGES.length - 1 ? <span aria-hidden className="mx-1 text-ink-3">→</span> : null}
            </li>
          );
        })}
      </ol>
      {terminal ? <p className="mt-3 text-sm font-medium text-red-700 dark:text-red-300">{stageLabel(stage)}</p> : null}
    </div>
  );
}
