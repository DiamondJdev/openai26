import type { ClaimStatus } from "./claim-status";
import { InvalidTransitionError } from "./errors";

/**
 * The claim lifecycle as an explicit adjacency map. `released` and
 * `manual_review_required` are terminal. There are no self-transitions.
 */
const TRANSITIONS: Readonly<Record<ClaimStatus, readonly ClaimStatus[]>> = {
  draft: ["customer_submitted"],
  customer_submitted: ["investigating"],
  investigating: ["review_ready", "manual_review_required"],
  review_ready: ["released", "manual_review_required"],
  released: [],
  manual_review_required: [],
};

export function nextStatuses(from: ClaimStatus): readonly ClaimStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: ClaimStatus, to: ClaimStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ClaimStatus, to: ClaimStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}
