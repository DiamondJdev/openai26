import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ZodSchema } from "zod";
import type { InvestigationEventDetail, InvestigationEventType } from "@/lib/domain/models";
import { CAMERA_META } from "@/lib/domain/cameras";
import { ManualReviewRequiredError, ToolSecurityError } from "@/lib/domain/errors";
import { appendEvent } from "@/lib/db/repositories/events";
import { insertFrame, getFrameById } from "@/lib/db/repositories/evidence";
import { insertFinding } from "@/lib/db/repositories/findings";
import { resolveAvailableFootagePath } from "@/lib/footage/resolve";
import { extractFrameFromSource } from "@/lib/evidence/extract";
import { newId } from "@/lib/util/id";
import { compileAndPersistReport } from "@/lib/agent/report-compiler";
import { claimVisionContext, type ToolContext } from "./context";
import { analyzeFrameArgs, compareFramesArgs, extractFrameArgs, generateReportArgs, getClipWindowArgs, saveFindingArgs } from "./schemas";

async function record(ctx: ToolContext, type: InvestigationEventType, plainLanguage: string, detail?: InvestigationEventDetail): Promise<void> {
  const event = await appendEvent(ctx.db, { claimId: ctx.claim.id, type, plainLanguage, detail: detail ?? null });
  ctx.onEvent?.(event);
}

function parseArgs<T>(schema: ZodSchema<T>, raw: unknown, tool: string): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ToolSecurityError(`Invalid arguments for ${tool}`);
  return parsed.data;
}

function clock(ms: number): string { const total = Math.floor(ms / 1000); return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; }

export interface ToolResult { readonly output: unknown; readonly terminal?: "review_ready" | "manual_review_required"; readonly reportId?: string; readonly manualReviewReason?: string; }

export async function executeTool(ctx: ToolContext, name: string, rawArgs: unknown): Promise<ToolResult> {
  switch (name) {
    case "get_clip_window": return await getClipWindow(ctx, rawArgs);
    case "extract_frame": return await extractFrame(ctx, rawArgs);
    case "analyze_frame": return await analyzeFrame(ctx, rawArgs);
    case "compare_frames": return await compareFrames(ctx, rawArgs);
    case "save_finding": return await saveFinding(ctx, rawArgs);
    case "generate_report": return await generateReport(ctx, rawArgs);
    default: throw new ToolSecurityError(`Unknown tool: ${name}`);
  }
}

async function getClipWindow(ctx: ToolContext, raw: unknown): Promise<ToolResult> {
  const a = parseArgs(getClipWindowArgs, raw, "get_clip_window");
  const label = CAMERA_META[a.camera].label;
  await record(ctx, "tool_call", `Pulled ${label} footage around ${clock(a.timestampMs)} (±${Math.round(a.windowMs / 1000)}s).`, { camera: a.camera, timestampMs: a.timestampMs });
  const source = ctx.visit.sources[a.camera];
  if (!source) {
    await record(ctx, "tool_result", `No ${label} footage is available.`, { camera: a.camera });
    return { output: { camera: a.camera, available: false } };
  }
  const startMs = Math.max(0, a.timestampMs - a.windowMs);
  const endMs = a.timestampMs + a.windowMs;
  await record(ctx, "tool_result", `${label} footage is available.`, { camera: a.camera, timestampMs: a.timestampMs });
  return { output: { camera: a.camera, available: true, kind: source.kind, startMs, endMs, centerMs: a.timestampMs } };
}

async function extractFrame(ctx: ToolContext, raw: unknown): Promise<ToolResult> {
  const a = parseArgs(extractFrameArgs, raw, "extract_frame");
  const label = CAMERA_META[a.camera].label;
  const source = ctx.visit.sources[a.camera];
  if (!source) {
    await record(ctx, "tool_result", `No ${label} footage to capture from.`, { camera: a.camera });
    return { output: { ok: false, reason: "source_unavailable", camera: a.camera } };
  }
  if (source.kind === "video") {
    await record(ctx, "tool_result", `${label} video cannot be analyzed in this deployment.`, { camera: a.camera, timestampMs: a.timestampMs });
    return { output: { ok: false, reason: "video_unsupported", camera: a.camera } };
  }
  const sourcePath = resolveAvailableFootagePath(ctx.footageRoot, source.file, source.kind);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "claimlens-frame-"));
  try {
    const localPath = path.join(directory, `${newId("frame")}.jpg`);
    const frame = await extractFrameFromSource({ sourcePath, kind: source.kind, timestampMs: a.timestampMs, outPath: localPath });
    const storedPath = `claimlens/frames/${ctx.claim.id}/${newId("frame")}.jpg`;
    await ctx.artifacts.putJpeg(storedPath, await fs.readFile(frame.path));
    const row = await insertFrame(ctx.db, { claimId: ctx.claim.id, camera: a.camera, timestampMs: a.timestampMs, storedPath });
    await record(ctx, "tool_result", `Captured a still from ${label} at ${clock(a.timestampMs)}.`, { camera: a.camera, timestampMs: a.timestampMs, frameId: row.id });
    return { output: { frameId: row.id, camera: a.camera, timestampMs: a.timestampMs, width: frame.width, height: frame.height } };
  } catch {
    await record(ctx, "error", `Could not capture a frame from ${label}.`, { camera: a.camera });
    return { output: { ok: false, reason: "extract_failed", camera: a.camera } };
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

async function requireClaimFrame(ctx: ToolContext, frameId: string, tool: string) {
  const frame = await getFrameById(ctx.db, frameId);
  if (!frame || frame.claimId !== ctx.claim.id) throw new ToolSecurityError(`${tool}: frame ${frameId} is out of scope`);
  return frame;
}

async function analyzeFrame(ctx: ToolContext, raw: unknown): Promise<ToolResult> {
  const a = parseArgs(analyzeFrameArgs, raw, "analyze_frame");
  const frame = await requireClaimFrame(ctx, a.frameId, "analyze_frame");
  const analysis = await ctx.artifacts.withLocalFile(frame.storedPath, async (imagePath) => await ctx.vision.analyzeFrame({ imagePath, question: a.question, claim: claimVisionContext(ctx.claim) }));
  ctx.localizations.set(frame.id, { region: analysis.region, bbox: analysis.bbox });
  await record(ctx, "observation", analysis.description, { camera: frame.camera, timestampMs: frame.timestampMs, frameId: frame.id });
  return { output: { frameId: frame.id, description: analysis.description, damageObserved: analysis.damageObserved, obscured: analysis.obscured, matchesVehicle: analysis.matchesVehicle, region: analysis.region } };
}

async function compareFrames(ctx: ToolContext, raw: unknown): Promise<ToolResult> {
  const a = parseArgs(compareFramesArgs, raw, "compare_frames");
  const before = await requireClaimFrame(ctx, a.frameIdA, "compare_frames");
  const after = await requireClaimFrame(ctx, a.frameIdB, "compare_frames");
  const cmp = await ctx.artifacts.withLocalFile(before.storedPath, async (imagePathA) => await ctx.artifacts.withLocalFile(after.storedPath, async (imagePathB) => await ctx.vision.compareFrames({ imagePathA, imagePathB, question: a.question, claim: claimVisionContext(ctx.claim) })));
  ctx.localizations.set(after.id, { region: cmp.region, bbox: cmp.bbox });
  await record(ctx, "observation", cmp.description, { camera: after.camera, timestampMs: after.timestampMs, frameId: after.id });
  return { output: { description: cmp.description, newDamage: cmp.newDamage, obscured: cmp.obscured, region: cmp.region } };
}

async function saveFinding(ctx: ToolContext, raw: unknown): Promise<ToolResult> {
  const a = parseArgs(saveFindingArgs, raw, "save_finding");
  for (const fid of a.evidenceFrameIds) await requireClaimFrame(ctx, fid, "save_finding");
  const region = a.region ?? null;
  let bbox = null;
  for (const fid of a.evidenceFrameIds) {
    const loc = ctx.localizations.get(fid);
    if (loc?.bbox && (region === null || loc.region === region)) { bbox = loc.bbox; break; }
  }
  const finding = await insertFinding(ctx.db, { claimId: ctx.claim.id, camera: a.camera, timestampMs: a.timestampMs, observation: a.observation, region, damageStatus: a.damageStatus, bbox, evidenceFrameIds: a.evidenceFrameIds });
  await record(ctx, "finding_saved", a.observation, { camera: a.camera, timestampMs: a.timestampMs, frameId: a.evidenceFrameIds[0] });
  return { output: { findingId: finding.id, saved: true } };
}

async function generateReport(ctx: ToolContext, raw: unknown): Promise<ToolResult> {
  parseArgs(generateReportArgs, raw, "generate_report");
  try {
    const report = await compileAndPersistReport(ctx.db, ctx.claim);
    await record(ctx, "report_generated", `Report ready: ${report.conclusion}`);
    return { output: { reportId: report.id, outcome: report.outcome, status: "review_ready" }, terminal: "review_ready", reportId: report.id };
  } catch (error) {
    if (error instanceof ManualReviewRequiredError) {
      await record(ctx, "manual_review", `Held for manual review: ${error.reason}`);
      return { output: { status: "manual_review_required", reason: error.reason }, terminal: "manual_review_required", manualReviewReason: error.reason };
    }
    throw error;
  }
}
