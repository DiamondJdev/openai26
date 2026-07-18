import path from "node:path";
import type { ZodSchema } from "zod";
import type { InvestigationEventDetail, InvestigationEventType } from "@/lib/domain/models";
import { CAMERA_META } from "@/lib/domain/cameras";
import {
  ManualReviewRequiredError,
  ToolSecurityError,
} from "@/lib/domain/errors";
import { appendEvent } from "@/lib/db/repositories/events";
import { insertFrame, getFrameById } from "@/lib/db/repositories/evidence";
import { insertFinding } from "@/lib/db/repositories/findings";
import { resolveAvailableFootagePath } from "@/lib/footage/resolve";
import { extractFrameFromSource } from "@/lib/evidence/extract";
import { newId } from "@/lib/util/id";
import { compileAndPersistReport } from "@/lib/agent/report-compiler";
import { claimVisionContext, type ToolContext } from "./context";
import {
  analyzeFrameArgs,
  compareFramesArgs,
  extractFrameArgs,
  generateReportArgs,
  getClipWindowArgs,
  saveFindingArgs,
} from "./schemas";

function record(
  ctx: ToolContext,
  type: InvestigationEventType,
  plainLanguage: string,
  detail?: InvestigationEventDetail,
): void {
  const event = appendEvent(ctx.db, {
    claimId: ctx.claim.id,
    type,
    plainLanguage,
    detail: detail ?? null,
  });
  ctx.onEvent?.(event);
}

function parseArgs<T>(schema: ZodSchema<T>, raw: unknown, tool: string): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ToolSecurityError(`Invalid arguments for ${tool}`);
  }
  return parsed.data;
}

function clock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * Result of a tool call. When `terminal` is set the investigation loop stops:
 * either a report is ready for review, or the claim must go to manual review.
 */
export interface ToolResult {
  readonly output: unknown;
  readonly terminal?: "review_ready" | "manual_review_required";
  readonly reportId?: string;
  readonly manualReviewReason?: string;
}

export async function executeTool(
  ctx: ToolContext,
  name: string,
  rawArgs: unknown,
): Promise<ToolResult> {
  switch (name) {
    case "get_clip_window":
      return getClipWindow(ctx, rawArgs);
    case "extract_frame":
      return extractFrame(ctx, rawArgs);
    case "analyze_frame":
      return analyzeFrame(ctx, rawArgs);
    case "compare_frames":
      return compareFrames(ctx, rawArgs);
    case "save_finding":
      return saveFinding(ctx, rawArgs);
    case "generate_report":
      return generateReport(ctx, rawArgs);
    default:
      throw new ToolSecurityError(`Unknown tool: ${name}`);
  }
}

function getClipWindow(ctx: ToolContext, raw: unknown): ToolResult {
  const a = parseArgs(getClipWindowArgs, raw, "get_clip_window");
  const label = CAMERA_META[a.camera].label;
  record(
    ctx,
    "tool_call",
    `Pulled ${label} footage around ${clock(a.timestampMs)} (±${Math.round(a.windowMs / 1000)}s).`,
    { camera: a.camera, timestampMs: a.timestampMs },
  );
  const source = ctx.visit.sources[a.camera];
  if (!source) {
    record(ctx, "tool_result", `No ${label} footage is available.`, {
      camera: a.camera,
    });
    return { output: { camera: a.camera, available: false } };
  }
  const startMs = Math.max(0, a.timestampMs - a.windowMs);
  const endMs = a.timestampMs + a.windowMs;
  record(ctx, "tool_result", `${label} footage is available.`, {
    camera: a.camera,
    timestampMs: a.timestampMs,
  });
  return {
    output: {
      camera: a.camera,
      available: true,
      kind: source.kind,
      startMs,
      endMs,
      centerMs: a.timestampMs,
    },
  };
}

async function extractFrame(ctx: ToolContext, raw: unknown): Promise<ToolResult> {
  const a = parseArgs(extractFrameArgs, raw, "extract_frame");
  const label = CAMERA_META[a.camera].label;
  const source = ctx.visit.sources[a.camera];
  if (!source) {
    record(ctx, "tool_result", `No ${label} footage to capture from.`, {
      camera: a.camera,
    });
    return { output: { ok: false, reason: "source_unavailable", camera: a.camera } };
  }
  // resolveAvailableFootagePath keeps access scoped to the footage root and
  // can recover a persisted source after an in-place format-only rename.
  const sourcePath = resolveAvailableFootagePath(
    ctx.footageRoot,
    source.file,
    source.kind,
  );
  try {
    const outPath = path.join(
      ctx.framesDir,
      `${a.camera}-${a.timestampMs}-${newId()}.jpg`,
    );
    const frame = await extractFrameFromSource({
      sourcePath,
      kind: source.kind,
      timestampMs: a.timestampMs,
      outPath,
    });
    const row = insertFrame(ctx.db, {
      claimId: ctx.claim.id,
      camera: a.camera,
      timestampMs: a.timestampMs,
      storedPath: frame.path,
    });
    record(ctx, "tool_result", `Captured a still from ${label} at ${clock(a.timestampMs)}.`, {
      camera: a.camera,
      timestampMs: a.timestampMs,
      frameId: row.id,
    });
    return {
      output: {
        frameId: row.id,
        camera: a.camera,
        timestampMs: a.timestampMs,
        width: frame.width,
        height: frame.height,
      },
    };
  } catch {
    record(ctx, "error", `Could not capture a frame from ${label}.`, {
      camera: a.camera,
    });
    return { output: { ok: false, reason: "extract_failed", camera: a.camera } };
  }
}

function requireClaimFrame(ctx: ToolContext, frameId: string, tool: string) {
  const frame = getFrameById(ctx.db, frameId);
  if (!frame || frame.claimId !== ctx.claim.id) {
    throw new ToolSecurityError(`${tool}: frame ${frameId} is out of scope`);
  }
  return frame;
}

async function analyzeFrame(ctx: ToolContext, raw: unknown): Promise<ToolResult> {
  const a = parseArgs(analyzeFrameArgs, raw, "analyze_frame");
  const frame = requireClaimFrame(ctx, a.frameId, "analyze_frame");
  const analysis = await ctx.vision.analyzeFrame({
    imagePath: frame.storedPath,
    question: a.question,
    claim: claimVisionContext(ctx.claim),
  });
  ctx.localizations.set(frame.id, {
    region: analysis.region,
    bbox: analysis.bbox,
  });
  record(ctx, "observation", analysis.description, {
    camera: frame.camera,
    timestampMs: frame.timestampMs,
    frameId: frame.id,
  });
  // Geometry (bbox) is intentionally NOT returned to the model.
  return {
    output: {
      frameId: frame.id,
      description: analysis.description,
      damageObserved: analysis.damageObserved,
      obscured: analysis.obscured,
      matchesVehicle: analysis.matchesVehicle,
      region: analysis.region,
    },
  };
}

async function compareFrames(ctx: ToolContext, raw: unknown): Promise<ToolResult> {
  const a = parseArgs(compareFramesArgs, raw, "compare_frames");
  const before = requireClaimFrame(ctx, a.frameIdA, "compare_frames");
  const after = requireClaimFrame(ctx, a.frameIdB, "compare_frames");
  const cmp = await ctx.vision.compareFrames({
    imagePathA: before.storedPath,
    imagePathB: after.storedPath,
    question: a.question,
    claim: claimVisionContext(ctx.claim),
  });
  ctx.localizations.set(after.id, { region: cmp.region, bbox: cmp.bbox });
  record(ctx, "observation", cmp.description, {
    camera: after.camera,
    timestampMs: after.timestampMs,
    frameId: after.id,
  });
  return {
    output: {
      description: cmp.description,
      newDamage: cmp.newDamage,
      obscured: cmp.obscured,
      region: cmp.region,
    },
  };
}

function saveFinding(ctx: ToolContext, raw: unknown): ToolResult {
  const a = parseArgs(saveFindingArgs, raw, "save_finding");
  for (const fid of a.evidenceFrameIds) {
    requireClaimFrame(ctx, fid, "save_finding");
  }
  const region = a.region ?? null;
  // Attach trusted bbox from a prior localization, never from the model.
  let bbox = null;
  for (const fid of a.evidenceFrameIds) {
    const loc = ctx.localizations.get(fid);
    if (loc?.bbox && (region === null || loc.region === region)) {
      bbox = loc.bbox;
      break;
    }
  }
  const finding = insertFinding(ctx.db, {
    claimId: ctx.claim.id,
    camera: a.camera,
    timestampMs: a.timestampMs,
    observation: a.observation,
    region,
    damageStatus: a.damageStatus,
    bbox,
    evidenceFrameIds: a.evidenceFrameIds,
  });
  record(ctx, "finding_saved", a.observation, {
    camera: a.camera,
    timestampMs: a.timestampMs,
    frameId: a.evidenceFrameIds[0],
  });
  return { output: { findingId: finding.id, saved: true } };
}

function generateReport(ctx: ToolContext, raw: unknown): ToolResult {
  parseArgs(generateReportArgs, raw, "generate_report");
  try {
    const report = compileAndPersistReport(ctx.db, ctx.claim);
    record(ctx, "report_generated", `Report ready: ${report.conclusion}`);
    return {
      output: { reportId: report.id, outcome: report.outcome, status: "review_ready" },
      terminal: "review_ready",
      reportId: report.id,
    };
  } catch (error) {
    if (error instanceof ManualReviewRequiredError) {
      record(ctx, "manual_review", `Held for manual review: ${error.reason}`);
      return {
        output: { status: "manual_review_required", reason: error.reason },
        terminal: "manual_review_required",
        manualReviewReason: error.reason,
      };
    }
    throw error;
  }
}
