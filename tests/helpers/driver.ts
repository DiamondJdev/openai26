import type {
  ModelDriver,
  ModelResponse,
  ResponsesInputItem,
  ToolCallRequest,
} from "@/lib/agent/driver";

let counter = 0;

/** Build a single tool-call request with a unique call id. */
export function tc(name: string, args: unknown): ToolCallRequest {
  counter += 1;
  return {
    callId: `call_${counter}`,
    name,
    argumentsJson: JSON.stringify(args),
  };
}

/** Extract, in order, every frameId the loop has fed back via tool outputs. */
export function collectFrameIds(input: readonly ResponsesInputItem[]): string[] {
  const ids: string[] = [];
  for (const item of input) {
    if ("type" in item && item.type === "function_call_output") {
      try {
        const parsed = JSON.parse(item.output) as { frameId?: string };
        if (parsed.frameId) ids.push(parsed.frameId);
      } catch {
        // ignore non-JSON outputs
      }
    }
  }
  return ids;
}

/**
 * Turn a per-turn planning function into a ModelDriver. The plan receives the
 * frameIds discovered so far (so it can chain analyze/compare/save calls) and
 * the current turn index; return [] to signal the model is done.
 */
export function scriptedDriver(
  plan: (ids: string[], turn: number) => ToolCallRequest[],
): ModelDriver {
  let turn = 0;
  return {
    async respond(input): Promise<ModelResponse> {
      const ids = collectFrameIds(input);
      const toolCalls = plan(ids, turn);
      turn += 1;
      return { text: "", toolCalls };
    },
  };
}
