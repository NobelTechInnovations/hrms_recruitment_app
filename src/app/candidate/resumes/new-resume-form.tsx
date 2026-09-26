"use client";

import { createResumeAction } from "@/actions/candidate";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Input, Select } from "@/components/ui";

export const TEMPLATES = [
  { value: "classic", label: "Classic — serif, centred" },
  { value: "modern", label: "Modern — accent colour" },
  { value: "compact", label: "Compact — fits more on a page" },
  { value: "executive", label: "Executive — dark header" },
];

export function NewResumeForm({ defaultHeadline }: { defaultHeadline: string }) {
  return (
    <ActionForm action={createResumeAction} className="space-y-3">
      <Field name="title" label="Resume name">
        <Input id="title" name="title" placeholder="e.g. IT Resume" />
      </Field>
      <Field name="targetRole" label="Target role" optional>
        <Input id="targetRole" name="targetRole" placeholder="e.g. Backend Engineer" />
      </Field>
      <input type="hidden" name="headline" value={defaultHeadline} />
      <Field name="template" label="Template">
        <Select id="template" name="template" options={TEMPLATES} defaultValue="modern" />
      </Field>
      <SubmitButton className="w-full">Create resume</SubmitButton>
    </ActionForm>
  );
}
