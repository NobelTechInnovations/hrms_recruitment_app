"use client";

import { useState } from "react";
import Link from "next/link";
import { Briefcase, UserRound } from "lucide-react";
import { registerAction } from "@/actions/auth";
import { ActionForm, Field, SubmitButton, useFieldError } from "@/components/forms";
import { Input, cx } from "@/components/ui";

function ConsentError() {
  const error = useFieldError("consent");
  return error ? <p className="text-xs text-red-700 dark:text-red-300">{error}</p> : null;
}

export function RegisterForm({ initialRole, invite }: { initialRole: "candidate" | "company"; invite?: { token: string; email: string; companyName: string } }) {
  const [role, setRole] = useState<"candidate" | "company">(invite ? "company" : initialRole);
  return (
    <ActionForm action={registerAction} className="space-y-4">
      <input type="hidden" name="role" value={role} />
      {invite ? <input type="hidden" name="inviteToken" value={invite.token} /> : null}
      {invite ? (
        <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-ink">
          You’re joining <strong>{invite.companyName}</strong>’s recruiter workspace.
        </p>
      ) : (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">I want to</legend>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["candidate", "Find a job", UserRound],
                ["company", "Hire talent", Briefcase],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={role === value}
                onClick={() => setRole(value)}
                className={cx(
                  "flex items-center gap-2 rounded-lg border px-3 py-3 text-left text-sm",
                  role === value ? "border-accent bg-accent-soft font-medium text-accent-ink" : "border-line-strong text-ink hover:bg-subtle",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <Field name="name" label={role === "company" ? "Your full name" : "Full name"}>
        <Input id="name" name="name" autoComplete="name" required />
      </Field>
      <Field name="email" label={role === "company" ? "Work email" : "Email"} hint={role === "company" ? "Use your company domain — it speeds up verification." : "Never shown to companies — they see a protected relay address."}>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={invite?.email} readOnly={!!invite} required />
      </Field>
      <Field name="password" label="Password" hint="At least 8 characters with a letter and a number.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <div>
        <label className="flex items-start gap-2 text-sm text-ink-2">
          <input type="checkbox" name="consent" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
          <span>
            I agree to the terms of use and privacy policy, including that messages are routed and screened by the platform.
          </span>
        </label>
        <ConsentError />
      </div>
      <SubmitButton className="w-full" pendingText="Creating account…">
        Create account
      </SubmitButton>
      <p className="text-center text-sm text-ink-2">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </ActionForm>
  );
}
