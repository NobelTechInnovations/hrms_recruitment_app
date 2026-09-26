// Deferred placement-fee model (README §11): fee becomes due only after the candidate
// completes the guarantee period (60 days by default) after joining.

import { TAX_RATE } from "./constants";
import type { Plan } from "./plans";

const DAY = 86_400_000;

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY);
}

/** Candidate joined 1 Sep → 60-day milestone 31 Oct. */
export function milestoneDate(joiningDate: Date, guaranteeDays: number): Date {
  return addDays(joiningDate, guaranteeDays);
}

/** Placement fee in INR for a plan and a first-year CTC in LPA. */
export function placementFee(plan: Pick<Plan, "placementFeePercent">, offeredCtcLpa: number | null | undefined): number {
  if (!offeredCtcLpa || plan.placementFeePercent <= 0) return 0;
  return Math.round(offeredCtcLpa * 100_000 * (plan.placementFeePercent / 100));
}

export function withTax(amount: number): { amount: number; taxAmount: number; total: number } {
  const taxAmount = Math.round(amount * TAX_RATE);
  return { amount, taxAmount, total: amount + taxAmount };
}

export function subscriptionCharge(plan: Pick<Plan, "monthlyPrice">, cycle: "monthly" | "annual"): number {
  return cycle === "annual" ? plan.monthlyPrice * 10 : plan.monthlyPrice;
}

export function subscriptionPeriodEnd(start: Date, cycle: "monthly" | "annual"): Date {
  const d = new Date(start.getTime());
  if (cycle === "annual") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

export type DepartureOutcome = {
  outcome: "fee_waived" | "replacement_eligible" | "no_action";
  daysWorked: number;
  explanation: string;
};

/** What happens when a placed candidate leaves the company. */
export function evaluateDeparture(
  p: { joiningDate: Date; guaranteeDays: number; replacementDays: number },
  leftAt: Date,
): DepartureOutcome {
  const daysWorked = Math.max(0, daysBetween(p.joiningDate, leftAt));
  if (daysWorked < p.guaranteeDays) {
    return {
      outcome: "fee_waived",
      daysWorked,
      explanation: `Candidate left after ${daysWorked} days, before the ${p.guaranteeDays}-day milestone — no placement fee is charged.`,
    };
  }
  if (daysWorked < p.replacementDays) {
    return {
      outcome: "replacement_eligible",
      daysWorked,
      explanation: `Candidate left after ${daysWorked} days, within the ${p.replacementDays}-day replacement period — a free replacement or refund applies.`,
    };
  }
  return { outcome: "no_action", daysWorked, explanation: `Candidate left after ${daysWorked} days, outside the replacement period.` };
}

export function invoiceNumber(year: number, sequence: number): string {
  return `INV-${year}-${String(sequence).padStart(5, "0")}`;
}
