import { CAMERA_IDS } from "@/lib/domain/cameras";
import { DAMAGE_REGIONS } from "@/lib/domain/regions";
import { DAMAGE_STATUSES } from "@/lib/domain/report";

/**
 * Function-tool definitions passed to the OpenAI Responses API. The model may
 * only ever call these six tools. Camera/region/status are closed enums; there
 * is no parameter that accepts a path, URL, claim id, or camera id outside the
 * fixed rig. Every argument is re-validated server-side with Zod before use.
 */
export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    name: "get_clip_window",
    description:
      "Check that footage exists on one fixed camera around an incident time, and get the bounded clip window. Cameras are fixed: entrance, mid_tunnel, exit.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["camera", "timestampMs", "windowMs"],
      properties: {
        camera: { type: "string", enum: [...CAMERA_IDS] },
        timestampMs: { type: "integer", minimum: 0, maximum: 3_600_000 },
        windowMs: {
          type: "integer",
          minimum: 1,
          maximum: 120_000,
          description: "Half-window in milliseconds (±).",
        },
      },
    },
  },
  {
    type: "function" as const,
    name: "extract_frame",
    description:
      "Extract a single still frame from one fixed camera at a timestamp. Returns a frameId to analyze or compare.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["camera", "timestampMs"],
      properties: {
        camera: { type: "string", enum: [...CAMERA_IDS] },
        timestampMs: { type: "integer", minimum: 0, maximum: 3_600_000 },
      },
    },
  },
  {
    type: "function" as const,
    name: "analyze_frame",
    description:
      "Ask a specific vision question about one previously extracted frame (identified by frameId), e.g. does it match the vehicle, or is there visible damage.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["frameId", "question"],
      properties: {
        frameId: { type: "string" },
        question: { type: "string", maxLength: 400 },
      },
    },
  },
  {
    type: "function" as const,
    name: "compare_frames",
    description:
      "Compare two previously extracted frames (frameIdA before, frameIdB after) for new damage that was not present earlier.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["frameIdA", "frameIdB", "question"],
      properties: {
        frameIdA: { type: "string" },
        frameIdB: { type: "string" },
        question: { type: "string", maxLength: 400 },
      },
    },
  },
  {
    type: "function" as const,
    name: "save_finding",
    description:
      "Persist one structured finding tied to the evidence frames it came from. Every finding must cite at least one frameId returned by extract_frame. When cited footage is clear, save no_damage, pre_existing, or new_damage. Use inconclusive only when the cited footage is missing, obscured, or contradictory.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["camera", "timestampMs", "observation", "damageStatus", "evidenceFrameIds"],
      properties: {
        camera: { type: "string", enum: [...CAMERA_IDS] },
        timestampMs: { type: "integer", minimum: 0, maximum: 3_600_000 },
        observation: { type: "string", maxLength: 400 },
        region: { type: ["string", "null"], enum: [...DAMAGE_REGIONS, null] },
        damageStatus: { type: "string", enum: [...DAMAGE_STATUSES] },
        evidenceFrameIds: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    name: "generate_report",
    description:
      "Compile all saved findings into the final report. Call this once the investigation is complete. Takes no arguments.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: [],
      properties: {},
    },
  },
];
