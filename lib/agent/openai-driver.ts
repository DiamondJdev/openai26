import OpenAI from "openai";
import type {
  ModelDriver,
  ModelResponse,
  ResponsesInputItem,
  ToolCallRequest,
} from "./driver";
import { TOOL_DEFINITIONS } from "./tools/definitions";

export interface OpenAIDriverOptions {
  readonly apiKey: string;
  readonly model: string;
  /** Per-request timeout; the loop also enforces the overall wall-clock cap. */
  readonly requestTimeoutMs?: number;
  /** Injectable client for tests; defaults to a real OpenAI client. */
  readonly client?: OpenAI;
}

interface FunctionCallItem {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
}

function isFunctionCall(item: unknown): item is FunctionCallItem {
  return (
    typeof item === "object" &&
    item !== null &&
    (item as { type?: unknown }).type === "function_call"
  );
}

/**
 * Real ModelDriver backed by the OpenAI Responses API with function tools. The
 * full input is resent each turn (stateless) — investigations are short and this
 * avoids depending on server-side response threading. Fails fast without a key.
 */
export function createOpenAIDriver(opts: OpenAIDriverOptions): ModelDriver {
  if (!opts.apiKey) {
    throw new Error("OPENAI_API_KEY is required to run an investigation.");
  }
  const client = opts.client ?? new OpenAI({ apiKey: opts.apiKey });
  const timeout = opts.requestTimeoutMs ?? 40_000;

  return {
    async respond(
      input: readonly ResponsesInputItem[],
    ): Promise<ModelResponse> {
      const response = await client.responses.create(
        {
          model: opts.model,
          input: input as unknown as OpenAI.Responses.ResponseInput,
          tools: TOOL_DEFINITIONS as unknown as OpenAI.Responses.Tool[],
          tool_choice: "auto",
          parallel_tool_calls: false,
          store: false,
        },
        { timeout, maxRetries: 0 },
      );

      const toolCalls: ToolCallRequest[] = [];
      for (const item of response.output ?? []) {
        if (isFunctionCall(item)) {
          toolCalls.push({
            callId: item.call_id,
            name: item.name,
            argumentsJson: item.arguments,
          });
        }
      }
      return { text: response.output_text ?? "", toolCalls };
    },
  };
}
