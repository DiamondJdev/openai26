import type { Database } from "../connection";
import type { DamageStatus, Finding } from "@/lib/domain/report";
import type { CameraId } from "@/lib/domain/cameras";
import type { DamageRegion } from "@/lib/domain/regions";
import type { NormalizedBBox } from "@/lib/domain/geometry";
import { newId } from "@/lib/util/id";
import { nowIso } from "@/lib/util/time";

interface FindingRow { id: string; claim_id: string; camera: string; timestamp_ms: number; observation: string; region: string | null; damage_status: string; bbox: string | null; evidence_frame_ids: string; created_at: string; }
function mapRow(row: FindingRow): Finding { return { id: row.id, claimId: row.claim_id, camera: row.camera as CameraId, timestampMs: row.timestamp_ms, observation: row.observation, region: row.region as DamageRegion | null, damageStatus: row.damage_status as DamageStatus, bbox: row.bbox ? JSON.parse(row.bbox) as NormalizedBBox : null, evidenceFrameIds: JSON.parse(row.evidence_frame_ids) as string[], createdAt: row.created_at }; }
export interface NewFinding { readonly claimId: string; readonly camera: CameraId; readonly timestampMs: number; readonly observation: string; readonly region: DamageRegion | null; readonly damageStatus: DamageStatus; readonly bbox: NormalizedBBox | null; readonly evidenceFrameIds: readonly string[]; }
export async function insertFinding(db: Database, input: NewFinding): Promise<Finding> {
  const rows = await db.query<FindingRow>(
    `INSERT INTO findings (id, claim_id, camera, timestamp_ms, observation, region, damage_status, bbox, evidence_frame_ids, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [newId("finding"), input.claimId, input.camera, input.timestampMs, input.observation, input.region, input.damageStatus, input.bbox ? JSON.stringify(input.bbox) : null, JSON.stringify(input.evidenceFrameIds), nowIso()],
  );
  if (!rows[0]) throw new Error("Finding was not created");
  return mapRow(rows[0]);
}
export async function listFindingsByClaim(db: Database, claimId: string): Promise<Finding[]> { return (await db.query<FindingRow>("SELECT * FROM findings WHERE claim_id = $1 ORDER BY timestamp_ms ASC, created_at ASC", [claimId])).map(mapRow); }
export async function getFindingById(db: Database, id: string): Promise<Finding | null> { const rows = await db.query<FindingRow>("SELECT * FROM findings WHERE id = $1", [id]); return rows[0] ? mapRow(rows[0]) : null; }
