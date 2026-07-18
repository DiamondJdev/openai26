import "server-only";
import type { AppContext } from "@/lib/runtime/context";
import { startInvestigation } from "./investigate";
import { appendEvent } from "@/lib/db/repositories/events";
import { getClaimById, holdForManualReview } from "@/lib/db/repositories/claims";

const running = new Set<string>();

export function isInvestigationRunning(claimId: string): boolean {
  return running.has(claimId);
}

/**
 * Launch an investigation in the background so the employee UI can stream the
 * live trace by polling events. Guards against double-starts and converts any
 * unexpected failure into a recorded error + manual-review hold.
 */
export function launchInvestigation(ctx: AppContext, claimId: string): void {
  if (running.has(claimId)) return;
  running.add(claimId);
  void startInvestigation(ctx, claimId)
    .catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Investigation failed.";
      try {
        appendEvent(ctx.db, {
          claimId,
          type: "error",
          plainLanguage: "The investigation could not be completed.",
        });
        const claim = getClaimById(ctx.db, claimId);
        if (claim && claim.status !== "released") {
          holdForManualReview(ctx.db, claimId, message);
        }
      } catch {
        // best-effort cleanup; nothing else we can safely do here
      }
    })
    .finally(() => {
      running.delete(claimId);
    });
}
