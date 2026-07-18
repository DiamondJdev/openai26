import type { ModelDriver, ResponsesInputItem } from "./driver";
import type { ToolContext } from "./tools/context";
import { executeTool } from "./tools/execute";
import { buildInitialInput } from "./prompt";
import { appendEvent } from "@/lib/db/repositories/events";
import { holdForManualReview } from "@/lib/db/repositories/claims";
import { ToolSecurityError, UncitedFindingError } from "@/lib/domain/errors";

const MAX_INVALID_TOOL_CALLS = 3;

/** Sentinel so a deadline timeout is distinguishable from a driver error. */
class DeadlineError extends Error {}

/**
 * Reject if `promise` does not settle within `ms`. Enforces the wall-clock cap
 * at the network layer so a hung model/vision call cannot outlast the budget.
 */
function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) {
    return Promise.reject(new DeadlineError("deadline exceeded"));
  }
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new DeadlineError("deadline exceeded")),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export interface InvestigationLimits {
  readonly maxToolCalls: number;
  readonly maxInvestigationMs: number;
}

export interface InvestigationResult {
  readonly status: "review_ready" | "manual_review_required";
  readonly reportId: string | null;
  readonly reason: string | null;
  readonly toolCallCount: number;
}

export interface RunInvestigationOptions {
  readonly ctx: ToolContext;
  readonly driver: ModelDriver;
  readonly limits: InvestigationLimits;
  /** Injectable clock (ms) for deterministic timeout tests. */
  readonly now?: () => number;
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Drive the agentic tool-calling loop. Hard-capped at maxToolCalls validated
 * calls and maxInvestigationMs wall-clock; too many invalid calls, a timeout, a
 * model that quits without a report, or a citation failure all route the claim
 * to manual review rather than emitting an unsupported conclusion.
 */
export async function runInvestigation(
  opts: RunInvestigationOptions,
): Promise<InvestigationResult> {
  const { ctx, driver, limits } = opts;
  const now = opts.now ?? (() => Date.now());
  const startedAt = now();

  const started = appendEvent(ctx.db, {
    claimId: ctx.claim.id,
    type: "started",
    plainLanguage: "Investigation started.",
  });
  ctx.onEvent?.(started);

  const input: ResponsesInputItem[] = buildInitialInput(ctx.claim, ctx.visit);
  let toolCallCount = 0;
  let invalidCalls = 0;

  const finishManual = (reason: string): InvestigationResult => {
    holdForManualReview(ctx.db, ctx.claim.id, reason);
    const event = appendEvent(ctx.db, {
      claimId: ctx.claim.id,
      type: "manual_review",
      plainLanguage: `Routed to manual review: ${reason}`,
    });
    ctx.onEvent?.(event);
    return {
      status: "manual_review_required",
      reportId: null,
      reason,
      toolCallCount,
    };
  };

  // Bound the number of model turns as a final backstop; each turn can only add
  // a limited number of tool calls before caps trip.
  const maxTurns = limits.maxToolCalls + MAX_INVALID_TOOL_CALLS + 2;
  for (let turn = 0; turn < maxTurns; turn++) {
    const elapsed = now() - startedAt;
    if (elapsed > limits.maxInvestigationMs) {
      return finishManual("Investigation timed out.");
    }

    let response;
    try {
      response = await withDeadline(
        driver.respond(input),
        limits.maxInvestigationMs - elapsed,
      );
    } catch (error) {
      if (error instanceof DeadlineError) {
        return finishManual("Investigation timed out.");
      }
      throw error;
    }
    if (response.toolCalls.length === 0) {
      return finishManual("Investigation ended without a report.");
    }

    for (const call of response.toolCalls) {
      input.push({
        type: "function_call",
        call_id: call.callId,
        name: call.name,
        arguments: call.argumentsJson,
      });

      if (toolCallCount >= limits.maxToolCalls) {
        return finishManual("Investigation exceeded the tool-call limit.");
      }

      const args = safeParseJson(call.argumentsJson);
      try {
        const result = await executeTool(ctx, call.name, args);
        toolCallCount += 1;
        input.push({
          type: "function_call_output",
          call_id: call.callId,
          output: JSON.stringify(result.output),
        });
        if (result.terminal === "review_ready") {
          return {
            status: "review_ready",
            reportId: result.reportId ?? null,
            reason: null,
            toolCallCount,
          };
        }
        if (result.terminal === "manual_review_required") {
          holdForManualReview(
            ctx.db,
            ctx.claim.id,
            result.manualReviewReason ?? "Manual review required.",
          );
          return {
            status: "manual_review_required",
            reportId: null,
            reason: result.manualReviewReason ?? "Manual review required.",
            toolCallCount,
          };
        }
      } catch (error) {
        if (error instanceof ToolSecurityError) {
          invalidCalls += 1;
          input.push({
            type: "function_call_output",
            call_id: call.callId,
            output: JSON.stringify({ error: "invalid_tool_call" }),
          });
          if (invalidCalls >= MAX_INVALID_TOOL_CALLS) {
            return finishManual("Too many invalid tool calls.");
          }
          continue;
        }
        if (error instanceof UncitedFindingError) {
          return finishManual("Report failed evidence-citation checks.");
        }
        throw error;
      }
    }
  }

  return finishManual("Investigation did not converge.");
}
