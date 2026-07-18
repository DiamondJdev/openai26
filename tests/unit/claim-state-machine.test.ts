import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  nextStatuses,
} from "@/lib/domain/claim-state-machine";
import { InvalidTransitionError } from "@/lib/domain/errors";
import { CLAIM_STATUSES } from "@/lib/domain/claim-status";

describe("claim state machine", () => {
  it("allows the happy-path lifecycle", () => {
    expect(canTransition("draft", "customer_submitted")).toBe(true);
    expect(canTransition("customer_submitted", "investigating")).toBe(true);
    expect(canTransition("investigating", "review_ready")).toBe(true);
    expect(canTransition("review_ready", "released")).toBe(true);
  });

  it("allows manual review from investigating and review_ready", () => {
    expect(canTransition("investigating", "manual_review_required")).toBe(true);
    expect(canTransition("review_ready", "manual_review_required")).toBe(true);
  });

  it("forbids skipping states", () => {
    expect(canTransition("draft", "investigating")).toBe(false);
    expect(canTransition("customer_submitted", "review_ready")).toBe(false);
    expect(canTransition("draft", "released")).toBe(false);
  });

  it("treats released and manual_review_required as terminal", () => {
    expect(nextStatuses("released")).toEqual([]);
    expect(nextStatuses("manual_review_required")).toEqual([]);
  });

  it("forbids self-transitions", () => {
    for (const status of CLAIM_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("assertTransition throws InvalidTransitionError on an illegal move", () => {
    expect(() => assertTransition("released", "investigating")).toThrow(
      InvalidTransitionError,
    );
    expect(() => assertTransition("draft", "customer_submitted")).not.toThrow();
  });

  it("nextStatuses lists exactly the reachable states", () => {
    expect([...nextStatuses("investigating")].sort()).toEqual(
      ["manual_review_required", "review_ready"].sort(),
    );
    expect(nextStatuses("draft")).toEqual(["customer_submitted"]);
  });
});
