import type { Database } from "@/lib/db/connection";
import type { ArtifactStore } from "@/lib/storage/artifacts";
import type { Claim } from "@/lib/domain/models";
import type { ReleaseOptions } from "@/lib/domain/report";
import { assertTransition } from "@/lib/domain/claim-state-machine";
import { InvalidTransitionError, ValidationError } from "@/lib/domain/errors";
import {
  attachReport,
  getClaimByIdOrThrow,
  holdForManualReview,
  releaseClaim,
} from "@/lib/db/repositories/claims";
import { insertReport } from "@/lib/db/repositories/reports";
import { generateReleaseCrops } from "@/lib/evidence/release-crops";

export type HumanReviewOutcome =
  | "no_new_damage_detected"
  | "new_damage_detected";

/** Accept only the two final decisions an employee may send to a customer. */
export function resolveHumanReviewOutcome(input: unknown): HumanReviewOutcome {
  const outcome =
    typeof input === "object" && input !== null
      ? (input as { outcome?: unknown }).outcome
      : undefined;
  if (outcome === "no_new_damage_detected" || outcome === "new_damage_detected") {
    return outcome;
  }
  throw new ValidationError("Choose whether new damage was found.");
}

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
  db: Database,
  claimId: string,
  options: ReleaseOptions,
  artifacts: ArtifactStore,
): Promise<Claim> {
  const claim = await getClaimByIdOrThrow(db, claimId);
  if (claim.status !== "review_ready") {
    throw new InvalidTransitionError(claim.status, "released");
  }
  assertTransition(claim.status, "released");
  if (options.shareEvidenceCrops) {
    await generateReleaseCrops(db, artifacts, claim);
  }
  return await releaseClaim(db, claimId, options.shareEvidenceCrops);
}

function humanReviewCopy(outcome: HumanReviewOutcome): {
  summary: string;
  conclusion: string;
} {
  if (outcome === "new_damage_detected") {
    return {
      summary:
        "A human employee manually reviewed your case and determined new damage was found.",
      conclusion: "New damage found.",
    };
  }
  return {
    summary:
      "A human employee manually reviewed your case and determined no new damage was found.",
    conclusion: "No new damage found.",
  };
}

/**
 * Record an employee's final outcome for a manual-review claim and release it
 * to the customer. Human determinations intentionally contain no AI findings
 * or evidence crops, and never expose the internal manual-review reason.
 */
export async function completeManualReview(
  db: Database,
  claimId: string,
  outcome: HumanReviewOutcome,
): Promise<Claim> {
  const claim = await getClaimByIdOrThrow(db, claimId);
  assertTransition(claim.status, "released");

  const copy = humanReviewCopy(outcome);
  const report = await insertReport(db, {
    claimId,
    outcome,
    ...copy,
    timeline: [],
    findingIds: [],
    confidence: {
      level: "low",
      agreeingChecks: 0,
      totalChecks: 0,
      rationale: "Final determination by a human employee.",
    },
  });
  await attachReport(db, claimId, report.id, "released");
  return await releaseClaim(db, claimId, false);
}

/** Hold a review-ready (or in-flight) claim for manual review. */
export async function holdClaim(db: Database, claimId: string, reason: string): Promise<Claim> {
  const claim = await getClaimByIdOrThrow(db, claimId);
  assertTransition(claim.status, "manual_review_required");
  return await holdForManualReview(db, claimId, reason);
}
