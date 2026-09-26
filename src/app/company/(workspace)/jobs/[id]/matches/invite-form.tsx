"use client";

import { ActionForm, SubmitButton } from "@/components/forms";
import type { ActionState } from "@/lib/forms";

export function InviteForm({ action, jobId, label = "Invite to apply", placeholder = "Optional note (why they're a fit)" }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; jobId: string; label?: string; placeholder?: string }) {
  return (
    <ActionForm action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="jobId" value={jobId} />
      <label className="sr-only" htmlFor={`msg-${jobId}`}>
        Message
      </label>
      <input id={`msg-${jobId}`} name="message" className="input max-w-sm flex-1" placeholder={placeholder} maxLength={300} />
      <SubmitButton size="sm">{label}</SubmitButton>
    </ActionForm>
  );
}
