import "server-only";
import type { AppContext } from "@/lib/runtime/context";
import type { InvestigationEvent } from "@/lib/domain/models";
import type { ModelDriver } from "@/lib/agent/driver";
import type { ToolContext, VisionPort } from "@/lib/agent/tools/context";
import { getClaimByIdOrThrow, updateClaimStatus } from "@/lib/db/repositories/claims";
import { getVisitById } from "@/lib/db/repositories/visits";
import { assertTransition } from "@/lib/domain/claim-state-machine";
import { NotFoundError } from "@/lib/domain/errors";
import { runInvestigation, type InvestigationResult } from "@/lib/agent/loop";
import { createOpenAIDriver } from "@/lib/agent/openai-driver";
import { createOpenAIVision } from "@/lib/agent/openai-vision";

export interface StartInvestigationOptions {
  /** Injected for tests; production builds the OpenAI driver/vision from env. */
  readonly driver?: ModelDriver;
  readonly vision?: VisionPort;
  readonly onEvent?: (event: InvestigationEvent) => void;
  readonly now?: () => number;
}

/**
 * Transition a customer-submitted claim to `investigating`, build a claim-scoped
 * tool context, and run the agentic loop. Production wiring uses the OpenAI
 * Responses driver + vision; both are injectable for deterministic tests.
 */
export async function startInvestigation(
  ctx: AppContext,
  claimId: string,
  opts: StartInvestigationOptions = {},
): Promise<InvestigationResult> {
  const claim = await getClaimByIdOrThrow(ctx.db, claimId);
  const visit = await getVisitById(ctx.db, claim.visitId);
  if (!visit) throw new NotFoundError("Visit footage is not available.");

  assertTransition(claim.status, "investigating");
  const investigating = await updateClaimStatus(ctx.db, claimId, "investigating");

  const driver =
    opts.driver ??
    createOpenAIDriver({ apiKey: ctx.env.openAiApiKey, model: ctx.env.model });
  const vision =
    opts.vision ??
    createOpenAIVision({ apiKey: ctx.env.openAiApiKey, model: ctx.env.model });

  const toolContext: ToolContext = {
    db: ctx.db,
    artifacts: ctx.artifacts,
    claim: investigating,
    visit,
    footageRoot: ctx.footageRoot,
    vision,
    localizations: new Map(),
    onEvent: opts.onEvent,
  };

  return runInvestigation({
    ctx: toolContext,
    driver,
    limits: {
      maxInvestigationMs: ctx.env.maxInvestigationMs,
    },
    now: opts.now,
  });
}
