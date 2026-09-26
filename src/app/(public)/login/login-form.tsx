"use client";

import { loginAction } from "@/actions/auth";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Input } from "@/components/ui";

export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={loginAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field name="email" label="Email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field name="password" label="Password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton className="w-full" pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </ActionForm>
  );
}
