import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { initials } from "@/lib/format";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ─── Buttons ────────────────────────────────────────────────────────────────

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap",
    size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
    variant === "primary" && "bg-accent text-white hover:bg-accent-hover dark:text-[#0b0b0b]",
    variant === "secondary" && "border border-line-strong bg-surface text-ink hover:bg-subtle",
    variant === "ghost" && "text-ink-2 hover:bg-subtle hover:text-ink",
    variant === "danger" && "border border-red-300 bg-surface text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950",
    extra,
  );
}

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

// ─── Layout primitives ──────────────────────────────────────────────────────

export function Card({ className, children, ...props }: ComponentProps<"section">) {
  return (
    <section className={cx("rounded-xl border border-line bg-surface", className)} {...props}>
      {children}
    </section>
  );
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-ink-2">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("px-5 py-4", className)}>{children}</div>;
}

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6">
      {back ? (
        <Link href={back.href} className="mb-2 inline-flex items-center text-sm text-ink-2 hover:text-ink">
          ← {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {description ? <div className="mt-1 text-sm text-ink-2">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
      {icon ? <div className="mb-3 text-ink-3">{icon}</div> : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-ink-2">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Alert({ tone = "info", title, children }: { tone?: "info" | "good" | "warn" | "bad"; title?: ReactNode; children?: ReactNode }) {
  const styles = {
    info: "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100",
    good: "border-green-200 bg-green-50 text-green-950 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100",
    warn: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
    bad: "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100",
  }[tone];
  const icon = { info: "ℹ", good: "✓", warn: "!", bad: "✕" }[tone];
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cx("flex gap-3 rounded-lg border px-4 py-3 text-sm", styles)}>
      <span aria-hidden className="mt-px font-semibold">
        {icon}
      </span>
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div> : null}
      </div>
    </div>
  );
}

// ─── Badges ─────────────────────────────────────────────────────────────────

export type Tone = "neutral" | "accent" | "good" | "warn" | "bad" | "info" | "purple";

export function Badge({ tone = "neutral", children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  const styles: Record<Tone, string> = {
    neutral: "bg-subtle text-ink-2 ring-line",
    accent: "bg-accent-soft text-accent-ink ring-blue-200 dark:ring-blue-900",
    info: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900",
    good: "bg-green-50 text-green-800 ring-green-200 dark:bg-green-950/50 dark:text-green-200 dark:ring-green-900",
    warn: "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900",
    bad: "bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-900",
    purple: "bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-900",
  };
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", styles[tone], className)}>
      {children}
    </span>
  );
}

// ─── Data display ───────────────────────────────────────────────────────────

/** KPI stat tile: sentence-case label, semibold proportional value, optional hint. */
export function StatTile({ label, value, hint, href }: { label: string; value: ReactNode; hint?: ReactNode; href?: string }) {
  const body = (
    <>
      <p className="text-sm text-ink-2">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-3">{hint}</p> : null}
    </>
  );
  const cls = "block rounded-xl border border-line bg-surface px-4 py-3";
  return href ? (
    <Link href={href} className={cx(cls, "transition-colors hover:border-line-strong hover:bg-subtle")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Meter: accent fill on a lighter step of the same ramp. */
export function Meter({ value, label, showValue = true, size = "md" }: { value: number; label: string; showValue?: boolean; size?: "sm" | "md" }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      {showValue ? (
        <div className="mb-1 flex items-baseline justify-between text-sm">
          <span className="text-ink-2">{label}</span>
          <span className="font-semibold text-ink">{v}%</span>
        </div>
      ) : null}
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        className={cx("w-full overflow-hidden rounded-full bg-track", size === "sm" ? "h-1.5" : "h-2.5")}
      >
        <div className="h-full rounded-full bg-series" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

/** Horizontal bar list (single series → one hue). Each row has a text label and value, so the list doubles as its table view. */
export function BarList({ rows, valueSuffix = "", ariaLabel }: { rows: { label: string; value: number; hint?: string; href?: string }[]; valueSuffix?: string; ariaLabel: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul aria-label={ariaLabel} className="space-y-2.5">
      {rows.map((r) => {
        const pct = (r.value / max) * 100;
        const inner = (
          <div className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr_3.5rem]">
            <span className="truncate text-ink-2">{r.label}</span>
            <span className="viz-tip block h-3 rounded-r bg-transparent" tabIndex={0}>
              <span className="block h-3 rounded-r-[4px] bg-series" style={{ width: `${Math.max(pct, r.value > 0 ? 2 : 0)}%` }} />
              <span role="tooltip">
                {r.label}: {r.value.toLocaleString("en-IN")}
                {valueSuffix}
                {r.hint ? ` · ${r.hint}` : ""}
              </span>
            </span>
            <span className="text-right font-medium text-ink [font-variant-numeric:tabular-nums]">
              {r.value.toLocaleString("en-IN")}
              {valueSuffix}
            </span>
          </div>
        );
        return <li key={r.label}>{r.href ? <Link href={r.href} className="block rounded hover:bg-subtle">{inner}</Link> : inner}</li>;
      })}
    </ul>
  );
}

export function DescriptionList({ items, columns = 2 }: { items: { label: string; value: ReactNode }[]; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={cx("grid gap-x-6 gap-y-4", columns === 1 ? "grid-cols-1" : columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3")}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-3">{it.label}</dt>
          <dd className="mt-1 break-words text-sm text-ink">{it.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Avatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-ink"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("overflow-x-auto", className)}>
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cx("border-b border-line px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-3", className)}>{children}</th>;
}
export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cx("border-b border-line px-4 py-3 align-top text-ink", className)}>
      {children}
    </td>
  );
}

export function Tabs({ items }: { items: { href: string; label: string; active: boolean; count?: number }[] }) {
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-line" aria-label="Tabs">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cx(
            "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
            t.active ? "border-accent text-ink" : "border-transparent text-ink-2 hover:border-line-strong hover:text-ink",
          )}
        >
          {t.label}
          {t.count != null ? <span className="ml-1.5 rounded-full bg-subtle px-1.5 text-xs text-ink-2">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export function Checklist({ items }: { items: { label: string; done: boolean; hint?: string }[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((i) => (
        <li key={i.label} className="flex items-start gap-2 text-sm">
          <span aria-hidden className={cx("mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", i.done ? "bg-green-600 text-white" : "border border-line-strong text-transparent")}>
            ✓
          </span>
          <span className={i.done ? "text-ink" : "text-ink-2"}>
            {i.label}
            <span className="sr-only">{i.done ? " (done)" : " (missing)"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// ─── Form elements (server-safe) ───────────────────────────────────────────

export function Label({ htmlFor, children, optional }: { htmlFor?: string; children: ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-ink">
      {children}
      {optional ? <span className="ml-1 font-normal text-ink-3">(optional)</span> : null}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx("input", props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={cx("input", props.className)} />;
}

export function Select({ options, placeholder, ...props }: ComponentProps<"select"> & { options: readonly { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select {...props} className={cx("input", props.className)}>
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function CheckboxField({ name, label, description, defaultChecked }: { name: string; label: ReactNode; description?: ReactNode; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 rounded border-line-strong accent-[var(--accent)]" />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description ? <span className="block text-sm text-ink-2">{description}</span> : null}
      </span>
    </label>
  );
}
