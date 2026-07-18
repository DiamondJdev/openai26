import type { DB } from "../connection";
import type { CustomerSubmission } from "@/lib/domain/models";
import { newId } from "@/lib/util/id";
import { nowIso } from "@/lib/util/time";

interface SubmissionRow {
  id: string;
  claim_id: string;
  name: string;
  email: string;
  phone: string;
  consent_at: string;
  submitted_at: string;
}

function mapRow(row: SubmissionRow): CustomerSubmission {
  return {
    id: row.id,
    claimId: row.claim_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    consentAt: row.consent_at,
    submittedAt: row.submitted_at,
  };
}

export interface NewSubmission {
  readonly claimId: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly consentAt: string;
}

export function insertSubmission(
  db: DB,
  input: NewSubmission,
): CustomerSubmission {
  const id = newId("sub");
  const submittedAt = nowIso();
  db.prepare(
    `INSERT INTO customer_submissions (id, claim_id, name, email, phone, consent_at, submitted_at)
     VALUES (@id, @claimId, @name, @email, @phone, @consentAt, @submittedAt)`,
  ).run({ id, ...input, submittedAt });
  return getSubmissionByClaimIdOrThrow(db, input.claimId);
}

export function getSubmissionByClaimId(
  db: DB,
  claimId: string,
): CustomerSubmission | null {
  const row = db
    .prepare("SELECT * FROM customer_submissions WHERE claim_id = ?")
    .get(claimId) as SubmissionRow | undefined;
  return row ? mapRow(row) : null;
}

function getSubmissionByClaimIdOrThrow(
  db: DB,
  claimId: string,
): CustomerSubmission {
  const sub = getSubmissionByClaimId(db, claimId);
  if (!sub) throw new Error(`Submission not found for claim ${claimId}`);
  return sub;
}
