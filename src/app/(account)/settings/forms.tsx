"use client";

import { changePasswordAction, updateNotificationPrefsAction } from "@/actions/account";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { CheckboxField, Input } from "@/components/ui";

export function NotificationPrefsForm({ d }: { d: { phone: string; notifyEmail: boolean; notifySms: boolean; notifyWhatsapp: boolean } }) {
  return (
    <ActionForm action={updateNotificationPrefsAction} className="space-y-4">
      <p className="text-sm text-ink-2">In-app notifications are always on. Choose additional channels:</p>
      <CheckboxField name="notifyEmail" defaultChecked={d.notifyEmail} label="Email" description="Shortlists, interview schedules, matches, verification updates and invoices." />
      <CheckboxField name="notifySms" defaultChecked={d.notifySms} label="SMS" description="Time-sensitive updates such as interview reminders." />
      <CheckboxField name="notifyWhatsapp" defaultChecked={d.notifyWhatsapp} label="WhatsApp" description="The same updates, delivered on WhatsApp." />
      <Field name="phone" label="Mobile number" hint="Used only for SMS/WhatsApp alerts — never shared with companies or candidates." optional>
        <Input id="phone" name="phone" type="tel" defaultValue={d.phone} placeholder="+91 98765 43210" />
      </Field>
      <SubmitButton>Save preferences</SubmitButton>
    </ActionForm>
  );
}

export function PasswordForm() {
  return (
    <ActionForm action={changePasswordAction} className="space-y-4" resetOnSuccess>
      <Field name="current" label="Current password">
        <Input id="current" name="current" type="password" autoComplete="current-password" />
      </Field>
      <Field name="next" label="New password" hint="At least 8 characters with a letter and a number.">
        <Input id="next" name="next" type="password" autoComplete="new-password" />
      </Field>
      <SubmitButton variant="secondary">Change password</SubmitButton>
    </ActionForm>
  );
}
