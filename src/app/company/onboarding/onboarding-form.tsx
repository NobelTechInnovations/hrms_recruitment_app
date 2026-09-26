"use client";

import { createCompanyAction } from "@/actions/company";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Input, Select } from "@/components/ui";
import { COMPANY_SIZES, INDUSTRIES } from "@/lib/constants";

export function OnboardingForm({ defaultEmail }: { defaultEmail: string }) {
  return (
    <ActionForm action={createCompanyAction} className="grid gap-4 sm:grid-cols-2">
      <Field name="name" label="Company / organisation name" className="sm:col-span-2">
        <Input id="name" name="name" />
      </Field>
      <Field name="businessEmail" label="Official business email" hint="Candidate replies are routed here — it is never shown to candidates.">
        <Input id="businessEmail" name="businessEmail" type="email" defaultValue={defaultEmail} />
      </Field>
      <Field name="website" label="Official website" optional>
        <Input id="website" name="website" placeholder="https://" />
      </Field>
      <Field name="industry" label="Industry">
        <Select id="industry" name="industry" options={INDUSTRIES} placeholder="Select" />
      </Field>
      <Field name="size" label="Company size">
        <Select id="size" name="size" options={COMPANY_SIZES} placeholder="Select" />
      </Field>
      <Field name="city" label="City">
        <Input id="city" name="city" />
      </Field>
      <div className="flex items-end">
        <SubmitButton className="w-full">Create company workspace</SubmitButton>
      </div>
    </ActionForm>
  );
}
