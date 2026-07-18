import type { Database } from "../connection";
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
  return { id: row.id, claimId: row.claim_id, tokenHash: row.token_hash, pinHash: row.pin_hash, failedAttempts: row.failed_attempts, lockedUntil: row.locked_until, createdAt: row.created_at };
}

export interface NewCustomerAccess { readonly claimId: string; readonly tokenHash: string; readonly pinHash: string; }

export async function insertCustomerAccess(db: Database, input: NewCustomerAccess): Promise<CustomerAccess> {
  const rows = await db.query<AccessRow>(
    `INSERT INTO customer_access (id, claim_id, token_hash, pin_hash, failed_attempts, created_at)
     VALUES ($1, $2, $3, $4, 0, $5) RETURNING *`,
    [newId("access"), input.claimId, input.tokenHash, input.pinHash, nowIso()],
  );
  if (!rows[0]) throw new Error(`Customer access was not created for claim ${input.claimId}`);
  return mapRow(rows[0]);
}

export async function getAccessByClaimId(db: Database, claimId: string): Promise<CustomerAccess | null> {
  const rows = await db.query<AccessRow>("SELECT * FROM customer_access WHERE claim_id = $1", [claimId]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getAccessByClaimIdOrThrow(db: Database, claimId: string): Promise<CustomerAccess> {
  const access = await getAccessByClaimId(db, claimId);
  if (!access) throw new Error(`Customer access not found for claim ${claimId}`);
  return access;
}

/** O(1) lookup by the deterministic hash of a high-entropy link token. */
export async function getAccessByTokenHash(db: Database, tokenHash: string): Promise<CustomerAccess | null> {
  const rows = await db.query<AccessRow>("SELECT * FROM customer_access WHERE token_hash = $1", [tokenHash]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function updateAccessThrottle(
  db: Database, id: string, failedAttempts: number, lockedUntil: string | null,
): Promise<void> {
  await db.query(
    "UPDATE customer_access SET failed_attempts = $1, locked_until = $2 WHERE id = $3",
    [failedAttempts, lockedUntil, id],
  );
}
