/**
 * The model boundary. The investigation loop owns the running conversation and
 * asks a driver for the next model turn. This keeps the loop testable (a scripted
 * driver in tests) and swaps cleanly to the real OpenAI Responses driver.
 */

/** One item in the Responses API `input` array. */
export type ResponsesInputItem =
  | { readonly role: "developer" | "user" | "assistant"; readonly content: string }
  | {
      readonly type: "function_call";
      readonly call_id: string;
      readonly name: string;
      readonly arguments: string;
    }
  | {
      readonly type: "function_call_output";
      readonly call_id: string;
      readonly output: string;
    };

export interface ToolCallRequest {
  readonly callId: string;
  readonly name: string;
  /** Raw JSON string of the tool arguments, exactly as the model emitted them. */
  readonly argumentsJson: string;
}

export interface ModelResponse {
  readonly text: string;
  readonly toolCalls: readonly ToolCallRequest[];
}

export interface ModelDriver {
  respond(input: readonly ResponsesInputItem[]): Promise<ModelResponse>;
}
