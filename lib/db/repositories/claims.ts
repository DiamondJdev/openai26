import type { DB } from "../connection";
import type { Claim } from "@/lib/domain/models";
import type { ClaimStatus } from "@/lib/domain/claim-status";
import type { DamageRegion } from "@/lib/domain/regions";
import type { VehicleType } from "@/lib/domain/vehicle";
import { newId } from "@/lib/util/id";
import { nowIso } from "@/lib/util/time";

interface ClaimRow {
  id: string;
  visit_id: string;
  status: string;
  vehicle_type: string;
  selected_regions: string;
  manager_note: string;
  report_id: string | null;
  share_evidence_crops: number;
  released_at: string | null;
  manual_review_reason: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: ClaimRow): Claim {
  return {
    id: row.id,
    visitId: row.visit_id,
    status: row.status as ClaimStatus,
    vehicleType: row.vehicle_type as VehicleType,
    selectedRegions: JSON.parse(row.selected_regions) as DamageRegion[],
    managerNote: row.manager_note,
    reportId: row.report_id,
    shareEvidenceCrops: row.share_evidence_crops === 1,
    releasedAt: row.released_at,
    manualReviewReason: row.manual_review_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface NewClaim {
  readonly visitId: string;
  readonly vehicleType: VehicleType;
  readonly selectedRegions: readonly DamageRegion[];
  readonly managerNote: string;
}

export function insertClaim(db: DB, input: NewClaim): Claim {
  const ts = nowIso();
  const id = newId("claim");
  db.prepare(
    `INSERT INTO claims (id, visit_id, status, vehicle_type, selected_regions,
        manager_note, share_evidence_crops, created_at, updated_at)
     VALUES (@id, @visitId, 'draft', @vehicleType, @selectedRegions,
        @managerNote, 0, @ts, @ts)`,
  ).run({
    id,
    visitId: input.visitId,
    vehicleType: input.vehicleType,
    selectedRegions: JSON.stringify(input.selectedRegions),
    managerNote: input.managerNote,
    ts,
  });
  return getClaimByIdOrThrow(db, id);
}

export function getClaimById(db: DB, id: string): Claim | null {
  const row = db.prepare("SELECT * FROM claims WHERE id = ?").get(id) as
    ClaimRow | undefined;
  return row ? mapRow(row) : null;
}

export function getClaimByIdOrThrow(db: DB, id: string): Claim {
  const claim = getClaimById(db, id);
  if (!claim) throw new Error(`Claim not found: ${id}`);
  return claim;
}

/** Live queue, newest first. */
export function listClaims(db: DB): Claim[] {
  const rows = db
    .prepare("SELECT * FROM claims ORDER BY created_at DESC, id DESC")
    .all() as ClaimRow[];
  return rows.map(mapRow);
}

export function updateClaimStatus(
  db: DB,
  id: string,
  status: ClaimStatus,
): Claim {
  db.prepare(
    "UPDATE claims SET status = @status, updated_at = @ts WHERE id = @id",
  ).run({ id, status, ts: nowIso() });
  return getClaimByIdOrThrow(db, id);
}

export function setClaimSelection(
  db: DB,
  id: string,
  vehicleType: VehicleType,
  selectedRegions: readonly DamageRegion[],
): Claim {
  db.prepare(
    `UPDATE claims SET vehicle_type = @vehicleType,
        selected_regions = @selectedRegions, updated_at = @ts WHERE id = @id`,
  ).run({
    id,
    vehicleType,
    selectedRegions: JSON.stringify(selectedRegions),
    ts: nowIso(),
  });
  return getClaimByIdOrThrow(db, id);
}

/**
 * Low-level status mutator. Callers are responsible for validating the
 * transition (assertTransition) — this is only reached from the investigation
 * loop/compiler, which run exclusively from the `investigating` state.
 */
export function attachReport(
  db: DB,
  id: string,
  reportId: string,
  status: ClaimStatus,
): Claim {
  db.prepare(
    "UPDATE claims SET report_id = @reportId, status = @status, updated_at = @ts WHERE id = @id",
  ).run({ id, reportId, status, ts: nowIso() });
  return getClaimByIdOrThrow(db, id);
}

export function releaseClaim(
  db: DB,
  id: string,
  shareEvidenceCrops: boolean,
): Claim {
  const ts = nowIso();
  db.prepare(
    `UPDATE claims SET status = 'released', share_evidence_crops = @share,
        released_at = @ts, updated_at = @ts WHERE id = @id`,
  ).run({ id, share: shareEvidenceCrops ? 1 : 0, ts });
  return getClaimByIdOrThrow(db, id);
}

export function holdForManualReview(db: DB, id: string, reason: string): Claim {
  db.prepare(
    `UPDATE claims SET status = 'manual_review_required',
        manual_review_reason = @reason, updated_at = @ts WHERE id = @id`,
  ).run({ id, reason, ts: nowIso() });
  return getClaimByIdOrThrow(db, id);
}
