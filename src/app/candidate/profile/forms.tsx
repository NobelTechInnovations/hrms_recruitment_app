"use client";

import { useState } from "react";
import { addCertificationAction, addEducationAction, addExperienceAction, addProjectAction, updateProfileAction, uploadPhotoAction } from "@/actions/candidate";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Input, Select, Textarea } from "@/components/ui";
import { AVAILABILITY, EDUCATION_LEVELS, GENDERS, INDUSTRIES } from "@/lib/constants";

export type ProfileDefaults = {
  fullName: string;
  headline: string;
  summary: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  currentLocation: string;
  preferredLocations: string;
  industry: string;
  currentCompany: string;
  currentDesignation: string;
  experienceYears: string;
  currentCtc: string;
  expectedCtc: string;
  noticePeriodDays: string;
  availability: string;
  workModePreference: string;
  skills: string;
  languages: string;
  linkedinUrl: string;
  portfolioUrl: string;
  otherProfileUrl: string;
};

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 border-t border-line pt-5 first:border-0 first:pt-0 md:grid-cols-[14rem_1fr]">
      <legend className="sr-only">{title}</legend>
      <div>
        <p className="font-medium text-ink">{title}</p>
        {description ? <p className="mt-1 text-sm text-ink-2">{description}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function ProfileForm({ d }: { d: ProfileDefaults }) {
  const [availability, setAvailability] = useState(d.availability);
  return (
    <ActionForm action={updateProfileAction} className="space-y-6">
      <Section title="Basics" description="Your name and headline are visible to verified companies. Contact details never are.">
        <Field name="fullName" label="Full name">
          <Input id="fullName" name="fullName" defaultValue={d.fullName} required />
        </Field>
        <Field name="headline" label="Professional headline" optional>
          <Input id="headline" name="headline" defaultValue={d.headline} placeholder="e.g. Senior Backend Engineer · Node.js" />
        </Field>
        <Field name="summary" label="Summary" optional className="sm:col-span-2">
          <Textarea id="summary" name="summary" defaultValue={d.summary} rows={4} />
        </Field>
        <Field name="dateOfBirth" label="Date of birth" optional hint="Not shown to companies.">
          <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={d.dateOfBirth} />
        </Field>
        <Field name="gender" label="Gender" optional hint="Collected only where legally appropriate; never shown to companies.">
          <Select id="gender" name="gender" defaultValue={d.gender} options={GENDERS} />
        </Field>
        <Field name="phone" label="Mobile number" optional hint="For SMS/WhatsApp alerts only. Never shared.">
          <Input id="phone" name="phone" type="tel" defaultValue={d.phone} placeholder="+91 98765 43210" />
        </Field>
      </Section>
      <Section title="Location & preferences">
        <Field name="currentLocation" label="Current location">
          <Input id="currentLocation" name="currentLocation" defaultValue={d.currentLocation} placeholder="City" />
        </Field>
        <Field name="preferredLocations" label="Preferred locations" hint="Comma separated. Use “Anywhere” if flexible.">
          <Input id="preferredLocations" name="preferredLocations" defaultValue={d.preferredLocations} />
        </Field>
        <Field name="workModePreference" label="Work mode preference">
          <Select
            id="workModePreference"
            name="workModePreference"
            defaultValue={d.workModePreference}
            options={[
              { value: "any", label: "Any" },
              { value: "remote", label: "Remote" },
              { value: "hybrid", label: "Hybrid" },
              { value: "onsite", label: "On-site" },
            ]}
          />
        </Field>
        <Field name="industry" label="Industry / career category" hint="Determines your Level 2 assessment track.">
          <Select id="industry" name="industry" defaultValue={d.industry} options={INDUSTRIES} placeholder="Select" />
        </Field>
      </Section>
      <Section title="Current work">
        <Field name="currentCompany" label="Current company" optional>
          <Input id="currentCompany" name="currentCompany" defaultValue={d.currentCompany} />
        </Field>
        <Field name="currentDesignation" label="Current designation" optional>
          <Input id="currentDesignation" name="currentDesignation" defaultValue={d.currentDesignation} />
        </Field>
        <Field name="experienceYears" label="Total experience (years)" hint="Use 0 if you're a fresher.">
          <Input id="experienceYears" name="experienceYears" type="number" min={0} max={50} step="0.5" defaultValue={d.experienceYears} />
        </Field>
      </Section>
      <Section title="Compensation & availability" description="CTC in lakhs per annum (LPA). Used for CTC matching; companies see it only if you apply or appear in their search.">
        <Field name="currentCtc" label="Current CTC (LPA)" optional>
          <Input id="currentCtc" name="currentCtc" type="number" min={0} step="0.1" defaultValue={d.currentCtc} />
        </Field>
        <Field name="expectedCtc" label="Expected CTC (LPA)">
          <Input id="expectedCtc" name="expectedCtc" type="number" min={0} step="0.1" defaultValue={d.expectedCtc} />
        </Field>
        <Field name="availability" label="Availability">
          <Select id="availability" name="availability" value={availability} onChange={(e) => setAvailability(e.target.value)} options={AVAILABILITY.map((a) => ({ value: a.value, label: `${a.emoji} ${a.label}` }))} />
        </Field>
        {availability !== "immediate" ? (
          <Field name="noticePeriodDays" label="Notice period (days)">
            <Input id="noticePeriodDays" name="noticePeriodDays" type="number" min={0} max={180} defaultValue={d.noticePeriodDays} />
          </Field>
        ) : null}
      </Section>
      <Section title="Skills & languages">
        <Field name="skills" label="Skills" hint="Comma separated, most important first." className="sm:col-span-2">
          <Textarea id="skills" name="skills" defaultValue={d.skills} rows={2} />
        </Field>
        <Field name="languages" label="Languages" hint="Comma separated." className="sm:col-span-2">
          <Input id="languages" name="languages" defaultValue={d.languages} />
        </Field>
      </Section>
      <Section title="Professional links">
        <Field name="linkedinUrl" label="LinkedIn" optional>
          <Input id="linkedinUrl" name="linkedinUrl" defaultValue={d.linkedinUrl} placeholder="linkedin.com/in/…" />
        </Field>
        <Field name="portfolioUrl" label="Portfolio / GitHub" optional>
          <Input id="portfolioUrl" name="portfolioUrl" defaultValue={d.portfolioUrl} />
        </Field>
        <Field name="otherProfileUrl" label="Other profile" optional>
          <Input id="otherProfileUrl" name="otherProfileUrl" defaultValue={d.otherProfileUrl} />
        </Field>
      </Section>
      <div className="flex justify-end border-t border-line pt-4">
        <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function PhotoForm() {
  return (
    <ActionForm action={uploadPhotoAction} className="flex flex-wrap items-end gap-2" encType="multipart/form-data">
      <Field name="photo" label="Profile photo" hint="JPG, PNG or WebP, up to 5 MB.">
        <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="block text-sm text-ink-2 file:mr-3 file:rounded-md file:border-0 file:bg-subtle file:px-3 file:py-1.5 file:text-sm file:text-ink" />
      </Field>
      <SubmitButton variant="secondary" size="sm">
        Upload
      </SubmitButton>
    </ActionForm>
  );
}

export function EducationForm() {
  return (
    <ActionForm action={addEducationAction} className="grid gap-3 sm:grid-cols-2" resetOnSuccess>
      <Field name="level" label="Level">
        <Select id="level" name="level" options={EDUCATION_LEVELS.filter((e) => e.value !== "any")} />
      </Field>
      <Field name="degree" label="Degree">
        <Input id="degree" name="degree" placeholder="e.g. B.Tech, Computer Science" />
      </Field>
      <Field name="institution" label="Institution">
        <Input id="institution" name="institution" />
      </Field>
      <Field name="fieldOfStudy" label="Field of study" optional>
        <Input id="fieldOfStudy" name="fieldOfStudy" />
      </Field>
      <Field name="startYear" label="Start year" optional>
        <Input id="startYear" name="startYear" type="number" min={1950} max={2100} />
      </Field>
      <Field name="endYear" label="End year" optional>
        <Input id="endYear" name="endYear" type="number" min={1950} max={2100} />
      </Field>
      <Field name="grade" label="Grade / CGPA" optional>
        <Input id="grade" name="grade" />
      </Field>
      <div className="flex items-end">
        <SubmitButton variant="secondary">Add education</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ExperienceForm() {
  const [current, setCurrent] = useState(false);
  return (
    <ActionForm action={addExperienceAction} className="grid gap-3 sm:grid-cols-2" resetOnSuccess>
      <Field name="title" label="Job title">
        <Input id="exp-title" name="title" />
      </Field>
      <Field name="company" label="Company">
        <Input id="exp-company" name="company" />
      </Field>
      <Field name="location" label="Location" optional>
        <Input id="exp-location" name="location" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field name="startDate" label="Start">
          <Input id="startDate" name="startDate" type="month" />
        </Field>
        <Field name="endDate" label="End">
          <Input id="endDate" name="endDate" type="month" disabled={current} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
        <input type="checkbox" name="isCurrent" checked={current} onChange={(e) => setCurrent(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />I currently work here
      </label>
      <Field name="description" label="What you did" optional hint="One achievement per line. Include numbers where you can." className="sm:col-span-2">
        <Textarea id="exp-description" name="description" rows={3} />
      </Field>
      <div>
        <SubmitButton variant="secondary">Add experience</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function CertificationForm() {
  return (
    <ActionForm action={addCertificationAction} className="grid gap-3 sm:grid-cols-2" resetOnSuccess>
      <Field name="name" label="Certification">
        <Input id="cert-name" name="name" />
      </Field>
      <Field name="issuer" label="Issuer" optional>
        <Input id="cert-issuer" name="issuer" />
      </Field>
      <Field name="year" label="Year" optional>
        <Input id="cert-year" name="year" type="number" min={1950} max={2100} />
      </Field>
      <Field name="credentialUrl" label="Credential URL" optional>
        <Input id="credentialUrl" name="credentialUrl" />
      </Field>
      <div>
        <SubmitButton variant="secondary">Add certification</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ProjectForm() {
  return (
    <ActionForm action={addProjectAction} className="grid gap-3 sm:grid-cols-2" resetOnSuccess>
      <Field name="name" label="Project name">
        <Input id="proj-name" name="name" />
      </Field>
      <Field name="url" label="Link" optional>
        <Input id="proj-url" name="url" />
      </Field>
      <Field name="description" label="Description" optional className="sm:col-span-2">
        <Textarea id="proj-description" name="description" rows={2} />
      </Field>
      <div>
        <SubmitButton variant="secondary">Add project</SubmitButton>
      </div>
    </ActionForm>
  );
}
