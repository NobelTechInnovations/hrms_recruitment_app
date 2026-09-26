"use client";

import { ActionForm, SubmitButton } from "./forms";
import type { ActionState } from "@/lib/forms";

export function MessageComposer({ action, placeholder, disabled }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; placeholder?: string; disabled?: boolean }) {
  return (
    <ActionForm action={action} resetOnSuccess className="space-y-2">
      <label htmlFor="body" className="sr-only">
        Message
      </label>
      <textarea id="body" name="body" rows={3} maxLength={5000} disabled={disabled} placeholder={placeholder ?? "Write a message…"} className="input" />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-3">Phone numbers, personal emails and messaging-app handles are removed automatically.</p>
        <SubmitButton size="sm">Send</SubmitButton>
      </div>
    </ActionForm>
  );
}
