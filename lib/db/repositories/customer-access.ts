import type { DB } from "../connection";
import type { CustomerAccess } from "@/lib/domain/models";
import { newId } from "@/lib/util/id";
import { nowIso } from "@/lib/util/time";

interface AccessRow {
  id: string;
  claim_id: string;
  token_hash: string;
  pin_hash: string;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
}

function mapRow(row: AccessRow): CustomerAccess {
  return {
    id: row.id,
    claimId: row.claim_id,
    tokenHash: row.token_hash,
    pinHash: row.pin_hash,
    failedAttempts: row.failed_attempts,
    lockedUntil: row.locked_until,
    createdAt: row.created_at,
  };
}

export interface NewCustomerAccess {
  readonly claimId: string;
  readonly tokenHash: string;
  readonly pinHash: string;
}

export function insertCustomerAccess(
  db: DB,
  input: NewCustomerAccess,
): CustomerAccess {
  const id = newId("access");
  db.prepare(
    `INSERT INTO customer_access (id, claim_id, token_hash, pin_hash, failed_attempts, created_at)
     VALUES (@id, @claimId, @tokenHash, @pinHash, 0, @ts)`,
  ).run({ id, ...input, ts: nowIso() });
  return getAccessByClaimIdOrThrow(db, input.claimId);
}

export function getAccessByClaimId(
  db: DB,
  claimId: string,
): CustomerAccess | null {
  const row = db
    .prepare("SELECT * FROM customer_access WHERE claim_id = ?")
    .get(claimId) as AccessRow | undefined;
  return row ? mapRow(row) : null;
}

export function getAccessByClaimIdOrThrow(
  db: DB,
  claimId: string,
): CustomerAccess {
  const access = getAccessByClaimId(db, claimId);
  if (!access) throw new Error(`Customer access not found for claim ${claimId}`);
  return access;
}

/** O(1) lookup by the deterministic hash of a high-entropy link token. */
export function getAccessByTokenHash(
  db: DB,
  tokenHash: string,
): CustomerAccess | null {
  const row = db
    .prepare("SELECT * FROM customer_access WHERE token_hash = ?")
    .get(tokenHash) as AccessRow | undefined;
  return row ? mapRow(row) : null;
}

export function updateAccessThrottle(
  db: DB,
  id: string,
  failedAttempts: number,
  lockedUntil: string | null,
): void {
  db.prepare(
    "UPDATE customer_access SET failed_attempts = @failedAttempts, locked_until = @lockedUntil WHERE id = @id",
  ).run({ id, failedAttempts, lockedUntil });
}
