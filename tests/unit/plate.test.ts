import { describe, expect, it } from "vitest";
import { normalizePlate, validatePlate } from "@/lib/domain/plate";
import { selectLatestVisit } from "@/lib/domain/visit-selection";
import type { Visit } from "@/lib/domain/models";

describe("normalizePlate", () => {
  it("uppercases and strips separators and whitespace", () => {
    expect(normalizePlate(" abc-123 ")).toBe("ABC123");
    expect(normalizePlate("a.b.c 1 2 3")).toBe("ABC123");
    expect(normalizePlate("7GAB-991")).toBe("7GAB991");
  });

  it("removes all non-alphanumeric characters", () => {
    expect(normalizePlate("ab_c#12@3")).toBe("ABC123");
  });

  it("returns an empty string when there are no alphanumerics", () => {
    expect(normalizePlate("---")).toBe("");
    expect(normalizePlate("   ")).toBe("");
  });

  it("is idempotent", () => {
    const once = normalizePlate("abc-123");
    expect(normalizePlate(once)).toBe(once);
  });
});

describe("validatePlate", () => {
  it("accepts a plausible plate and returns the normalized form", () => {
    expect(validatePlate("abc-123")).toEqual({
      ok: true,
      normalized: "ABC123",
    });
  });

  it("rejects plates that are empty or too short after normalization", () => {
    expect(validatePlate("--")).toEqual({
      ok: false,
      error: "Enter a valid license plate.",
    });
    expect(validatePlate("A")).toEqual({
      ok: false,
      error: "Enter a valid license plate.",
    });
  });

  it("rejects plates that are implausibly long", () => {
    expect(validatePlate("ABCDEFGHIJKLMNOP")).toEqual({
      ok: false,
      error: "Enter a valid license plate.",
    });
  });
});

function visit(id: string, occurredAt: string): Visit {
  return {
    id,
    plateNormalized: "ABC123",
    plateDisplay: "ABC-123",
    vehicleType: "car",
    occurredAt,
    sources: {},
  };
}

describe("selectLatestVisit", () => {
  it("returns null for an empty list", () => {
    expect(selectLatestVisit([])).toBeNull();
  });

  it("picks the most recent visit by occurredAt", () => {
    const visits = [
      visit("a", "2026-07-18T09:00:00.000Z"),
      visit("c", "2026-07-18T10:32:00.000Z"),
      visit("b", "2026-07-18T09:45:00.000Z"),
    ];
    expect(selectLatestVisit(visits)?.id).toBe("c");
  });

  it("breaks ties deterministically by id", () => {
    const visits = [
      visit("b", "2026-07-18T10:00:00.000Z"),
      visit("a", "2026-07-18T10:00:00.000Z"),
    ];
    expect(selectLatestVisit(visits)?.id).toBe("b");
  });

  it("does not mutate the input array", () => {
    const visits = [
      visit("a", "2026-07-18T09:00:00.000Z"),
      visit("b", "2026-07-18T10:00:00.000Z"),
    ];
    const snapshot = visits.map((v) => v.id);
    selectLatestVisit(visits);
    expect(visits.map((v) => v.id)).toEqual(snapshot);
  });
});
