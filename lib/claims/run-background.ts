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
export async function launchInvestigation(ctx: AppContext, claimId: string): Promise<void> {
  if (running.has(claimId)) return;
  running.add(claimId);
  try {
    await startInvestigation(ctx, claimId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Investigation failed.";
    try {
      await appendEvent(ctx.db, { claimId, type: "error", plainLanguage: "The investigation could not be completed." });
      const claim = await getClaimById(ctx.db, claimId);
      if (claim && claim.status !== "released") await holdForManualReview(ctx.db, claimId, message);
    } catch {
      // best-effort cleanup; nothing else we can safely do here
    }
  } finally {
    running.delete(claimId);
  }
}
