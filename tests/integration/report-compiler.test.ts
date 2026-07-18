import { describe, expect, it } from "vitest";
import { testDb, seedClaim } from "../helpers/db";
import { compileAndPersistReport } from "@/lib/agent/report-compiler";
import { ManualReviewRequiredError, UncitedFindingError } from "@/lib/domain/errors";
import { insertFrame } from "@/lib/db/repositories/evidence";
import { insertFinding } from "@/lib/db/repositories/findings";
import type { Database } from "@/lib/db/connection";

async function frame(db: Database, claimId: string) {
  return await insertFrame(db, { claimId, camera: "entrance", timestampMs: 1_000, storedPath: "claimlens/frames/claim/x.jpg" });
}

describe("compileAndPersistReport", () => {
  it("throws ManualReviewRequired when there are no findings", async () => {
    const db = await testDb(); const { claim } = await seedClaim(db);
    await expect(compileAndPersistReport(db, claim)).rejects.toBeInstanceOf(ManualReviewRequiredError);
    await db.close();
  });

  it("throws ManualReviewRequired when any finding is inconclusive", async () => {
    const db = await testDb(); const { claim } = await seedClaim(db); const evidence = await frame(db, claim.id);
    await insertFinding(db, { claimId: claim.id, camera: "entrance", timestampMs: 1_000, observation: "obscured", region: null, damageStatus: "inconclusive", bbox: null, evidenceFrameIds: [evidence.id] });
    await expect(compileAndPersistReport(db, claim)).rejects.toBeInstanceOf(ManualReviewRequiredError);
    await db.close();
  });

  it("rejects a finding that cites a non-existent evidence frame", async () => {
    const db = await testDb(); const { claim } = await seedClaim(db);
    await insertFinding(db, { claimId: claim.id, camera: "entrance", timestampMs: 1_000, observation: "clean", region: null, damageStatus: "no_damage", bbox: null, evidenceFrameIds: ["ghost_frame"] });
    await expect(compileAndPersistReport(db, claim)).rejects.toBeInstanceOf(UncitedFindingError);
    await db.close();
  });

  it("derives no_new_damage with high confidence when 3+ checks all agree", async () => {
    const db = await testDb(); const { claim } = await seedClaim(db);
    for (let index = 0; index < 3; index += 1) {
      const evidence = await frame(db, claim.id);
      await insertFinding(db, { claimId: claim.id, camera: "entrance", timestampMs: 1_000 + index, observation: `check ${index}`, region: null, damageStatus: index === 0 ? "pre_existing" : "no_damage", bbox: null, evidenceFrameIds: [evidence.id] });
    }
    const report = await compileAndPersistReport(db, claim);
    expect(report.outcome).toBe("no_new_damage_detected"); expect(report.confidence.level).toBe("high"); expect(report.confidence.agreeingChecks).toBe(3); expect(report.findingIds).toHaveLength(3);
    await db.close();
  });

  it("routes to manual review when one region has contradictory findings", async () => {
    const db = await testDb(); const { claim } = await seedClaim(db); const before = await frame(db, claim.id); const after = await frame(db, claim.id);
    await insertFinding(db, { claimId: claim.id, camera: "entrance", timestampMs: 1_000, observation: "rear bumper looks clean", region: "rear_bumper", damageStatus: "no_damage", bbox: null, evidenceFrameIds: [before.id] });
    await insertFinding(db, { claimId: claim.id, camera: "exit", timestampMs: 2_000, observation: "rear bumper shows a new scratch", region: "rear_bumper", damageStatus: "new_damage", bbox: null, evidenceFrameIds: [after.id] });
    await expect(compileAndPersistReport(db, claim)).rejects.toBeInstanceOf(ManualReviewRequiredError);
    await db.close();
  });

  it("derives new_damage_detected when a finding reports new damage", async () => {
    const db = await testDb(); const { claim } = await seedClaim(db); const before = await frame(db, claim.id); const after = await frame(db, claim.id);
    await insertFinding(db, { claimId: claim.id, camera: "entrance", timestampMs: 1_000, observation: "clean before", region: null, damageStatus: "no_damage", bbox: null, evidenceFrameIds: [before.id] });
    await insertFinding(db, { claimId: claim.id, camera: "exit", timestampMs: 2_000, observation: "new scratch", region: "rear_bumper", damageStatus: "new_damage", bbox: null, evidenceFrameIds: [after.id] });
    const report = await compileAndPersistReport(db, claim);
    expect(report.outcome).toBe("new_damage_detected"); expect(report.timeline.every((entry) => entry.frameId)).toBe(true);
    await db.close();
  });
});
