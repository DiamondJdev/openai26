import type { DB } from "../connection";
import type { Upload, UploadKind } from "@/lib/domain/models";
import { newId } from "@/lib/util/id";
import { nowIso } from "@/lib/util/time";

interface UploadRow {
  id: string;
  claim_id: string;
  kind: string;
  stored_path: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
  created_at: string;
}

function mapRow(row: UploadRow): Upload {
  return {
    id: row.id,
    claimId: row.claim_id,
    kind: row.kind as UploadKind,
    storedPath: row.stored_path,
    mime: row.mime,
    width: row.width,
    height: row.height,
    bytes: row.bytes,
    sha256: row.sha256,
    createdAt: row.created_at,
  };
}

export interface NewUpload {
  readonly claimId: string;
  readonly kind: UploadKind;
  readonly storedPath: string;
  readonly mime: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly sha256: string;
}

export function insertUpload(db: DB, input: NewUpload): Upload {
  const upload: Upload = { id: newId("upload"), createdAt: nowIso(), ...input };
  db.prepare(
    `INSERT INTO uploads (id, claim_id, kind, stored_path, mime, width, height, bytes, sha256, created_at)
     VALUES (@id, @claimId, @kind, @storedPath, @mime, @width, @height, @bytes, @sha256, @createdAt)`,
  ).run(upload);
  return upload;
}

export function listUploadsByClaim(db: DB, claimId: string): Upload[] {
  const rows = db
    .prepare("SELECT * FROM uploads WHERE claim_id = ? ORDER BY created_at ASC")
    .all(claimId) as UploadRow[];
  return rows.map(mapRow);
}

export function getUploadById(db: DB, id: string): Upload | null {
  const row = db.prepare("SELECT * FROM uploads WHERE id = ?").get(id) as
    | UploadRow
    | undefined;
  return row ? mapRow(row) : null;
}
