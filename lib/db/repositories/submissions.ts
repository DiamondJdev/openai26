import type { Database } from "../connection";
import type { CustomerSubmission } from "@/lib/domain/models";
import { newId } from "@/lib/util/id";
import { nowIso } from "@/lib/util/time";

interface SubmissionRow { id: string; claim_id: string; name: string; email: string; phone: string; consent_at: string; submitted_at: string; }
function mapRow(row: SubmissionRow): CustomerSubmission { return { id: row.id, claimId: row.claim_id, name: row.name, email: row.email, phone: row.phone, consentAt: row.consent_at, submittedAt: row.submitted_at }; }
export interface NewSubmission { readonly claimId: string; readonly name: string; readonly email: string; readonly phone: string; readonly consentAt: string; }
export async function insertSubmission(db: Database, input: NewSubmission): Promise<CustomerSubmission> {
  const rows = await db.query<SubmissionRow>(
    `INSERT INTO customer_submissions (id, claim_id, name, email, phone, consent_at, submitted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [newId("sub"), input.claimId, input.name, input.email, input.phone, input.consentAt, nowIso()],
  );
  if (!rows[0]) throw new Error(`Submission was not created for claim ${input.claimId}`);
  return mapRow(rows[0]);
}
export async function getSubmissionByClaimId(db: Database, claimId: string): Promise<CustomerSubmission | null> { const rows = await db.query<SubmissionRow>("SELECT * FROM customer_submissions WHERE claim_id = $1", [claimId]); return rows[0] ? mapRow(rows[0]) : null; }
