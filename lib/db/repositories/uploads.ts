import type { Database } from "../connection";
import type { Upload, UploadKind } from "@/lib/domain/models";
import { newId } from "@/lib/util/id";
import { nowIso } from "@/lib/util/time";

interface UploadRow { id: string; claim_id: string; kind: string; stored_path: string; mime: string; width: number; height: number; bytes: number; sha256: string; created_at: string; }
function mapRow(row: UploadRow): Upload { return { id: row.id, claimId: row.claim_id, kind: row.kind as UploadKind, storedPath: row.stored_path, mime: row.mime, width: row.width, height: row.height, bytes: row.bytes, sha256: row.sha256, createdAt: row.created_at }; }
export interface NewUpload { readonly claimId: string; readonly kind: UploadKind; readonly storedPath: string; readonly mime: string; readonly width: number; readonly height: number; readonly bytes: number; readonly sha256: string; }
export async function insertUpload(db: Database, input: NewUpload): Promise<Upload> {
  const rows = await db.query<UploadRow>(
    `INSERT INTO uploads (id, claim_id, kind, stored_path, mime, width, height, bytes, sha256, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [newId("upload"), input.claimId, input.kind, input.storedPath, input.mime, input.width, input.height, input.bytes, input.sha256, nowIso()],
  );
  if (!rows[0]) throw new Error("Upload was not created");
  return mapRow(rows[0]);
}
export async function listUploadsByClaim(db: Database, claimId: string): Promise<Upload[]> { return (await db.query<UploadRow>("SELECT * FROM uploads WHERE claim_id = $1 ORDER BY created_at ASC", [claimId])).map(mapRow); }
export async function getUploadById(db: Database, id: string): Promise<Upload | null> { const rows = await db.query<UploadRow>("SELECT * FROM uploads WHERE id = $1", [id]); return rows[0] ? mapRow(rows[0]) : null; }
