import { describe, expect, it } from "vitest";
import { REDACTION, scanMessage } from "@/lib/contact-guard";

describe("scanMessage", () => {
  it("leaves normal recruiting conversation untouched", () => {
    const text = "Thanks! I worked there from 2019 - 2021 and my CTC is ₹12,00,000. Happy to interview on Tuesday at 11.";
    const r = scanMessage(text);
    expect(r.flagged).toBe(false);
    expect(r.redacted).toBe(text);
  });

  it("allows platform relay addresses", () => {
    const r = scanMessage("You can also reply to hr_53543@panel.com");
    expect(r.flagged).toBe(false);
  });

  it("redacts personal email addresses, including obfuscated ones", () => {
    for (const text of ["mail me at rahul.k@gmail.com", "rahul at gmail dot com", "rahul [at] yahoo [dot] in", "rahul(at)outlook.com"]) {
      const r = scanMessage(text);
      expect(r.reasons, text).toContain("email");
      expect(r.redacted, text).toContain(REDACTION);
      expect(r.redacted).not.toMatch(/gmail|yahoo|outlook/);
    }
  });

  it("redacts phone numbers in common formats", () => {
    for (const text of ["+91 98765 43210", "9876543210", "098765-43210", "(022) 2345 6789"]) {
      const r = scanMessage(`Call ${text} please`);
      expect(r.reasons, text).toContain("phone");
      expect(r.redacted).toContain(REDACTION);
    }
  });

  it("detects numbers spelled out in words", () => {
    const r = scanMessage("my number is nine eight seven six five four three two one zero");
    expect(r.reasons).toContain("spelled_number");
    expect(r.reasons).toContain("contact_request");
  });

  it("redacts WhatsApp/Telegram links and flags app mentions", () => {
    const r = scanMessage("Ping me on WhatsApp: https://wa.me/919876543210 or t.me/rahul");
    expect(r.reasons).toEqual(expect.arrayContaining(["messaging_link", "messaging_app"]));
    expect(r.redacted).not.toContain("wa.me");
    expect(r.redacted).not.toContain("t.me");
  });

  it("does not flag sequences of years", () => {
    expect(scanMessage("Roles held: 2016 2018 2020 2022").flagged).toBe(false);
  });
});
