"use client";

import { useState } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Input, Select, Textarea } from "@/components/ui";
import { INTERVIEW_MODES, RECOMMENDATIONS } from "@/lib/constants";
import type { ActionState } from "@/lib/forms";
import { daysFromNow, isoDate } from "@/lib/time";

type Action = (s: ActionState, fd: FormData) => Promise<ActionState>;

export function StageForm({ action, options, defaultCtc }: { action: Action; options: { value: string; label: string }[]; defaultCtc?: string }) {
  const [to, setTo] = useState(options[0]?.value ?? "");
  if (!options.length) return <p className="text-sm text-ink-2">This application is closed — no further stage changes.</p>;
  return (
    <ActionForm action={action} className="grid gap-3 sm:grid-cols-2">
      <Field name="to" label="Move to">
        <Select id="to" name="to" value={to} onChange={(e) => setTo(e.target.value)} options={options} />
      </Field>
      {to === "offer" || to === "joined" ? (
        <Field name="offeredCtc" label="Offered CTC (LPA)" hint="Used for the placement fee after 60 days.">
          <Input id="offeredCtc" name="offeredCtc" type="number" min={0} step="0.1" defaultValue={defaultCtc} />
        </Field>
      ) : null}
      {to === "offer" ? (
        <Field name="expectedJoiningDate" label="Expected joining date">
          <Input id="expectedJoiningDate" name="expectedJoiningDate" type="date" />
        </Field>
      ) : null}
      {to === "joined" ? (
        <Field name="joiningDate" label="Actual joining date" hint="Starts the 60-day tracking period.">
          <Input id="joiningDate" name="joiningDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </Field>
      ) : null}
      {to === "rejected" ? (
        <Field name="rejectionReason" label="Reason (shared with the candidate)" optional className="sm:col-span-2">
          <Input id="rejectionReason" name="rejectionReason" placeholder="e.g. We've moved ahead with candidates with more Kafka experience." />
        </Field>
      ) : null}
      <Field name="note" label="Internal note" optional className="sm:col-span-2">
        <Input id="note" name="note" />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton variant={to === "rejected" ? "danger" : "primary"}>{to === "rejected" ? "Reject application" : "Update stage"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ScheduleForm({ action, stages, interviewers, defaultStage }: { action: Action; stages: { value: string; label: string }[]; interviewers: { value: string; label: string }[]; defaultStage: string }) {
  const [mode, setMode] = useState("video");
  const [{ today, tomorrow }] = useState(() => ({ today: isoDate(new Date()), tomorrow: isoDate(daysFromNow(1)) }));
  return (
    <ActionForm action={action} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
      <Field name="stage" label="Round">
        <Select id="stage" name="stage" defaultValue={defaultStage} options={stages} />
      </Field>
      <Field name="title" label="Title">
        <Input id="iv-title" name="title" placeholder="e.g. Technical interview — system design" />
      </Field>
      <Field name="date" label="Date">
        <Input id="date" name="date" type="date" defaultValue={tomorrow} min={today} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field name="time" label="Time (IST)">
          <Input id="time" name="time" type="time" defaultValue="11:00" />
        </Field>
        <Field name="durationMinutes" label="Minutes">
          <Input id="durationMinutes" name="durationMinutes" type="number" min={10} max={480} defaultValue="45" />
        </Field>
      </div>
      <Field name="mode" label="Mode">
        <Select id="mode" name="mode" value={mode} onChange={(e) => setMode(e.target.value)} options={INTERVIEW_MODES} />
      </Field>
      <Field name="interviewerUserId" label="Interviewer" optional>
        <Select id="interviewerUserId" name="interviewerUserId" options={interviewers} placeholder="Unassigned" />
      </Field>
      {mode === "video" ? (
        <Field name="meetingUrl" label="Meeting link" optional hint="Leave blank to generate a secure video room." className="sm:col-span-2">
          <Input id="meetingUrl" name="meetingUrl" placeholder="https://meet.google.com/… or Zoom link" />
        </Field>
      ) : null}
      {mode === "onsite" ? (
        <Field name="location" label="Address" className="sm:col-span-2">
          <Input id="location" name="location" />
        </Field>
      ) : null}
      <Field name="notes" label="Internal notes" optional className="sm:col-span-2">
        <Textarea id="iv-notes" name="notes" rows={2} />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton>Schedule & notify candidate</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function RescheduleForm({ action }: { action: Action }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium text-accent">Reschedule</summary>
      <ActionForm action={action} className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <Field name="date" label="New date">
          <Input name="date" type="date" min={new Date().toISOString().slice(0, 10)} />
        </Field>
        <Field name="time" label="Time">
          <Input name="time" type="time" defaultValue="11:00" />
        </Field>
        <Field name="reason" label="Reason" optional>
          <Input name="reason" />
        </Field>
        <SubmitButton size="sm" variant="secondary">
          Save
        </SubmitButton>
      </ActionForm>
    </details>
  );
}

function Rating({ name, label, defaultValue }: { name: string; label: string; defaultValue?: number }) {
  return (
    <Field name={name} label={label}>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer">
            <input type="radio" name={name} value={n} defaultChecked={defaultValue === n} className="peer sr-only" />
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line-strong text-sm text-ink-2 peer-checked:border-accent peer-checked:bg-accent peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--focus)] dark:peer-checked:text-black">{n}</span>
          </label>
        ))}
      </div>
    </Field>
  );
}

export function FeedbackForm({ action, d }: { action: Action; d?: { technical: number; communication: number; roleFit: number; experience: number; recommendation: string; strengths: string; concerns: string; salaryNotes: string; availabilityNotes: string } }) {
  return (
    <ActionForm action={action} className="grid gap-3 sm:grid-cols-2">
      <Rating name="technical" label="Technical skills" defaultValue={d?.technical} />
      <Rating name="communication" label="Communication" defaultValue={d?.communication} />
      <Rating name="roleFit" label="Role fit" defaultValue={d?.roleFit} />
      <Rating name="experience" label="Experience" defaultValue={d?.experience} />
      <Field name="strengths" label="Strengths" optional>
        <Textarea name="strengths" rows={2} defaultValue={d?.strengths} />
      </Field>
      <Field name="concerns" label="Concerns" optional>
        <Textarea name="concerns" rows={2} defaultValue={d?.concerns} />
      </Field>
      <Field name="salaryNotes" label="Salary expectations discussed" optional>
        <Input name="salaryNotes" defaultValue={d?.salaryNotes} />
      </Field>
      <Field name="availabilityNotes" label="Joining availability" optional>
        <Input name="availabilityNotes" defaultValue={d?.availabilityNotes} />
      </Field>
      <Field name="recommendation" label="Your recommendation">
        <Select name="recommendation" defaultValue={d?.recommendation ?? "yes"} options={RECOMMENDATIONS} />
      </Field>
      <div className="flex items-end">
        <SubmitButton variant="secondary">{d ? "Update feedback" : "Submit feedback"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
