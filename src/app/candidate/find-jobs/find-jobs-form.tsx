"use client";

import { saveFindJobsAction } from "@/actions/candidate";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Input, Select, Textarea } from "@/components/ui";
import { INDUSTRIES } from "@/lib/constants";

export function FindJobsForm({ d, active }: { d: Record<string, string>; active: boolean }) {
  return (
    <ActionForm action={saveFindJobsAction} className="grid gap-4 sm:grid-cols-2">
      <Field name="desiredRole" label="Desired role">
        <Input id="desiredRole" name="desiredRole" defaultValue={d.desiredRole} placeholder="e.g. Sales Manager" />
      </Field>
      <Field name="preferredLocations" label="Preferred locations" hint="Comma separated">
        <Input id="preferredLocations" name="preferredLocations" defaultValue={d.preferredLocations} />
      </Field>
      <Field name="expectedCtc" label="Expected CTC (LPA)">
        <Input id="expectedCtc" name="expectedCtc" type="number" min={0} step="0.1" defaultValue={d.expectedCtc} />
      </Field>
      <Field name="experienceYears" label="Experience (years)">
        <Input id="experienceYears" name="experienceYears" type="number" min={0} step="0.5" defaultValue={d.experienceYears} />
      </Field>
      <Field name="preferredIndustry" label="Preferred industry">
        <Select id="preferredIndustry" name="preferredIndustry" defaultValue={d.preferredIndustry} options={INDUSTRIES} placeholder="Any" />
      </Field>
      <Field name="workMode" label="Remote / hybrid preference">
        <Select
          id="workMode"
          name="workMode"
          defaultValue={d.workMode || "any"}
          options={[
            { value: "any", label: "Any" },
            { value: "remote", label: "Remote" },
            { value: "hybrid", label: "Hybrid" },
            { value: "onsite", label: "On-site" },
          ]}
        />
      </Field>
      <Field name="joiningAvailabilityDays" label="Can join within (days)">
        <Input id="joiningAvailabilityDays" name="joiningAvailabilityDays" type="number" min={0} max={180} defaultValue={d.joiningAvailabilityDays} />
      </Field>
      <Field name="applyMode" label="When we find a match">
        <Select
          id="applyMode"
          name="applyMode"
          defaultValue={d.applyMode || "ask_first"}
          options={[
            { value: "ask_first", label: "Ask me before applying (recommended)" },
            { value: "auto_apply", label: "Apply on my behalf automatically" },
          ]}
        />
      </Field>
      <Field name="notes" label="Anything else our recruitment team should know?" optional className="sm:col-span-2">
        <Textarea id="notes" name="notes" defaultValue={d.notes} rows={2} />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Matching…">{active ? "Update preferences" : "Activate Find Jobs For Me"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
