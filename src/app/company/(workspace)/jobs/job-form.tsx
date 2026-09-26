"use client";

import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { CheckboxField, Input, Select, Textarea } from "@/components/ui";
import { EDUCATION_LEVELS, EMPLOYMENT_TYPES, INDUSTRIES, WORK_MODES } from "@/lib/constants";
import type { ActionState } from "@/lib/forms";

type JobField =
  | "title" | "department" | "industry" | "location" | "workMode" | "employmentType" | "minExperience" | "maxExperience"
  | "educationLevel" | "requiredSkills" | "preferredSkills" | "description" | "responsibilities" | "minCtc" | "maxCtc"
  | "incentives" | "benefits" | "vacancies" | "joiningWithinDays" | "maxNoticePeriodDays" | "interviewProcess"
  | "interviewRequirements" | "minCurrentCtc";

export type JobDefaults = { [K in JobField]: string } & {
  mandatory: { experience: boolean; noticePeriod: boolean; education: boolean; requireLevel1: boolean; requireLevel2: boolean; requireIdentityVerified: boolean };
};

function Group({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 border-t border-line pt-5 first:border-0 first:pt-0 md:grid-cols-[13rem_1fr]">
      <legend className="sr-only">{title}</legend>
      <div>
        <p className="font-medium text-ink">{title}</p>
        {description ? <p className="mt-1 text-sm text-ink-2">{description}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function JobForm({ action, d, isNew }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; d: JobDefaults; isNew: boolean }) {
  return (
    <ActionForm action={action} className="space-y-6">
      <Group title="Job information">
        <Field name="title" label="Job title">
          <Input id="title" name="title" defaultValue={d.title} placeholder="e.g. Senior Backend Engineer" />
        </Field>
        <Field name="department" label="Department" optional>
          <Input id="department" name="department" defaultValue={d.department} />
        </Field>
        <Field name="industry" label="Industry">
          <Select id="industry" name="industry" defaultValue={d.industry} options={INDUSTRIES} />
        </Field>
        <Field name="employmentType" label="Employment type">
          <Select id="employmentType" name="employmentType" defaultValue={d.employmentType || "full_time"} options={EMPLOYMENT_TYPES} />
        </Field>
        <Field name="location" label="Job location">
          <Input id="location" name="location" defaultValue={d.location} placeholder="City, or Remote" />
        </Field>
        <Field name="workMode" label="Remote / Hybrid / On-site">
          <Select id="workMode" name="workMode" defaultValue={d.workMode || "hybrid"} options={WORK_MODES} />
        </Field>
        <Field name="vacancies" label="Number of vacancies">
          <Input id="vacancies" name="vacancies" type="number" min={1} defaultValue={d.vacancies || "1"} />
        </Field>
      </Group>
      <Group title="Requirements">
        <Field name="minExperience" label="Minimum experience (years)">
          <Input id="minExperience" name="minExperience" type="number" min={0} step="0.5" defaultValue={d.minExperience || "0"} />
        </Field>
        <Field name="maxExperience" label="Maximum experience (years)" optional>
          <Input id="maxExperience" name="maxExperience" type="number" min={0} step="0.5" defaultValue={d.maxExperience} />
        </Field>
        <Field name="educationLevel" label="Education requirement">
          <Select id="educationLevel" name="educationLevel" defaultValue={d.educationLevel || "any"} options={EDUCATION_LEVELS} />
        </Field>
        <div />
        <Field name="requiredSkills" label="Required skills" hint="Comma separated" className="sm:col-span-2">
          <Input id="requiredSkills" name="requiredSkills" defaultValue={d.requiredSkills} placeholder="Node.js, PostgreSQL, AWS" />
        </Field>
        <Field name="preferredSkills" label="Preferred skills" optional hint="Comma separated" className="sm:col-span-2">
          <Input id="preferredSkills" name="preferredSkills" defaultValue={d.preferredSkills} />
        </Field>
      </Group>
      <Group title="Description">
        <Field name="description" label="Job description" className="sm:col-span-2">
          <Textarea id="description" name="description" defaultValue={d.description} rows={5} />
        </Field>
        <Field name="responsibilities" label="Responsibilities" optional hint="One per line" className="sm:col-span-2">
          <Textarea id="responsibilities" name="responsibilities" defaultValue={d.responsibilities} rows={4} />
        </Field>
      </Group>
      <Group title="Compensation" description="CTC in lakhs per annum (LPA). Used for CTC matching with candidates' expectations.">
        <Field name="minCtc" label="Minimum CTC (LPA)" optional>
          <Input id="minCtc" name="minCtc" type="number" min={0} step="0.1" defaultValue={d.minCtc} />
        </Field>
        <Field name="maxCtc" label="Maximum CTC (LPA)" optional>
          <Input id="maxCtc" name="maxCtc" type="number" min={0} step="0.1" defaultValue={d.maxCtc} />
        </Field>
        <Field name="incentives" label="Incentives" optional>
          <Input id="incentives" name="incentives" defaultValue={d.incentives} />
        </Field>
        <Field name="benefits" label="Benefits" optional>
          <Input id="benefits" name="benefits" defaultValue={d.benefits} />
        </Field>
      </Group>
      <Group title="Joining & interviews">
        <Field name="joiningWithinDays" label="Joining timeline (days)" optional hint="How soon the hire should join">
          <Input id="joiningWithinDays" name="joiningWithinDays" type="number" min={0} defaultValue={d.joiningWithinDays} />
        </Field>
        <Field name="maxNoticePeriodDays" label="Maximum notice period (days)" optional>
          <Input id="maxNoticePeriodDays" name="maxNoticePeriodDays" type="number" min={0} defaultValue={d.maxNoticePeriodDays} />
        </Field>
        <Field name="interviewProcess" label="Interview process" optional className="sm:col-span-2">
          <Textarea id="interviewProcess" name="interviewProcess" defaultValue={d.interviewProcess} rows={2} placeholder="Screening → Technical → HR" />
        </Field>
        <Field name="interviewRequirements" label="Interview requirements" optional className="sm:col-span-2">
          <Input id="interviewRequirements" name="interviewRequirements" defaultValue={d.interviewRequirements} placeholder="e.g. Laptop with camera, portfolio" />
        </Field>
      </Group>
      <Group title="Mandatory requirements" description="Candidates who don't meet these are flagged, so the platform can automatically identify relevant candidates.">
        <div className="space-y-3 sm:col-span-2">
          <CheckboxField name="mandatoryExperience" defaultChecked={d.mandatory.experience} label="Minimum experience is mandatory" description="e.g. Minimum 2 years experience" />
          <CheckboxField name="mandatoryNoticePeriod" defaultChecked={d.mandatory.noticePeriod} label="Maximum notice period is mandatory" description="e.g. Maximum notice period 30 days" />
          <CheckboxField name="mandatoryEducation" defaultChecked={d.mandatory.education} label="Education requirement is mandatory" description="e.g. MBA / Graduate required" />
          <CheckboxField name="requireLevel1" defaultChecked={d.mandatory.requireLevel1} label="Require Level 1 aptitude qualification" />
          <CheckboxField name="requireLevel2" defaultChecked={d.mandatory.requireLevel2} label="Require Level 2 qualification in this industry" />
          <CheckboxField name="requireIdentityVerified" defaultChecked={d.mandatory.requireIdentityVerified} label="Require verified identity" />
        </div>
        <Field name="minCurrentCtc" label="Minimum current CTC (LPA)" optional hint="e.g. Minimum CTC ₹5 LPA">
          <Input id="minCurrentCtc" name="minCurrentCtc" type="number" min={0} step="0.1" defaultValue={d.minCurrentCtc} />
        </Field>
      </Group>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        {isNew ? (
          <>
            <SubmitButton variant="secondary" name="intent" value="draft">
              Save as draft
            </SubmitButton>
            <SubmitButton name="intent" value="publish">
              Publish job
            </SubmitButton>
          </>
        ) : (
          <SubmitButton>Save changes</SubmitButton>
        )}
      </div>
    </ActionForm>
  );
}
