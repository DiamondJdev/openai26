import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { testDb, seedClaim } from "../helpers/db";
import {
  completeManualReview,
  holdClaim,
  releaseReport,
  resolveHumanReviewOutcome,
  resolveReleaseOptions,
} from "@/lib/claims/release";
import { InvalidTransitionError } from "@/lib/domain/errors";
import { updateClaimStatus } from "@/lib/db/repositories/claims";
import { insertFrame, listCropsByClaim } from "@/lib/db/repositories/evidence";
import { insertFinding } from "@/lib/db/repositories/findings";
import { getReportByClaimId } from "@/lib/db/repositories/reports";

let tmp: string;
let cropsDir: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "claimlens-rel-"));
  cropsDir = path.join(tmp, "crops");
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function frameOnDisk(
  db: ReturnType<typeof testDb>,
  claimId: string,
  camera: "entrance" | "exit",
) {
  const p = path.join(tmp, `${camera}.jpg`);
  await sharp({ create: { width: 400, height: 300, channels: 3, background: "#888" } })
    .jpeg()
    .toFile(p);
  return insertFrame(db, { claimId, camera, timestampMs: 1000, storedPath: p });
}

describe("resolveReleaseOptions", () => {
  it("defaults shareEvidenceCrops to OFF", () => {
    expect(resolveReleaseOptions(undefined)).toEqual({ shareEvidenceCrops: false });
    expect(resolveReleaseOptions({})).toEqual({ shareEvidenceCrops: false });
    expect(resolveReleaseOptions({ shareEvidenceCrops: "true" })).toEqual({
      shareEvidenceCrops: false,
    });
  });

  it("enables sharing only on an explicit true", () => {
    expect(resolveReleaseOptions({ shareEvidenceCrops: true })).toEqual({
      shareEvidenceCrops: true,
    });
  });
});

describe("resolveHumanReviewOutcome", () => {
  it("accepts only the two employee decision outcomes", () => {
    expect(resolveHumanReviewOutcome({ outcome: "no_new_damage_detected" })).toBe(
      "no_new_damage_detected",
    );
    expect(resolveHumanReviewOutcome({ outcome: "new_damage_detected" })).toBe(
      "new_damage_detected",
    );
    expect(() =>
      resolveHumanReviewOutcome({ outcome: "manual_review_required" }),
    ).toThrow("Choose whether new damage was found.");
  });
});

describe("releaseReport", () => {
  it("releases without crops when sharing is off", async () => {
    const db = testDb();
    const { claim } = seedClaim(db);
    updateClaimStatus(db, claim.id, "review_ready");
    const released = await releaseReport(
      db,
      claim.id,
      { shareEvidenceCrops: false },
      cropsDir,
    );
    expect(released.status).toBe("released");
    expect(released.shareEvidenceCrops).toBe(false);
    expect(listCropsByClaim(db, claim.id)).toHaveLength(0);
  });

  it("produces focused crops for the selected region when sharing is on", async () => {
    const db = testDb();
    const { claim } = seedClaim(db); // selectedRegions: ["rear_bumper"]
    updateClaimStatus(db, claim.id, "review_ready");
    const entrance = await frameOnDisk(db, claim.id, "entrance");
    const exit = await frameOnDisk(db, claim.id, "exit");
    insertFinding(db, {
      claimId: claim.id,
      camera: "entrance",
      timestampMs: 1000,
      observation: "rear bumper before",
      region: "rear_bumper",
      damageStatus: "pre_existing",
      bbox: { x: 0.3, y: 0.5, w: 0.3, h: 0.3 },
      evidenceFrameIds: [entrance.id],
    });
    insertFinding(db, {
      claimId: claim.id,
      camera: "exit",
      timestampMs: 1000,
      observation: "rear bumper after",
      region: "rear_bumper",
      damageStatus: "pre_existing",
      bbox: { x: 0.3, y: 0.5, w: 0.3, h: 0.3 },
      evidenceFrameIds: [exit.id],
    });
    const released = await releaseReport(
      db,
      claim.id,
      { shareEvidenceCrops: true },
      cropsDir,
    );
    expect(released.shareEvidenceCrops).toBe(true);
    const crops = listCropsByClaim(db, claim.id);
    expect(crops).toHaveLength(2);
    expect(crops.every((c) => fs.existsSync(c.storedPath))).toBe(true);
  });

  it("keeps photos unavailable when no finding has a usable bbox", async () => {
    const db = testDb();
    const { claim } = seedClaim(db);
    updateClaimStatus(db, claim.id, "review_ready");
    const exit = await frameOnDisk(db, claim.id, "exit");
    insertFinding(db, {
      claimId: claim.id,
      camera: "exit",
      timestampMs: 1000,
      observation: "no localization",
      region: "rear_bumper",
      damageStatus: "no_damage",
      bbox: null,
      evidenceFrameIds: [exit.id],
    });
    await releaseReport(db, claim.id, { shareEvidenceCrops: true }, cropsDir);
    expect(listCropsByClaim(db, claim.id)).toHaveLength(0);
  });

  it("refuses to release a claim that is not review_ready", async () => {
    const db = testDb();
    const { claim } = seedClaim(db); // draft
    await expect(
      releaseReport(db, claim.id, { shareEvidenceCrops: false }, cropsDir),
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("does not release a manual-review claim without a human determination", async () => {
    const db = testDb();
    const { claim } = seedClaim(db);
    updateClaimStatus(db, claim.id, "manual_review_required");

    await expect(
      releaseReport(db, claim.id, { shareEvidenceCrops: false }, cropsDir),
    ).rejects.toThrow(InvalidTransitionError);
  });
});

describe("holdClaim", () => {
  it("moves a review-ready claim to manual review", () => {
    const db = testDb();
    const { claim } = seedClaim(db);
    updateClaimStatus(db, claim.id, "review_ready");
    const held = holdClaim(db, claim.id, "manager wants a closer look");
    expect(held.status).toBe("manual_review_required");
    expect(held.manualReviewReason).toBe("manager wants a closer look");
  });
});

describe("completeManualReview", () => {
  it("releases a human-reviewed no-damage decision to the customer", () => {
    const db = testDb();
    const { claim } = seedClaim(db);
    updateClaimStatus(db, claim.id, "manual_review_required");

    const released = completeManualReview(
      db,
      claim.id,
      "no_new_damage_detected",
    );

    expect(released.status).toBe("released");
    expect(released.shareEvidenceCrops).toBe(false);
    expect(getReportByClaimId(db, claim.id)).toMatchObject({
      outcome: "no_new_damage_detected",
      conclusion: "No new damage found.",
      summary:
        "A human employee manually reviewed your case and determined no new damage was found.",
      findingIds: [],
    });
  });
});
