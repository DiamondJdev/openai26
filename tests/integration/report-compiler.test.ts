import { describe, expect, it } from "vitest";
import { testDb, seedClaim } from "../helpers/db";
import { compileAndPersistReport } from "@/lib/agent/report-compiler";
import {
  ManualReviewRequiredError,
  UncitedFindingError,
} from "@/lib/domain/errors";
import { insertFrame } from "@/lib/db/repositories/evidence";
import { insertFinding } from "@/lib/db/repositories/findings";

function frame(db: ReturnType<typeof testDb>, claimId: string) {
  return insertFrame(db, {
    claimId,
    camera: "entrance",
    timestampMs: 1_000,
    storedPath: "/frames/x.jpg",
  });
}

describe("compileAndPersistReport", () => {
  it("throws ManualReviewRequired when there are no findings", () => {
    const db = testDb();
    const { claim } = seedClaim(db);
    expect(() => compileAndPersistReport(db, claim)).toThrow(
      ManualReviewRequiredError,
    );
  });

  it("throws ManualReviewRequired when any finding is inconclusive", () => {
    const db = testDb();
    const { claim } = seedClaim(db);
    const f = frame(db, claim.id);
    insertFinding(db, {
      claimId: claim.id,
      camera: "entrance",
      timestampMs: 1_000,
      observation: "obscured",
      region: null,
      damageStatus: "inconclusive",
      bbox: null,
      evidenceFrameIds: [f.id],
    });
    expect(() => compileAndPersistReport(db, claim)).toThrow(
      ManualReviewRequiredError,
    );
  });

  it("rejects a finding that cites a non-existent evidence frame", () => {
    const db = testDb();
    const { claim } = seedClaim(db);
    insertFinding(db, {
      claimId: claim.id,
      camera: "entrance",
      timestampMs: 1_000,
      observation: "clean",
      region: null,
      damageStatus: "no_damage",
      bbox: null,
      evidenceFrameIds: ["ghost_frame"],
    });
    expect(() => compileAndPersistReport(db, claim)).toThrow(
      UncitedFindingError,
    );
  });

  it("derives no_new_damage with high confidence when 3+ checks all agree", () => {
    const db = testDb();
    const { claim } = seedClaim(db);
    for (let i = 0; i < 3; i++) {
      const f = frame(db, claim.id);
      insertFinding(db, {
        claimId: claim.id,
        camera: "entrance",
        timestampMs: 1_000 + i,
        observation: `check ${i}`,
        region: null,
        damageStatus: i === 0 ? "pre_existing" : "no_damage",
        bbox: null,
        evidenceFrameIds: [f.id],
      });
    }
    const report = compileAndPersistReport(db, claim);
    expect(report.outcome).toBe("no_new_damage_detected");
    expect(report.confidence.level).toBe("high");
    expect(report.confidence.agreeingChecks).toBe(3);
    expect(report.findingIds).toHaveLength(3);
  });

  it("routes to manual review when one region has contradictory findings", () => {
    const db = testDb();
    const { claim } = seedClaim(db);
    const f1 = frame(db, claim.id);
    const f2 = frame(db, claim.id);
    insertFinding(db, {
      claimId: claim.id,
      camera: "entrance",
      timestampMs: 1_000,
      observation: "rear bumper looks clean",
      region: "rear_bumper",
      damageStatus: "no_damage",
      bbox: null,
      evidenceFrameIds: [f1.id],
    });
    insertFinding(db, {
      claimId: claim.id,
      camera: "exit",
      timestampMs: 2_000,
      observation: "rear bumper shows a new scratch",
      region: "rear_bumper",
      damageStatus: "new_damage",
      bbox: null,
      evidenceFrameIds: [f2.id],
    });
    expect(() => compileAndPersistReport(db, claim)).toThrow(
      ManualReviewRequiredError,
    );
  });

  it("derives new_damage_detected when a finding reports new damage", () => {
    const db = testDb();
    const { claim } = seedClaim(db);
    const f1 = frame(db, claim.id);
    const f2 = frame(db, claim.id);
    insertFinding(db, {
      claimId: claim.id,
      camera: "entrance",
      timestampMs: 1_000,
      observation: "clean before",
      region: null,
      damageStatus: "no_damage",
      bbox: null,
      evidenceFrameIds: [f1.id],
    });
    insertFinding(db, {
      claimId: claim.id,
      camera: "exit",
      timestampMs: 2_000,
      observation: "new scratch",
      region: "rear_bumper",
      damageStatus: "new_damage",
      bbox: null,
      evidenceFrameIds: [f2.id],
    });
    const report = compileAndPersistReport(db, claim);
    expect(report.outcome).toBe("new_damage_detected");
    expect(report.timeline.every((t) => t.frameId)).toBe(true);
  });
});
