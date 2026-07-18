import type { Database } from "../connection";
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
  share_evidence_crops: boolean;
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
    shareEvidenceCrops: row.share_evidence_crops,
    releasedAt: row.released_at,
    manualReviewReason: row.manual_review_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function required(rows: readonly ClaimRow[], id: string): Claim {
  const row = rows[0];
  if (!row) throw new Error(`Claim not found: ${id}`);
  return mapRow(row);
}

export interface NewClaim {
  readonly visitId: string;
  readonly vehicleType: VehicleType;
  readonly selectedRegions: readonly DamageRegion[];
  readonly managerNote: string;
}

export async function insertClaim(db: Database, input: NewClaim): Promise<Claim> {
  const id = newId("claim");
  const ts = nowIso();
  const rows = await db.query<ClaimRow>(
    `INSERT INTO claims (id, visit_id, status, vehicle_type, selected_regions,
      manager_note, share_evidence_crops, created_at, updated_at)
     VALUES ($1, $2, 'draft', $3, $4, $5, FALSE, $6, $6)
     RETURNING *`,
    [id, input.visitId, input.vehicleType, JSON.stringify(input.selectedRegions), input.managerNote, ts],
  );
  return required(rows, id);
}

export async function getClaimById(db: Database, id: string): Promise<Claim | null> {
  const rows = await db.query<ClaimRow>("SELECT * FROM claims WHERE id = $1", [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getClaimByIdOrThrow(db: Database, id: string): Promise<Claim> {
  const claim = await getClaimById(db, id);
  if (!claim) throw new Error(`Claim not found: ${id}`);
  return claim;
}

/** Live queue, newest first. */
export async function listClaims(db: Database): Promise<Claim[]> {
  return (await db.query<ClaimRow>("SELECT * FROM claims ORDER BY created_at DESC, id DESC")).map(mapRow);
}

export async function updateClaimStatus(db: Database, id: string, status: ClaimStatus): Promise<Claim> {
  const rows = await db.query<ClaimRow>(
    "UPDATE claims SET status = $1, updated_at = $2 WHERE id = $3 RETURNING *",
    [status, nowIso(), id],
  );
  return required(rows, id);
}

export async function setClaimSelection(
  db: Database,
  id: string,
  vehicleType: VehicleType,
  selectedRegions: readonly DamageRegion[],
): Promise<Claim> {
  const rows = await db.query<ClaimRow>(
    `UPDATE claims SET vehicle_type = $1, selected_regions = $2, updated_at = $3
     WHERE id = $4 RETURNING *`,
    [vehicleType, JSON.stringify(selectedRegions), nowIso(), id],
  );
  return required(rows, id);
}

/** Low-level status mutator for the investigation loop/compiler. */
export async function attachReport(
  db: Database,
  id: string,
  reportId: string,
  status: ClaimStatus,
): Promise<Claim> {
  const rows = await db.query<ClaimRow>(
    `UPDATE claims SET report_id = $1, status = $2, updated_at = $3
     WHERE id = $4 RETURNING *`,
    [reportId, status, nowIso(), id],
  );
  return required(rows, id);
}

export async function releaseClaim(
  db: Database,
  id: string,
  shareEvidenceCrops: boolean,
): Promise<Claim> {
  const ts = nowIso();
  const rows = await db.query<ClaimRow>(
    `UPDATE claims SET status = 'released', share_evidence_crops = $1,
      released_at = $2, updated_at = $2 WHERE id = $3 RETURNING *`,
    [shareEvidenceCrops, ts, id],
  );
  return required(rows, id);
}

export async function holdForManualReview(db: Database, id: string, reason: string): Promise<Claim> {
  const rows = await db.query<ClaimRow>(
    `UPDATE claims SET status = 'manual_review_required', manual_review_reason = $1,
      updated_at = $2 WHERE id = $3 RETURNING *`,
    [reason, nowIso(), id],
  );
  return required(rows, id);
}
