import type { ClaimStatus } from "./claim-status";

/** Base class for expected, user-safe domain errors. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidTransitionError extends DomainError {
  constructor(
    readonly from: ClaimStatus,
    readonly to: ClaimStatus,
  ) {
    super(`Illegal claim transition: ${from} → ${to}`);
  }
}

export class NotFoundError extends DomainError {}

export class ValidationError extends DomainError {}

/** Thrown when the model's tool call is out of scope or fails schema validation. */
export class ToolSecurityError extends DomainError {}

/** Thrown when a finding is not backed by a stored evidence frame at report time. */
export class UncitedFindingError extends DomainError {}

/**
 * Signals that the investigation cannot produce a releasable report — evidence
 * missing, obscured, contradictory, or timed out — so the claim must be held.
 */
export class ManualReviewRequiredError extends DomainError {
  constructor(readonly reason: string) {
    super(reason);
  }
}
