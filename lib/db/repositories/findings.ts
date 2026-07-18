import type { DB } from "../connection";
import type { DamageStatus, Finding } from "@/lib/domain/report";
import type { CameraId } from "@/lib/domain/cameras";
import type { DamageRegion } from "@/lib/domain/regions";
import type { NormalizedBBox } from "@/lib/domain/geometry";
import { newId } from "@/lib/util/id";
import { nowIso } from "@/lib/util/time";

interface FindingRow {
  id: string;
  claim_id: string;
  camera: string;
  timestamp_ms: number;
  observation: string;
  region: string | null;
  damage_status: string;
  bbox: string | null;
  evidence_frame_ids: string;
  created_at: string;
}

function mapRow(row: FindingRow): Finding {
  return {
    id: row.id,
    claimId: row.claim_id,
    camera: row.camera as CameraId,
    timestampMs: row.timestamp_ms,
    observation: row.observation,
    region: (row.region as DamageRegion | null) ?? null,
    damageStatus: row.damage_status as DamageStatus,
    bbox: row.bbox ? (JSON.parse(row.bbox) as NormalizedBBox) : null,
    evidenceFrameIds: JSON.parse(row.evidence_frame_ids) as string[],
    createdAt: row.created_at,
  };
}

export interface NewFinding {
  readonly claimId: string;
  readonly camera: CameraId;
  readonly timestampMs: number;
  readonly observation: string;
  readonly region: DamageRegion | null;
  readonly damageStatus: DamageStatus;
  readonly bbox: NormalizedBBox | null;
  readonly evidenceFrameIds: readonly string[];
}

export function insertFinding(db: DB, input: NewFinding): Finding {
  const id = newId("finding");
  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO findings (id, claim_id, camera, timestamp_ms, observation, region, damage_status, bbox, evidence_frame_ids, created_at)
     VALUES (@id, @claimId, @camera, @timestampMs, @observation, @region, @damageStatus, @bbox, @evidenceFrameIds, @createdAt)`,
  ).run({
    id,
    claimId: input.claimId,
    camera: input.camera,
    timestampMs: input.timestampMs,
    observation: input.observation,
    region: input.region,
    damageStatus: input.damageStatus,
    bbox: input.bbox ? JSON.stringify(input.bbox) : null,
    evidenceFrameIds: JSON.stringify(input.evidenceFrameIds),
    createdAt,
  });
  return {
    id,
    createdAt,
    claimId: input.claimId,
    camera: input.camera,
    timestampMs: input.timestampMs,
    observation: input.observation,
    region: input.region,
    damageStatus: input.damageStatus,
    bbox: input.bbox,
    evidenceFrameIds: [...input.evidenceFrameIds],
  };
}

export function listFindingsByClaim(db: DB, claimId: string): Finding[] {
  const rows = db
    .prepare(
      "SELECT * FROM findings WHERE claim_id = ? ORDER BY timestamp_ms ASC, created_at ASC",
    )
    .all(claimId) as FindingRow[];
  return rows.map(mapRow);
}

export function getFindingById(db: DB, id: string): Finding | null {
  const row = db.prepare("SELECT * FROM findings WHERE id = ?").get(id) as
    FindingRow | undefined;
  return row ? mapRow(row) : null;
}
