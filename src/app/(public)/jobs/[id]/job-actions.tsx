"use client";

import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Select, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/forms";

type Action = (state: ActionState, fd: FormData) => Promise<ActionState>;

export function ApplyForm({ action, resumeOptions, source }: { action: Action; resumeOptions: { value: string; label: string }[]; source?: string }) {
  return (
    <ActionForm action={action} className="space-y-3">
      {source ? <input type="hidden" name="source" value={source} /> : null}
      <Field name="resume" label="Resume to send" hint={resumeOptions.length ? undefined : "You haven't built or uploaded a resume yet — your profile will be shared."}>
        <Select id="resume" name="resume" options={resumeOptions} placeholder={resumeOptions.length ? undefined : "Profile only"} />
      </Field>
      <Field name="coverNote" label="Note to the hiring team" optional>
        <Textarea id="coverNote" name="coverNote" rows={4} maxLength={2000} placeholder="Why are you a good fit? (Contact details will be removed — the company contacts you through the platform.)" />
      </Field>
      <SubmitButton className="w-full" pendingText="Submitting…">
        Apply now
      </SubmitButton>
    </ActionForm>
  );
}

export function ReportForm({ action }: { action: Action }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-ink-3 hover:text-ink">Report this job</summary>
      <ActionForm action={action} className="mt-3 space-y-2" resetOnSuccess>
        <Field name="reason" label="Reason">
          <Select
            id="reason"
            name="reason"
            placeholder="Choose a reason"
            options={[
              { value: "Misleading information", label: "Misleading information" },
              { value: "Asks for payment", label: "Asks candidates for payment" },
              { value: "Discriminatory", label: "Discriminatory requirements" },
              { value: "Duplicate or spam", label: "Duplicate or spam" },
              { value: "Other", label: "Other" },
            ]}
          />
        </Field>
        <Field name="details" label="Details" optional>
          <Textarea id="details" name="details" rows={2} />
        </Field>
        <SubmitButton variant="secondary" size="sm">
          Submit report
        </SubmitButton>
      </ActionForm>
    </details>
  );
}
