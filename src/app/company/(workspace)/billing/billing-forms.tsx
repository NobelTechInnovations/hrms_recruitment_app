"use client";

import { changePlanAction, requestServiceAction } from "@/actions/company";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Input, Select, cx } from "@/components/ui";
import { formatINR } from "@/lib/format";
import type { ActionState } from "@/lib/forms";
import type { Plan, Service } from "@/lib/plans";

export function PlanForm({ plans, current, cycle }: { plans: Plan[]; current: string; cycle: string }) {
  return (
    <ActionForm action={changePlanAction} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {plans.map((p) => (
          <label key={p.code} className={cx("cursor-pointer rounded-lg border p-4 has-[:checked]:border-accent has-[:checked]:bg-accent-soft", "border-line")}>
            <input type="radio" name="plan" value={p.code} defaultChecked={p.code === current} className="sr-only" />
            <p className="font-semibold text-ink">
              {p.name} {p.code === current ? <span className="text-xs font-normal text-ink-2">(current)</span> : null}
            </p>
            <p className="text-sm text-ink-2">{p.monthlyPrice ? `${formatINR(p.monthlyPrice)}/mo` : "No subscription"}</p>
            <p className="text-sm text-ink-2">{p.placementFeePercent ? `${p.placementFeePercent}% of CTC after ${p.guaranteeDays} days` : "No placement fee"}</p>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field name="cycle" label="Billing cycle">
          <Select id="cycle" name="cycle" defaultValue={cycle} options={[{ value: "monthly", label: "Monthly" }, { value: "annual", label: "Annual (2 months free)" }]} />
        </Field>
        <SubmitButton variant="secondary">Change plan</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ServiceForm({ services, jobs }: { services: Service[]; jobs: { value: string; label: string }[] }) {
  return (
    <ActionForm action={requestServiceAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
      <Field name="service" label="Service">
        <Select id="service" name="service" options={services.map((s) => ({ value: s.code, label: `${s.name} — ${formatINR(s.price)} ${s.unit}` }))} />
      </Field>
      <Field name="jobId" label="For job" optional hint="Required for job-specific services">
        <Select id="jobId" name="jobId" options={jobs} placeholder="—" />
      </Field>
      <Field name="quantity" label="Quantity">
        <Input id="quantity" name="quantity" type="number" min={1} max={100} defaultValue="1" />
      </Field>
      <Field name="notes" label="Notes" optional>
        <Input id="notes" name="notes" />
      </Field>
      <div>
        <SubmitButton>Request service</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DepartureForm({ action }: { action: (s: ActionState, fd: FormData) => Promise<ActionState> }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-accent">Record departure / no-show</summary>
      <ActionForm action={action} className="mt-2 grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <Field name="leftAt" label="Last working day">
          <Input name="leftAt" type="date" max={new Date().toISOString().slice(0, 10)} />
        </Field>
        <Field name="reason" label="Reason" optional>
          <Input name="reason" />
        </Field>
        <SubmitButton size="sm" variant="danger" confirm="Record that this candidate left or did not join?">
          Record
        </SubmitButton>
      </ActionForm>
    </details>
  );
}
