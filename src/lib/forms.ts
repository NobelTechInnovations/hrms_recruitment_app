import { z, type ZodType } from "zod";

export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
} | null;

export const ok = (message?: string): ActionState => ({ ok: true, message });
export const fail = (error: string, fieldErrors?: Record<string, string>): ActionState => ({ ok: false, error, fieldErrors });

/** Collect string form fields into a plain object (files are skipped). */
export function formObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  }
  return out;
}

export function checkbox(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Parse a FormData against a schema, returning either data or an ActionState failure. */
export function parseForm<T extends ZodType>(schema: T, fd: FormData): { data: z.infer<T>; error?: undefined } | { data?: undefined; error: NonNullable<ActionState> } {
  const result = schema.safeParse(formObject(fd));
  if (result.success) return { data: result.data };
  return { error: { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(result.error) } };
}

// ─── Reusable field schemas ────────────────────────────────────────────────

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const requiredText = (label: string, max = 200) => z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);
export const optionalText = (max = 5000) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max, "Too long").optional()).transform((v) => v ?? null);
export const optionalNumber = (min = 0, max = 1_000_000) =>
  z.preprocess(blankToUndefined, z.coerce.number({ error: "Enter a number" }).min(min, `Must be at least ${min}`).max(max, `Must be at most ${max}`).optional()).transform((v) => v ?? null);
export const requiredNumber = (label: string, min = 0, max = 1_000_000) =>
  z.preprocess(blankToUndefined, z.coerce.number({ error: `${label} is required` }).min(min, `${label} must be at least ${min}`).max(max, `${label} must be at most ${max}`));
export const optionalUrl = () =>
  z.preprocess(
    (v) => {
      const b = blankToUndefined(v);
      if (typeof b === "string" && !/^https?:\/\//i.test(b)) return `https://${b.trim()}`;
      return b;
    },
    z.url("Enter a valid URL").optional(),
  ).transform((v) => v ?? null);
export const email = () => z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));
