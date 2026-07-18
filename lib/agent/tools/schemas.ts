import { z } from "zod";
import { CAMERA_IDS } from "@/lib/domain/cameras";
import { DAMAGE_REGIONS } from "@/lib/domain/regions";
import { DAMAGE_STATUSES } from "@/lib/domain/report";

const MAX_TIMESTAMP_MS = 3_600_000; // 1 hour of footage is far beyond a wash pass.
const MAX_WINDOW_MS = 120_000;
const MAX_TEXT = 400;
const MAX_FRAME_ID = 200;

const timestamp = z.number().int().min(0).max(MAX_TIMESTAMP_MS);
const frameId = z.string().min(1).max(MAX_FRAME_ID);

// `.strict()` rejects unknown keys so the model cannot smuggle a path, url,
// claimId, or cameraId outside the closed enums.
export const getClipWindowArgs = z
  .object({
    camera: z.enum(CAMERA_IDS),
    timestampMs: timestamp,
    windowMs: z.number().int().min(1).max(MAX_WINDOW_MS),
  })
  .strict();

export const extractFrameArgs = z
  .object({
    camera: z.enum(CAMERA_IDS),
    timestampMs: timestamp,
  })
  .strict();

export const analyzeFrameArgs = z
  .object({
    frameId,
    question: z.string().min(1).max(MAX_TEXT),
  })
  .strict();

export const compareFramesArgs = z
  .object({
    frameIdA: frameId,
    frameIdB: frameId,
    question: z.string().min(1).max(MAX_TEXT),
  })
  .strict();

export const saveFindingArgs = z
  .object({
    camera: z.enum(CAMERA_IDS),
    timestampMs: timestamp,
    observation: z.string().min(1).max(MAX_TEXT),
    region: z.enum(DAMAGE_REGIONS).nullish(),
    damageStatus: z.enum(DAMAGE_STATUSES),
    evidenceFrameIds: z.array(frameId).min(1).max(8),
  })
  .strict();

export const generateReportArgs = z.object({}).strict();

export type GetClipWindowArgs = z.infer<typeof getClipWindowArgs>;
export type ExtractFrameArgs = z.infer<typeof extractFrameArgs>;
export type AnalyzeFrameArgs = z.infer<typeof analyzeFrameArgs>;
export type CompareFramesArgs = z.infer<typeof compareFramesArgs>;
export type SaveFindingArgs = z.infer<typeof saveFindingArgs>;

export const TOOL_NAMES = [
  "get_clip_window",
  "extract_frame",
  "analyze_frame",
  "compare_frames",
  "save_finding",
  "generate_report",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export function isToolName(value: unknown): value is ToolName {
  return typeof value === "string" && (TOOL_NAMES as readonly string[]).includes(value);
}
