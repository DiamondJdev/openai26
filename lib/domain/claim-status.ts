/**
 * Claim lifecycle states. The full path is:
 *   draft → customer_submitted → investigating → review_ready
 *     → released | manual_review_required
 * `manual_review_required` is also reachable directly from `investigating`
 * whenever evidence is missing, obscured, contradictory, or the run times out.
 */
export const CLAIM_STATUSES = [
  "draft",
  "customer_submitted",
  "investigating",
  "review_ready",
  "released",
  "manual_review_required",
] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export function isClaimStatus(value: unknown): value is ClaimStatus {
  return (
    typeof value === "string" &&
    (CLAIM_STATUSES as readonly string[]).includes(value)
  );
}

/** States in which the customer sees only "under review" (never internals). */
export const CUSTOMER_PENDING_STATUSES: readonly ClaimStatus[] = [
  "draft",
  "customer_submitted",
  "investigating",
  "review_ready",
  "manual_review_required",
];

/** The only state in which an approved conclusion is visible to the customer. */
export const CUSTOMER_RELEASED_STATUS: ClaimStatus = "released";
