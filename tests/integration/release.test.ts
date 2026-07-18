import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { testDb, seedClaim } from "../helpers/db";
import { createInMemoryArtifactStore } from "@/lib/storage/artifacts";
import { completeManualReview, holdClaim, releaseReport, resolveHumanReviewOutcome, resolveReleaseOptions } from "@/lib/claims/release";
import { InvalidTransitionError } from "@/lib/domain/errors";
import { updateClaimStatus } from "@/lib/db/repositories/claims";
import { insertFrame, listCropsByClaim } from "@/lib/db/repositories/evidence";
import { insertFinding } from "@/lib/db/repositories/findings";
import { getReportByClaimId } from "@/lib/db/repositories/reports";
import type { Database } from "@/lib/db/connection";

async function frame(db: Database, claimId: string, camera: "entrance" | "exit") {
  const artifacts = createInMemoryArtifactStore();
  const storedPath = `claimlens/frames/${claimId}/${camera}.jpg`;
  await artifacts.putJpeg(storedPath, await sharp({ create: { width: 400, height: 300, channels: 3, background: "#888" } }).jpeg().toBuffer());
  return { artifacts, frame: await insertFrame(db, { claimId, camera, timestampMs: 1000, storedPath }) };
}

describe("resolveReleaseOptions", () => {
  it("defaults shareEvidenceCrops to OFF", () => {
    expect(resolveReleaseOptions(undefined)).toEqual({ shareEvidenceCrops: false });
    expect(resolveReleaseOptions({})).toEqual({ shareEvidenceCrops: false });
    expect(resolveReleaseOptions({ shareEvidenceCrops: "true" })).toEqual({ shareEvidenceCrops: false });
  });
  it("enables sharing only on an explicit true", () => expect(resolveReleaseOptions({ shareEvidenceCrops: true })).toEqual({ shareEvidenceCrops: true }));
});

describe("resolveHumanReviewOutcome", () => {
  it("accepts only the two employee decision outcomes", () => {
    expect(resolveHumanReviewOutcome({ outcome: "no_new_damage_detected" })).toBe("no_new_damage_detected");
    expect(resolveHumanReviewOutcome({ outcome: "new_damage_detected" })).toBe("new_damage_detected");
    expect(() => resolveHumanReviewOutcome({ outcome: "manual_review_required" })).toThrow("Choose whether new damage was found.");
  });
});

describe("releaseReport", () => {
  it("releases without crops when sharing is off", async () => {
    const db = await testDb(); const { claim } = await seedClaim(db); const artifacts = createInMemoryArtifactStore();
    await updateClaimStatus(db, claim.id, "review_ready");
    const released = await releaseReport(db, claim.id, { shareEvidenceCrops: false }, artifacts);
    expect(released.status).toBe("released"); expect(released.shareEvidenceCrops).toBe(false); expect(await listCropsByClaim(db, claim.id)).toHaveLength(0); await db.close();
  });

  it("produces private Blob crops for the selected region when sharing is on", async () => {
    const db = await testDb(); const { claim } = await seedClaim(db); const artifacts = createInMemoryArtifactStore();
    await updateClaimStatus(db, claim.id, "review_ready");
    const entrancePath = `claimlens/frames/${claim.id}/entrance.jpg`; const exitPath = `claimlens/frames/${claim.id}/exit.jpg`;
    const image = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#888" } }).jpeg().toBuffer();
    await artifacts.putJpeg(entrancePath, image); await artifacts.putJpeg(exitPath, image);
    const entrance = await insertFrame(db, { claimId: claim.id, camera: "entrance", timestampMs: 1000, storedPath: entrancePath });
    const exit = await insertFrame(db, { claimId: claim.id, camera: "exit", timestampMs: 1000, storedPath: exitPath });
    for (const evidence of [entrance, exit]) await insertFinding(db, { claimId: claim.id, camera: evidence.camera, timestampMs: 1000, observation: "rear bumper", region: "rear_bumper", damageStatus: "pre_existing", bbox: { x: 0.3, y: 0.5, w: 0.3, h: 0.3 }, evidenceFrameIds: [evidence.id] });
    const released = await releaseReport(db, claim.id, { shareEvidenceCrops: true }, artifacts);
    const crops = await listCropsByClaim(db, claim.id);
    expect(released.shareEvidenceCrops).toBe(true); expect(crops).toHaveLength(2); expect(crops.every((crop) => crop.storedPath.startsWith("claimlens/crops/"))).toBe(true); expect(await artifacts.get(crops[0]!.storedPath)).not.toBeNull(); await db.close();
  });

  it("keeps photos unavailable when no finding has a usable bbox", async () => {
    const db = await testDb(); const { claim } = await seedClaim(db); const artifacts = createInMemoryArtifactStore();
    await updateClaimStatus(db, claim.id, "review_ready");
    const storedPath = `claimlens/frames/${claim.id}/exit.jpg`; await artifacts.putJpeg(storedPath, await sharp({ create: { width: 400, height: 300, channels: 3, background: "#888" } }).jpeg().toBuffer());
    const exit = await insertFrame(db, { claimId: claim.id, camera: "exit", timestampMs: 1000, storedPath });
    await insertFinding(db, { claimId: claim.id, camera: "exit", timestampMs: 1000, observation: "no localization", region: "rear_bumper", damageStatus: "no_damage", bbox: null, evidenceFrameIds: [exit.id] });
    await releaseReport(db, claim.id, { shareEvidenceCrops: true }, artifacts); expect(await listCropsByClaim(db, claim.id)).toHaveLength(0); await db.close();
  });

  it("refuses to release a claim that is not review_ready", async () => {
    const db = await testDb(); const { claim } = await seedClaim(db); await expect(releaseReport(db, claim.id, { shareEvidenceCrops: false }, createInMemoryArtifactStore())).rejects.toThrow(InvalidTransitionError); await db.close();
  });
  it("does not release a manual-review claim without a human determination", async () => {
    const db = await testDb(); const { claim } = await seedClaim(db); await updateClaimStatus(db, claim.id, "manual_review_required"); await expect(releaseReport(db, claim.id, { shareEvidenceCrops: false }, createInMemoryArtifactStore())).rejects.toThrow(InvalidTransitionError); await db.close();
  });
});

describe("holdClaim", () => {
  it("moves a review-ready claim to manual review", async () => {
    const db = await testDb(); const { claim } = await seedClaim(db); await updateClaimStatus(db, claim.id, "review_ready"); const held = await holdClaim(db, claim.id, "manager wants a closer look"); expect(held.status).toBe("manual_review_required"); expect(held.manualReviewReason).toBe("manager wants a closer look"); await db.close();
  });
});

describe("completeManualReview", () => {
  it("releases a human-reviewed no-damage decision to the customer", async () => {
    const db = await testDb(); const { claim } = await seedClaim(db); await updateClaimStatus(db, claim.id, "manual_review_required"); const released = await completeManualReview(db, claim.id, "no_new_damage_detected");
    expect(released.status).toBe("released"); expect(released.shareEvidenceCrops).toBe(false); expect(await getReportByClaimId(db, claim.id)).toMatchObject({ outcome: "no_new_damage_detected", conclusion: "No new damage found.", findingIds: [] }); await db.close();
  });
});
