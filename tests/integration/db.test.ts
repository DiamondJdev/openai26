import { describe, expect, it } from "vitest";
import { testDb, seedClaim } from "../helpers/db";
import {
  findLatestVisitByPlate,
  insertVisit,
} from "@/lib/db/repositories/visits";
import {
  attachReport,
  getClaimById,
  holdForManualReview,
  listClaims,
  releaseClaim,
  updateClaimStatus,
} from "@/lib/db/repositories/claims";
import {
  getAccessByTokenHash,
  insertCustomerAccess,
  updateAccessThrottle,
} from "@/lib/db/repositories/customer-access";
import {
  insertUpload,
  listUploadsByClaim,
} from "@/lib/db/repositories/uploads";
import {
  insertCrop,
  insertFrame,
  listFramesByClaim,
} from "@/lib/db/repositories/evidence";
import {
  insertFinding,
  listFindingsByClaim,
} from "@/lib/db/repositories/findings";
import { appendEvent, listEventsByClaim } from "@/lib/db/repositories/events";
import {
  getReportByClaimId,
  insertReport,
} from "@/lib/db/repositories/reports";

describe("db layer", () => {
  it("selects the latest visit for a normalized plate", () => {
    const db = testDb();
    insertVisit(db, {
      plateNormalized: "ABC123",
      plateDisplay: "ABC-123",
      vehicleType: "car",
      occurredAt: "2026-07-18T09:00:00.000Z",
    });
    const latest = insertVisit(db, {
      plateNormalized: "ABC123",
      plateDisplay: "ABC-123",
      vehicleType: "car",
      occurredAt: "2026-07-18T10:32:00.000Z",
    });
    expect(findLatestVisitByPlate(db, "ABC123")?.id).toBe(latest.id);
    expect(findLatestVisitByPlate(db, "NOPE")).toBeNull();
  });

  it("creates a draft claim and lists it in the queue", () => {
    const db = testDb();
    const { claim } = seedClaim(db);
    expect(claim.status).toBe("draft");
    expect(claim.shareEvidenceCrops).toBe(false);
    expect(listClaims(db).map((c) => c.id)).toContain(claim.id);
  });

  it("moves a claim through release with crop sharing on", () => {
    const db = testDb();
    const { claim } = seedClaim(db);
    updateClaimStatus(db, claim.id, "review_ready");
    const released = releaseClaim(db, claim.id, true);
    expect(released.status).toBe("released");
    expect(released.shareEvidenceCrops).toBe(true);
    expect(released.releasedAt).not.toBeNull();
  });

  it("holds a claim for manual review with a reason", () => {
    const db = testDb();
    const { claim } = seedClaim(db);
    const held = holdForManualReview(db, claim.id, "obscured footage");
    expect(held.status).toBe("manual_review_required");
    expect(held.manualReviewReason).toBe("obscured footage");
  });

  it("stores customer access and looks up by token hash + updates throttle", () => {
    const db = testDb();
    const { claim } = seedClaim(db);
    const access = insertCustomerAccess(db, {
      claimId: claim.id,
      tokenHash: "tok-hash",
      pinHash: "pin-hash",
    });
    expect(getAccessByTokenHash(db, "tok-hash")?.id).toBe(access.id);
    updateAccessThrottle(db, access.id, 3, "2026-07-18T11:00:00.000Z");
    expect(getAccessByTokenHash(db, "tok-hash")?.failedAttempts).toBe(3);
  });

  it("persists uploads, frames, crops, findings and events scoped to a claim", () => {
    const db = testDb();
    const { claim } = seedClaim(db);

    insertUpload(db, {
      claimId: claim.id,
      kind: "plate",
      storedPath: "/data/uploads/x.jpg",
      mime: "image/jpeg",
      width: 800,
      height: 600,
      bytes: 1234,
      sha256: "abc",
    });
    expect(listUploadsByClaim(db, claim.id)).toHaveLength(1);

    const frame = insertFrame(db, {
      claimId: claim.id,
      camera: "entrance",
      timestampMs: 10_000,
      storedPath: "/data/frames/e.jpg",
    });
    insertCrop(db, {
      claimId: claim.id,
      frameId: frame.id,
      camera: "entrance",
      region: "rear_bumper",
      storedPath: "/data/crops/c.jpg",
    });
    expect(listFramesByClaim(db, claim.id)).toHaveLength(1);

    const finding = insertFinding(db, {
      claimId: claim.id,
      camera: "entrance",
      timestampMs: 10_000,
      observation: "existing dent, unchanged",
      region: "rear_bumper",
      damageStatus: "pre_existing",
      bbox: null,
      evidenceFrameIds: [frame.id],
    });
    expect(finding.evidenceFrameIds).toEqual([frame.id]);
    expect(listFindingsByClaim(db, claim.id)).toHaveLength(1);

    const e1 = appendEvent(db, {
      claimId: claim.id,
      type: "started",
      plainLanguage: "Investigation started",
    });
    const e2 = appendEvent(db, {
      claimId: claim.id,
      type: "observation",
      plainLanguage: "Vehicle enters",
      detail: { camera: "entrance", timestampMs: 10_000, frameId: frame.id },
    });
    expect([e1.seq, e2.seq]).toEqual([0, 1]);
    expect(listEventsByClaim(db, claim.id)).toHaveLength(2);
  });

  it("stores a report and attaches it to the claim", () => {
    const db = testDb();
    const { claim } = seedClaim(db);
    const frame = insertFrame(db, {
      claimId: claim.id,
      camera: "exit",
      timestampMs: 20_000,
      storedPath: "/data/frames/x.jpg",
    });
    const finding = insertFinding(db, {
      claimId: claim.id,
      camera: "exit",
      timestampMs: 20_000,
      observation: "no new damage",
      region: null,
      damageStatus: "no_damage",
      bbox: null,
      evidenceFrameIds: [frame.id],
    });
    const report = insertReport(db, {
      claimId: claim.id,
      outcome: "no_new_damage_detected",
      summary: "No evidence the wash caused new damage.",
      conclusion: "No evidence the wash caused new damage.",
      timeline: [
        {
          timestampMs: 20_000,
          camera: "exit",
          label: "Vehicle exits",
          frameId: frame.id,
        },
      ],
      findingIds: [finding.id],
      confidence: {
        level: "high",
        agreeingChecks: 3,
        totalChecks: 3,
        rationale: "3/3 checks consistent",
      },
    });
    attachReport(db, claim.id, report.id, "review_ready");
    expect(getReportByClaimId(db, claim.id)?.outcome).toBe(
      "no_new_damage_detected",
    );
    expect(getClaimById(db, claim.id)?.reportId).toBe(report.id);
  });
});
