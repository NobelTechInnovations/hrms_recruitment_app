"use client";

import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Select } from "@/components/ui";
import type { ActionState } from "@/lib/forms";

export function UploadDocumentForm({ action, options, defaultType }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; options: readonly { value: string; label: string }[]; defaultType?: string }) {
  return (
    <ActionForm action={action} encType="multipart/form-data" resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field name="docType" label="Document type">
        <Select id="docType" name="docType" options={options} defaultValue={defaultType} placeholder="Choose…" />
      </Field>
      <Field name="file" label="File" hint="PDF, JPG, PNG or WebP · max 5 MB">
        <input id="file" name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-md file:border-0 file:bg-subtle file:px-3 file:py-1.5 file:text-sm file:text-ink" />
      </Field>
      <SubmitButton pendingText="Uploading…">Upload</SubmitButton>
    </ActionForm>
  );
}
