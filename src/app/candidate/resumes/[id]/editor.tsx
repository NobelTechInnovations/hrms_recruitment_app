"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Input, Select, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/forms";
import { TEMPLATES } from "../new-resume-form";

const ALL = ["summary", "skills", "experience", "education", "certifications", "projects", "languages"] as const;
const LABEL: Record<string, string> = { summary: "Summary", skills: "Skills", experience: "Experience", education: "Education", certifications: "Certifications", projects: "Projects", languages: "Languages" };

export function ResumeEditor({
  action,
  d,
  jobOptions,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  d: { title: string; template: string; targetRole: string; headline: string; summary: string; skills: string; sections: string[]; targetJobId: string };
  jobOptions: { value: string; label: string }[];
}) {
  const [order, setOrder] = useState<string[]>(() => [...d.sections, ...ALL.filter((s) => !d.sections.includes(s))]);
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(d.sections));
  const move = (i: number, dir: -1 | 1) =>
    setOrder((o) => {
      const n = [...o];
      const j = i + dir;
      if (j < 0 || j >= n.length) return o;
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });
  return (
    <ActionForm action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="title" label="Resume name">
          <Input id="title" name="title" defaultValue={d.title} />
        </Field>
        <Field name="template" label="Template">
          <Select id="template" name="template" defaultValue={d.template} options={TEMPLATES} />
        </Field>
        <Field name="targetRole" label="Target role" optional>
          <Input id="targetRole" name="targetRole" defaultValue={d.targetRole} />
        </Field>
        <Field name="targetJobId" label="Tailor for a job" optional hint="Get job-specific suggestions.">
          <Select id="targetJobId" name="targetJobId" defaultValue={d.targetJobId} options={jobOptions} placeholder="No specific job" />
        </Field>
      </div>
      <Field name="headline" label="Headline" optional>
        <Input id="headline" name="headline" defaultValue={d.headline} />
      </Field>
      <Field name="summary" label="Professional summary" optional>
        <Textarea id="summary" name="summary" defaultValue={d.summary} rows={4} />
      </Field>
      <Field name="skills" label="Skills to highlight" hint="Comma separated — order matters." optional>
        <Textarea id="skills" name="skills" defaultValue={d.skills} rows={2} />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Sections & order</legend>
        <input type="hidden" name="sectionOrder" value={order.join(",")} />
        <ul className="divide-y divide-line rounded-lg border border-line">
          {order.map((s, i) => (
            <li key={s} className="flex items-center justify-between gap-2 px-3 py-2">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  name="sections"
                  value={s}
                  checked={enabled.has(s)}
                  onChange={(e) =>
                    setEnabled((prev) => {
                      const n = new Set(prev);
                      if (e.target.checked) n.add(s);
                      else n.delete(s);
                      return n;
                    })
                  }
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                {LABEL[s]}
              </label>
              <span className="flex gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-ink-2 hover:bg-subtle disabled:opacity-30" aria-label={`Move ${LABEL[s]} up`}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1} className="rounded p-1 text-ink-2 hover:bg-subtle disabled:opacity-30" aria-label={`Move ${LABEL[s]} down`}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </fieldset>
      <p className="text-xs text-ink-3">Experience, education, certifications, projects and languages come from your profile.</p>
      <SubmitButton className="w-full">Save & refresh preview</SubmitButton>
    </ActionForm>
  );
}
