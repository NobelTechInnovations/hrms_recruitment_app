"use client";

import { createContext, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/forms";
import { buttonClass, cx } from "./ui";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

const FormStateContext = createContext<ActionState>(null);

export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  showSuccess = true,
  encType,
  id,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  showSuccess?: boolean;
  encType?: "multipart/form-data";
  id?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <FormStateContext.Provider value={state}>
      <form ref={ref} action={formAction} className={className} encType={encType} id={id} noValidate>
        {state?.error ? (
          <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
            {state.error}
          </p>
        ) : null}
        {state?.ok && state.message && showSuccess ? (
          <p role="status" className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100">
            ✓ {state.message}
          </p>
        ) : null}
        {children}
      </form>
    </FormStateContext.Provider>
  );
}

export function useFieldError(name: string): string | undefined {
  return useContext(FormStateContext)?.fieldErrors?.[name];
}

/** Label + control + inline error. The control must carry the same `name`. */
export function Field({ name, label, hint, optional, children, className }: { name: string; label: ReactNode; hint?: ReactNode; optional?: boolean; children: ReactNode; className?: string }) {
  const error = useFieldError(name);
  return (
    <div className={className} data-invalid={error ? "true" : undefined}>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-ink">
        {label}
        {optional ? <span className="ml-1 font-normal text-ink-3">(optional)</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  pendingText,
  confirm,
  name,
  value,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
  pendingText?: string;
  confirm?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={buttonClass(variant, size, className)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? (pendingText ?? "Working…") : children}
    </button>
  );
}

/** A single-button form for quick actions (approve, reject, move stage…). */
export function ActionButton({
  action,
  children,
  variant = "secondary",
  size = "sm",
  confirm,
  hidden,
  className,
}: {
  action: FormAction;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  confirm?: string;
  hidden?: Record<string, string>;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={cx("inline-flex flex-col items-start", className)}>
      {hidden ? Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />) : null}
      <SubmitButton variant={variant} size={size} confirm={confirm}>
        {children}
      </SubmitButton>
      {state?.error ? <span className="mt-1 text-xs text-red-700 dark:text-red-300">{state.error}</span> : null}
    </form>
  );
}
