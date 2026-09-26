import { describe, expect, it } from "vitest";
import { evaluateDeparture, invoiceNumber, milestoneDate, placementFee, subscriptionCharge, subscriptionPeriodEnd, withTax } from "@/lib/billing";
import { getPlan } from "@/lib/plans";

describe("60-day milestone", () => {
  it("matches the README example: joined 1 September → milestone 31 October", () => {
    const m = milestoneDate(new Date(Date.UTC(2026, 8, 1)), 60);
    expect(m.toISOString().slice(0, 10)).toBe("2026-10-31");
  });
});

describe("placementFee", () => {
  it("charges a percentage of first-year CTC", () => {
    expect(placementFee(getPlan("success"), 12)).toBe(Math.round(1_200_000 * 0.0833));
    expect(placementFee(getPlan("hybrid"), 10)).toBe(40_000);
    expect(placementFee(getPlan("subscription"), 10)).toBe(0);
    expect(placementFee(getPlan("success"), null)).toBe(0);
  });

  it("adds 18% GST", () => {
    expect(withTax(40_000)).toEqual({ amount: 40_000, taxAmount: 7_200, total: 47_200 });
  });
});

describe("evaluateDeparture", () => {
  const joiningDate = new Date(Date.UTC(2026, 8, 1));
  const p = { joiningDate, guaranteeDays: 60, replacementDays: 90 };
  it("waives the fee if the candidate leaves before 60 days", () => {
    expect(evaluateDeparture(p, new Date(Date.UTC(2026, 9, 15))).outcome).toBe("fee_waived");
  });
  it("offers a replacement between the milestone and the replacement window", () => {
    expect(evaluateDeparture(p, new Date(Date.UTC(2026, 10, 15))).outcome).toBe("replacement_eligible");
  });
  it("takes no action after the replacement window", () => {
    expect(evaluateDeparture(p, new Date(Date.UTC(2027, 0, 15))).outcome).toBe("no_action");
  });
});

describe("subscriptions", () => {
  it("bills annual plans at 10× monthly (2 months free)", () => {
    expect(subscriptionCharge(getPlan("subscription"), "annual")).toBe(149_990);
    expect(subscriptionCharge(getPlan("subscription"), "monthly")).toBe(14_999);
  });
  it("computes the period end", () => {
    const start = new Date(Date.UTC(2026, 0, 15));
    expect(subscriptionPeriodEnd(start, "monthly").toISOString().slice(0, 10)).toBe("2026-02-15");
    expect(subscriptionPeriodEnd(start, "annual").toISOString().slice(0, 10)).toBe("2027-01-15");
  });
});

it("formats invoice numbers", () => {
  expect(invoiceNumber(2026, 7)).toBe("INV-2026-00007");
});
