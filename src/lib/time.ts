// Request-time helpers, kept out of component bodies so renders stay pure.

export function isUpcoming(date: Date, graceMs = 3_600_000): boolean {
  return date.getTime() > Date.now() - graceMs;
}

export function hasNotPassed(date: Date, graceMs = 0): boolean {
  return date.getTime() + graceMs > Date.now();
}

export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
