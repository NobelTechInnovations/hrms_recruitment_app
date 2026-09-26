const TIME_ZONE = process.env.APP_TIMEZONE ?? "Asia/Kolkata";

export function formatINR(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

function trimNumber(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");
}

export function formatLpa(v: number | null | undefined): string {
  if (v == null) return "—";
  return `₹${trimNumber(v)} LPA`;
}

export function formatCtcRange(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null && max == null) return "Not disclosed";
  if (min != null && max != null) return min === max ? formatLpa(min) : `₹${trimNumber(min)}–${trimNumber(max)} LPA`;
  if (min != null) return `From ${formatLpa(min)}`;
  return `Up to ${formatLpa(max)}`;
}

export function formatExperience(min: number | null | undefined, max: number | null | undefined): string {
  const lo = min ?? 0;
  if (max == null) return lo === 0 ? "Any experience" : `${trimNumber(lo)}+ yrs`;
  return `${trimNumber(lo)}–${trimNumber(max)} yrs`;
}

export function formatYears(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v === 0) return "Fresher";
  return `${trimNumber(v)} yr${v === 1 ? "" : "s"}`;
}

export function formatDate(d: Date | number | null | undefined): string {
  if (d == null) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE }).format(new Date(d));
}

export function formatDateTime(d: Date | number | null | undefined): string {
  if (d == null) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(d));
}

export function formatTime(d: Date | number): string {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TIME_ZONE }).format(new Date(d));
}

/** "tomorrow at 11:00 am", "on 3 Oct 2026 at 4:30 pm" */
export function formatWhen(d: Date | number, now: Date = new Date()): string {
  const target = new Date(d);
  const dayKey = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(x);
  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000));
  const day = dayKey(target);
  const time = formatTime(target);
  if (day === today) return `today at ${time}`;
  if (day === tomorrow) return `tomorrow at ${time}`;
  return `on ${formatDate(target)} at ${time}`;
}

export function timeAgo(d: Date | number | null | undefined, now: Date = new Date()): string {
  if (d == null) return "—";
  const diff = Math.round((now.getTime() - new Date(d).getTime()) / 1000);
  const abs = Math.abs(diff);
  const units: [number, string][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [30, "day"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];
  let value = abs;
  let unit = "second";
  for (const [size, name] of units) {
    unit = name;
    if (value < size) break;
    value = Math.floor(value / size);
  }
  if (unit === "second" && value < 45) return diff >= 0 ? "just now" : "in a moment";
  const label = `${value} ${unit}${value === 1 ? "" : "s"}`;
  return diff >= 0 ? `${label} ago` : `in ${label}`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Split a comma/newline separated string into a de-duplicated list. */
export function parseList(input: string | null | undefined): string[] {
  if (!input) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[,\n]/)) {
    const item = raw.trim().replace(/\s+/g, " ");
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
