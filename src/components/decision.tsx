"use client";

import { ActionButton, ActionForm, Field, SubmitButton } from "./forms";
import type { ActionState } from "@/lib/forms";

type Action = (s: ActionState, fd: FormData) => Promise<ActionState>;

/** Approve with one click; reject (or suspend) with a mandatory note. */
export function DecisionForms({ approve, reject, approveLabel = "Approve", rejectLabel = "Reject", notePlaceholder }: { approve?: Action; reject?: Action; approveLabel?: string; rejectLabel?: string; notePlaceholder?: string }) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      {approve ? (
        <ActionButton action={approve} variant="primary">
          {approveLabel}
        </ActionButton>
      ) : null}
      {reject ? (
        <details className="group">
          <summary className="inline-flex cursor-pointer list-none items-center rounded-lg border border-line-strong px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-subtle">{rejectLabel}…</summary>
          <ActionForm action={reject} className="mt-2 w-72 space-y-2">
            <Field name="note" label="Reason (shared with the user)">
              <textarea name="note" rows={2} className="input" placeholder={notePlaceholder} />
            </Field>
            <SubmitButton variant="danger" size="sm">
              Confirm {rejectLabel.toLowerCase()}
            </SubmitButton>
          </ActionForm>
        </details>
      ) : null}
    </div>
  );
}
