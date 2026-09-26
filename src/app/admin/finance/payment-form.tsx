"use client";

import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Input, Select } from "@/components/ui";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { ActionState } from "@/lib/forms";

export function PaymentForm({ action, amount }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; amount: number }) {
  return (
    <details>
      <summary className="cursor-pointer text-sm font-medium text-accent">Record payment</summary>
      <ActionForm action={action} className="mt-2 grid w-80 gap-2">
        <Field name="amount" label="Amount (₹)">
          <Input name="amount" type="number" min={1} defaultValue={amount} />
        </Field>
        <Field name="method" label="Method">
          <Select name="method" options={PAYMENT_METHODS} defaultValue="bank_transfer" />
        </Field>
        <Field name="reference" label="Reference / UTR" optional>
          <Input name="reference" />
        </Field>
        <SubmitButton size="sm">Save payment</SubmitButton>
      </ActionForm>
    </details>
  );
}
