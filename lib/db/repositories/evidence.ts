import type { DB } from "../connection";
import type { EvidenceCrop, EvidenceFrame } from "@/lib/domain/models";
import type { CameraId } from "@/lib/domain/cameras";
import type { DamageRegion } from "@/lib/domain/regions";
import { newId } from "@/lib/util/id";
import { nowIso } from "@/lib/util/time";

interface FrameRow {
  id: string;
  claim_id: string;
  camera: string;
  timestamp_ms: number;
  stored_path: string;
  created_at: string;
}

interface CropRow {
  id: string;
  claim_id: string;
  frame_id: string;
  camera: string;
  region: string;
  stored_path: string;
  created_at: string;
}

function mapFrame(row: FrameRow): EvidenceFrame {
  return {
    id: row.id,
    claimId: row.claim_id,
    camera: row.camera as CameraId,
    timestampMs: row.timestamp_ms,
    storedPath: row.stored_path,
    createdAt: row.created_at,
  };
}

function mapCrop(row: CropRow): EvidenceCrop {
  return {
    id: row.id,
    claimId: row.claim_id,
    frameId: row.frame_id,
    camera: row.camera as CameraId,
    region: row.region as DamageRegion,
    storedPath: row.stored_path,
    createdAt: row.created_at,
  };
}

export interface NewFrame {
  readonly claimId: string;
  readonly camera: CameraId;
  readonly timestampMs: number;
  readonly storedPath: string;
}

export function insertFrame(db: DB, input: NewFrame): EvidenceFrame {
  const frame: EvidenceFrame = {
    id: newId("frame"),
    createdAt: nowIso(),
    ...input,
  };
  db.prepare(
    `INSERT INTO evidence_frames (id, claim_id, camera, timestamp_ms, stored_path, created_at)
     VALUES (@id, @claimId, @camera, @timestampMs, @storedPath, @createdAt)`,
  ).run(frame);
  return frame;
}

export function getFrameById(db: DB, id: string): EvidenceFrame | null {
  const row = db.prepare("SELECT * FROM evidence_frames WHERE id = ?").get(id) as
    | FrameRow
    | undefined;
  return row ? mapFrame(row) : null;
}

export function listFramesByClaim(db: DB, claimId: string): EvidenceFrame[] {
  const rows = db
    .prepare(
      "SELECT * FROM evidence_frames WHERE claim_id = ? ORDER BY timestamp_ms ASC",
    )
    .all(claimId) as FrameRow[];
  return rows.map(mapFrame);
}

export interface NewCrop {
  readonly claimId: string;
  readonly frameId: string;
  readonly camera: CameraId;
  readonly region: DamageRegion;
  readonly storedPath: string;
}

export function insertCrop(db: DB, input: NewCrop): EvidenceCrop {
  const crop: EvidenceCrop = { id: newId("crop"), createdAt: nowIso(), ...input };
  db.prepare(
    `INSERT INTO evidence_crops (id, claim_id, frame_id, camera, region, stored_path, created_at)
     VALUES (@id, @claimId, @frameId, @camera, @region, @storedPath, @createdAt)`,
  ).run(crop);
  return crop;
}

export function listCropsByClaim(db: DB, claimId: string): EvidenceCrop[] {
  const rows = db
    .prepare("SELECT * FROM evidence_crops WHERE claim_id = ? ORDER BY created_at ASC")
    .all(claimId) as CropRow[];
  return rows.map(mapCrop);
}

export function getCropById(db: DB, id: string): EvidenceCrop | null {
  const row = db.prepare("SELECT * FROM evidence_crops WHERE id = ?").get(id) as
    | CropRow
    | undefined;
  return row ? mapCrop(row) : null;
}
