import type { DB } from "@/lib/db/connection";
import type { Claim } from "@/lib/domain/models";
import type { ReleaseOptions } from "@/lib/domain/report";
import { assertTransition } from "@/lib/domain/claim-state-machine";
import {
  getClaimByIdOrThrow,
  holdForManualReview,
  releaseClaim,
} from "@/lib/db/repositories/claims";
import { generateReleaseCrops } from "@/lib/evidence/release-crops";

/**
 * Normalize release options from an untrusted request body. The
 * `Share evidence photos` switch defaults OFF; only an explicit `true` enables
 * crop sharing.
 */
export function resolveReleaseOptions(input: unknown): ReleaseOptions {
  const share =
    typeof input === "object" &&
    input !== null &&
    (input as { shareEvidenceCrops?: unknown }).shareEvidenceCrops === true;
  return { shareEvidenceCrops: share };
}

/**
 * Release the report to the customer UNCHANGED. The conclusion is never edited;
 * this only transitions the claim to `released` and, if opted in, produces the
 * focused entrance/exit crops. Requires the claim to be in `review_ready`.
 */
export async function releaseReport(
  db: DB,
  claimId: string,
  options: ReleaseOptions,
  cropsDir: string,
): Promise<Claim> {
  const claim = getClaimByIdOrThrow(db, claimId);
  assertTransition(claim.status, "released");
  if (options.shareEvidenceCrops) {
    await generateReleaseCrops(db, claim, cropsDir);
  }
  return releaseClaim(db, claimId, options.shareEvidenceCrops);
}

/** Hold a review-ready (or in-flight) claim for manual review. */
export function holdClaim(db: DB, claimId: string, reason: string): Claim {
  const claim = getClaimByIdOrThrow(db, claimId);
  assertTransition(claim.status, "manual_review_required");
  return holdForManualReview(db, claimId, reason);
}
