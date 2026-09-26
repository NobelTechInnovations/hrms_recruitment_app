import { describe, expect, it } from "vitest";
import { allowedNextStages, canTransition, stageMessage } from "@/lib/pipeline";

describe("canTransition", () => {
  it("lets companies move forward, skip stages and reject", () => {
    expect(canTransition("applied", "screening", "company").ok).toBe(true);
    expect(canTransition("applied", "interview_1", "company").ok).toBe(true);
    expect(canTransition("hr_interview", "rejected", "company").ok).toBe(true);
  });

  it("requires Selected before Offer and Offer before Joined", () => {
    expect(canTransition("hr_interview", "offer", "company").ok).toBe(false);
    expect(canTransition("selected", "offer", "company").ok).toBe(true);
    expect(canTransition("selected", "joined", "company").ok).toBe(false);
    expect(canTransition("offer", "joined", "company").ok).toBe(true);
  });

  it("prevents moving a selected candidate backwards", () => {
    expect(canTransition("offer", "interview_1", "company").ok).toBe(false);
  });

  it("only candidates can withdraw, and only before a terminal stage", () => {
    expect(canTransition("shortlisted", "withdrawn", "company").ok).toBe(false);
    expect(canTransition("shortlisted", "withdrawn", "candidate").ok).toBe(true);
    expect(canTransition("shortlisted", "offer", "candidate").ok).toBe(false);
    expect(canTransition("joined", "withdrawn", "candidate").ok).toBe(false);
    expect(canTransition("rejected", "screening", "company").ok).toBe(false);
  });

  it("lists allowed next stages", () => {
    expect(allowedNextStages("selected")).toEqual(["offer", "rejected"]);
    expect(allowedNextStages("joined")).toEqual([]);
  });
});

it("uses the README's notification wording for shortlisting", () => {
  expect(stageMessage("shortlisted", "Backend Engineer", "XYZ Pvt Ltd").title).toBe("Your application has been shortlisted.");
});
