"use client";

import { inviteMemberAction } from "@/actions/company";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Input, Select } from "@/components/ui";
import { COMPANY_ROLES } from "@/lib/constants";
import type { ActionState } from "@/lib/forms";

export function InviteMemberForm() {
  return (
    <ActionForm action={inviteMemberAction} resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
      <Field name="email" label="Work email">
        <Input id="email" name="email" type="email" placeholder="recruiter@yourcompany.com" />
      </Field>
      <Field name="role" label="Role">
        <Select id="role" name="role" options={COMPANY_ROLES} defaultValue="recruiter" />
      </Field>
      <SubmitButton>Send invite</SubmitButton>
    </ActionForm>
  );
}

export function RoleSelect({ action, role }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; role: string }) {
  return (
    <ActionForm action={action} className="flex items-center gap-2" showSuccess={false}>
      <label className="sr-only" htmlFor={`role-${role}`}>Role</label>
      <Select name="role" defaultValue={role} options={COMPANY_ROLES} className="py-1 text-xs" />
      <SubmitButton size="sm" variant="ghost">Save</SubmitButton>
    </ActionForm>
  );
}
