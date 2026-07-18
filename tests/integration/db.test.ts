import { describe, expect, it } from "vitest";
import { testDb, seedClaim } from "../helpers/db";
import { findLatestVisitByPlate, insertVisit } from "@/lib/db/repositories/visits";
import { attachReport, getClaimById, holdForManualReview, listClaims, releaseClaim, updateClaimStatus } from "@/lib/db/repositories/claims";
import { getAccessByTokenHash, insertCustomerAccess, updateAccessThrottle } from "@/lib/db/repositories/customer-access";
import { insertUpload, listUploadsByClaim } from "@/lib/db/repositories/uploads";
import { insertCrop, insertFrame, listFramesByClaim } from "@/lib/db/repositories/evidence";
import { insertFinding, listFindingsByClaim } from "@/lib/db/repositories/findings";
import { appendEvent, listEventsByClaim } from "@/lib/db/repositories/events";
import { getReportByClaimId, insertReport } from "@/lib/db/repositories/reports";

describe("db layer", () => {
  it("selects the latest visit for a normalized plate", async () => {
    const db = await testDb();
    await insertVisit(db, { plateNormalized: "ABC123", plateDisplay: "ABC-123", vehicleType: "car", occurredAt: "2026-07-18T09:00:00.000Z" });
    const latest = await insertVisit(db, { plateNormalized: "ABC123", plateDisplay: "ABC-123", vehicleType: "car", occurredAt: "2026-07-18T10:32:00.000Z" });
    expect((await findLatestVisitByPlate(db, "ABC123"))?.id).toBe(latest.id);
    expect(await findLatestVisitByPlate(db, "NOPE")).toBeNull();
    await db.close();
  });

  it("creates a draft claim and lists it in the queue", async () => {
    const db = await testDb();
    const { claim } = await seedClaim(db);
    expect(claim.status).toBe("draft");
    expect(claim.shareEvidenceCrops).toBe(false);
    expect((await listClaims(db)).map((item) => item.id)).toContain(claim.id);
    await db.close();
  });

  it("moves a claim through release with crop sharing on", async () => {
    const db = await testDb();
    const { claim } = await seedClaim(db);
    await updateClaimStatus(db, claim.id, "review_ready");
    const released = await releaseClaim(db, claim.id, true);
    expect(released.status).toBe("released");
    expect(released.shareEvidenceCrops).toBe(true);
    expect(released.releasedAt).not.toBeNull();
    await db.close();
  });

  it("holds a claim for manual review with a reason", async () => {
    const db = await testDb();
    const { claim } = await seedClaim(db);
    const held = await holdForManualReview(db, claim.id, "obscured footage");
    expect(held.status).toBe("manual_review_required");
    expect(held.manualReviewReason).toBe("obscured footage");
    await db.close();
  });

  it("stores customer access and updates its throttle", async () => {
    const db = await testDb();
    const { claim } = await seedClaim(db);
    const access = await insertCustomerAccess(db, { claimId: claim.id, tokenHash: "tok-hash", pinHash: "pin-hash" });
    expect((await getAccessByTokenHash(db, "tok-hash"))?.id).toBe(access.id);
    await updateAccessThrottle(db, access.id, 3, "2026-07-18T11:00:00.000Z");
    expect((await getAccessByTokenHash(db, "tok-hash"))?.failedAttempts).toBe(3);
    await db.close();
  });

  it("persists private artifact pathnames and assigns concurrent event sequences", async () => {
    const db = await testDb();
    const { claim } = await seedClaim(db);
    await insertUpload(db, { claimId: claim.id, kind: "plate", storedPath: "claimlens/uploads/claim/x.jpg", mime: "image/jpeg", width: 800, height: 600, bytes: 1234, sha256: "abc" });
    expect(await listUploadsByClaim(db, claim.id)).toHaveLength(1);
    const frame = await insertFrame(db, { claimId: claim.id, camera: "entrance", timestampMs: 10_000, storedPath: "claimlens/frames/claim/e.jpg" });
    await insertCrop(db, { claimId: claim.id, frameId: frame.id, camera: "entrance", region: "rear_bumper", storedPath: "claimlens/crops/claim/c.jpg" });
    expect(await listFramesByClaim(db, claim.id)).toHaveLength(1);
    const finding = await insertFinding(db, { claimId: claim.id, camera: "entrance", timestampMs: 10_000, observation: "existing dent, unchanged", region: "rear_bumper", damageStatus: "pre_existing", bbox: null, evidenceFrameIds: [frame.id] });
    expect(finding.evidenceFrameIds).toEqual([frame.id]);
    expect(await listFindingsByClaim(db, claim.id)).toHaveLength(1);
    const input = { claimId: claim.id, type: "started" as const, plainLanguage: "Investigation started" };
    const [first, second] = await Promise.all([appendEvent(db, input), appendEvent(db, input)]);
    expect([first.seq, second.seq].sort()).toEqual([0, 1]);
    expect(await listEventsByClaim(db, claim.id)).toHaveLength(2);
    await db.close();
  });

  it("stores a report and attaches it to the claim", async () => {
    const db = await testDb();
    const { claim } = await seedClaim(db);
    const frame = await insertFrame(db, { claimId: claim.id, camera: "exit", timestampMs: 20_000, storedPath: "claimlens/frames/claim/x.jpg" });
    const finding = await insertFinding(db, { claimId: claim.id, camera: "exit", timestampMs: 20_000, observation: "no new damage", region: null, damageStatus: "no_damage", bbox: null, evidenceFrameIds: [frame.id] });
    const report = await insertReport(db, { claimId: claim.id, outcome: "no_new_damage_detected", summary: "No evidence the wash caused new damage.", conclusion: "No evidence the wash caused new damage.", timeline: [{ timestampMs: 20_000, camera: "exit", label: "Vehicle exits", frameId: frame.id }], findingIds: [finding.id], confidence: { level: "high", agreeingChecks: 3, totalChecks: 3, rationale: "3/3 checks consistent" } });
    await attachReport(db, claim.id, report.id, "review_ready");
    expect((await getReportByClaimId(db, claim.id))?.outcome).toBe("no_new_damage_detected");
    expect((await getClaimById(db, claim.id))?.reportId).toBe(report.id);
    await db.close();
  });
});
