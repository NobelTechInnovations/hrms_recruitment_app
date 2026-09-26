"use client";

import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Input, Select, Textarea } from "@/components/ui";
import { ASSESSMENT_CATEGORIES } from "@/lib/constants";
import type { ActionState } from "@/lib/forms";

type Action = (s: ActionState, fd: FormData) => Promise<ActionState>;

export function AssessmentForm({ action, d }: { action: Action; d?: { title: string; description: string; level: number; category: string; durationMinutes: number; passingPercent: number; questionsPerAttempt: number; retakeCooldownDays: number } }) {
  return (
    <ActionForm action={action} className="grid gap-3 sm:grid-cols-2">
      <Field name="title" label="Title" className="sm:col-span-2">
        <Input name="title" defaultValue={d?.title} />
      </Field>
      <Field name="description" label="Description" optional className="sm:col-span-2">
        <Textarea name="description" rows={2} defaultValue={d?.description} />
      </Field>
      <Field name="level" label="Level">
        <Select name="level" defaultValue={String(d?.level ?? 2)} options={[{ value: "1", label: "Level 1 — Aptitude" }, { value: "2", label: "Level 2 — Industry / role" }]} />
      </Field>
      <Field name="category" label="Category">
        <Select name="category" defaultValue={d?.category ?? "it"} options={ASSESSMENT_CATEGORIES} />
      </Field>
      <Field name="durationMinutes" label="Duration (minutes)">
        <Input name="durationMinutes" type="number" min={5} defaultValue={d?.durationMinutes ?? 15} />
      </Field>
      <Field name="passingPercent" label="Passing score (%)">
        <Input name="passingPercent" type="number" min={1} max={100} defaultValue={d?.passingPercent ?? 60} />
      </Field>
      <Field name="questionsPerAttempt" label="Questions per attempt" hint="Drawn randomly, spread across topics">
        <Input name="questionsPerAttempt" type="number" min={1} defaultValue={d?.questionsPerAttempt ?? 10} />
      </Field>
      <Field name="retakeCooldownDays" label="Retake cooldown (days)">
        <Input name="retakeCooldownDays" type="number" min={0} defaultValue={d?.retakeCooldownDays ?? 7} />
      </Field>
      <div>
        <SubmitButton>{d ? "Save settings" : "Create assessment"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function QuestionForm({ action, topics }: { action: Action; topics: string[] }) {
  return (
    <ActionForm action={action} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
      <Field name="topic" label="Topic">
        <Input name="topic" list="topics" />
      </Field>
      <datalist id="topics">
        {topics.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <Field name="correctIndex" label="Correct answer">
        <Select name="correctIndex" options={["A", "B", "C", "D"].map((l, i) => ({ value: String(i), label: `Option ${l}` }))} />
      </Field>
      <Field name="text" label="Question" className="sm:col-span-2">
        <Textarea name="text" rows={2} />
      </Field>
      {["A", "B", "C", "D"].map((l, i) => (
        <Field key={l} name={`option${i}`} label={`Option ${l}`} optional={i > 1}>
          <Input name={`option${i}`} />
        </Field>
      ))}
      <Field name="explanation" label="Explanation (admin only)" optional className="sm:col-span-2">
        <Input name="explanation" />
      </Field>
      <div>
        <SubmitButton variant="secondary">Add question</SubmitButton>
      </div>
    </ActionForm>
  );
}
