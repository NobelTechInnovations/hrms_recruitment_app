"use client";

import { updatePrivacyAction } from "@/actions/candidate";
import { ActionForm, SubmitButton } from "@/components/forms";
import { CheckboxField } from "@/components/ui";
import { PROFILE_VISIBILITY } from "@/lib/constants";

export function PrivacyForm({ d, docTypes }: { d: { profileVisibility: string; appearInSearch: boolean; allowRecruiterContact: boolean; allowRecommendations: boolean; shareableDocTypes: string[] }; docTypes: readonly { value: string; label: string }[] }) {
  return (
    <ActionForm action={updatePrivacyAction} className="space-y-6">
      <fieldset>
        <legend className="font-medium text-ink">Who can see your profile</legend>
        <div className="mt-3 space-y-2">
          {PROFILE_VISIBILITY.map((o) => (
            <label key={o.value} className="flex items-start gap-3 text-sm">
              <input type="radio" name="profileVisibility" value={o.value} defaultChecked={d.profileVisibility === o.value} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
              <span>
                <span className="font-medium text-ink">{o.label}</span>
                <span className="block text-ink-2">
                  {o.value === "all_verified"
                    ? "Verified companies can find and view your profile (without contact details)."
                    : o.value === "applied_only"
                      ? "Only companies whose jobs you apply to can view your profile."
                      : "Your profile is hidden everywhere; applications still share it with that company."}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-3 border-t border-line pt-5">
        <legend className="sr-only">Discovery</legend>
        <CheckboxField name="appearInSearch" defaultChecked={d.appearInSearch} label="Appear in company candidate searches" />
        <CheckboxField name="allowRecommendations" defaultChecked={d.allowRecommendations} label="Allow my profile to be recommended for jobs" description="Enables “N candidates match your job” for companies and job-match alerts for you." />
        <CheckboxField name="allowRecruiterContact" defaultChecked={d.allowRecruiterContact} label="Allow verified recruiters to contact me" description="Messages always arrive via your relay address — your email and phone stay private." />
      </fieldset>
      <fieldset className="border-t border-line pt-5">
        <legend className="font-medium text-ink">Documents companies may view</legend>
        <p className="mt-1 text-sm text-ink-2">Only approved documents, and only for companies you’ve applied to. Everything else stays with platform verification staff.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {docTypes.map((t) => (
            <label key={t.value} className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" name="shareableDocTypes" value={t.value} defaultChecked={d.shareableDocTypes.includes(t.value)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end border-t border-line pt-4">
        <SubmitButton>Save privacy settings</SubmitButton>
      </div>
    </ActionForm>
  );
}
