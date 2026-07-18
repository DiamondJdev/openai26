import type { Database } from "../connection";
import type { EvidenceCrop, EvidenceFrame } from "@/lib/domain/models";
import type { CameraId } from "@/lib/domain/cameras";
import type { DamageRegion } from "@/lib/domain/regions";
import { newId } from "@/lib/util/id";
import { nowIso } from "@/lib/util/time";

interface FrameRow { id: string; claim_id: string; camera: string; timestamp_ms: number; stored_path: string; created_at: string; }
interface CropRow { id: string; claim_id: string; frame_id: string; camera: string; region: string; stored_path: string; created_at: string; }

function mapFrame(row: FrameRow): EvidenceFrame { return { id: row.id, claimId: row.claim_id, camera: row.camera as CameraId, timestampMs: row.timestamp_ms, storedPath: row.stored_path, createdAt: row.created_at }; }
function mapCrop(row: CropRow): EvidenceCrop { return { id: row.id, claimId: row.claim_id, frameId: row.frame_id, camera: row.camera as CameraId, region: row.region as DamageRegion, storedPath: row.stored_path, createdAt: row.created_at }; }

export interface NewFrame { readonly claimId: string; readonly camera: CameraId; readonly timestampMs: number; readonly storedPath: string; }
export async function insertFrame(db: Database, input: NewFrame): Promise<EvidenceFrame> {
  const rows = await db.query<FrameRow>(
    `INSERT INTO evidence_frames (id, claim_id, camera, timestamp_ms, stored_path, created_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [newId("frame"), input.claimId, input.camera, input.timestampMs, input.storedPath, nowIso()],
  );
  if (!rows[0]) throw new Error("Evidence frame was not created");
  return mapFrame(rows[0]);
}
export async function getFrameById(db: Database, id: string): Promise<EvidenceFrame | null> {
  const rows = await db.query<FrameRow>("SELECT * FROM evidence_frames WHERE id = $1", [id]);
  return rows[0] ? mapFrame(rows[0]) : null;
}
export async function listFramesByClaim(db: Database, claimId: string): Promise<EvidenceFrame[]> {
  return (await db.query<FrameRow>("SELECT * FROM evidence_frames WHERE claim_id = $1 ORDER BY timestamp_ms ASC", [claimId])).map(mapFrame);
}

export interface NewCrop { readonly claimId: string; readonly frameId: string; readonly camera: CameraId; readonly region: DamageRegion; readonly storedPath: string; }
export async function insertCrop(db: Database, input: NewCrop): Promise<EvidenceCrop> {
  const rows = await db.query<CropRow>(
    `INSERT INTO evidence_crops (id, claim_id, frame_id, camera, region, stored_path, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [newId("crop"), input.claimId, input.frameId, input.camera, input.region, input.storedPath, nowIso()],
  );
  if (!rows[0]) throw new Error("Evidence crop was not created");
  return mapCrop(rows[0]);
}
export async function listCropsByClaim(db: Database, claimId: string): Promise<EvidenceCrop[]> {
  return (await db.query<CropRow>("SELECT * FROM evidence_crops WHERE claim_id = $1 ORDER BY created_at ASC", [claimId])).map(mapCrop);
}
export async function getCropById(db: Database, id: string): Promise<EvidenceCrop | null> {
  const rows = await db.query<CropRow>("SELECT * FROM evidence_crops WHERE id = $1", [id]);
  return rows[0] ? mapCrop(rows[0]) : null;
}
