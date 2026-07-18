import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import { buildToolHarness, type ToolHarness } from "../helpers/tools";
import { executeTool } from "@/lib/agent/tools/execute";
import { ToolSecurityError } from "@/lib/domain/errors";
import { getFindingById } from "@/lib/db/repositories/findings";
import { listEventsByClaim } from "@/lib/db/repositories/events";
import { getReportByClaimId } from "@/lib/db/repositories/reports";
import { getClaimByIdOrThrow } from "@/lib/db/repositories/claims";

let h: ToolHarness;

beforeEach(async () => {
  h = await buildToolHarness();
});
afterEach(async () => {
  await h.cleanup();
});

async function extract(camera: string, ts: number): Promise<string> {
  const res = await executeTool(h.ctx, "extract_frame", {
    camera,
    timestampMs: ts,
  });
  const out = res.output as { frameId: string };
  return out.frameId;
}

describe("tool: get_clip_window", () => {
  it("reports a bounded, available window for a fixed camera", async () => {
    const res = await executeTool(h.ctx, "get_clip_window", {
      camera: "entrance",
      timestampMs: 10_000,
      windowMs: 5_000,
    });
    expect(res.output).toMatchObject({
      camera: "entrance",
      available: true,
      startMs: 5_000,
      endMs: 15_000,
    });
  });
});

describe("schema + scope enforcement", () => {
  it("rejects a camera outside the fixed set", async () => {
    await expect(
      executeTool(h.ctx, "get_clip_window", {
        camera: "roofcam",
        timestampMs: 1,
        windowMs: 1,
      }),
    ).rejects.toThrow(ToolSecurityError);
  });

  it("rejects unknown extra arguments (no path/url smuggling)", async () => {
    await expect(
      executeTool(h.ctx, "extract_frame", {
        camera: "entrance",
        timestampMs: 1,
        path: "/etc/passwd",
      }),
    ).rejects.toThrow(ToolSecurityError);
  });

  it("rejects an unknown tool name", async () => {
    await expect(executeTool(h.ctx, "rm_rf", {})).rejects.toThrow(
      ToolSecurityError,
    );
  });

  it("rejects analyze_frame on a frame outside the claim scope", async () => {
    await expect(
      executeTool(h.ctx, "analyze_frame", {
        frameId: "frame_not_mine",
        question: "any damage?",
      }),
    ).rejects.toThrow(ToolSecurityError);
  });

  it("rejects save_finding that cites an out-of-scope frame", async () => {
    await expect(
      executeTool(h.ctx, "save_finding", {
        camera: "entrance",
        timestampMs: 1,
        observation: "x",
        damageStatus: "no_damage",
        evidenceFrameIds: ["frame_not_mine"],
      }),
    ).rejects.toThrow(ToolSecurityError);
  });
});

describe("tool: extract_frame + analyze_frame", () => {
  it("rejects a video source before attempting extraction", async () => {
    h.visit.sources.entrance = { file: "v/entrance.png", kind: "video" };

    const result = await executeTool(h.ctx, "extract_frame", {
      camera: "entrance",
      timestampMs: 0,
    });

    expect(result.output).toMatchObject({
      ok: false,
      reason: "video_unsupported",
    });
  });

  it("extracts a scoped frame and records a plain-language event", async () => {
    const frameId = await extract("entrance", 11_000);
    expect(frameId).toMatch(/^frame_/);
    const events = await listEventsByClaim(h.db, h.claim.id);
    expect(events.some((e) => e.type === "tool_result")).toBe(true);
  });

  it("recovers an image when a persisted source has a stale extension", async () => {
    h.visit.sources.entrance = { file: "v/entrance.jpg", kind: "image" };

    const frameId = await extract("entrance", 11_000);

    expect(frameId).toMatch(/^frame_/);
  });

  it("analyzes an in-scope frame and stores localization", async () => {
    h.vision.analyzeResponses = [
      {
        description: "existing dent, unchanged",
        damageObserved: true,
        region: "rear_bumper",
        bbox: { x: 0.3, y: 0.4, w: 0.2, h: 0.2 },
      },
    ];
    const frameId = await extract("entrance", 11_000);
    const res = await executeTool(h.ctx, "analyze_frame", {
      frameId,
      question: "any visible damage on rear bumper?",
    });
    // bbox is not leaked to the model.
    expect(res.output).not.toHaveProperty("bbox");
    expect(h.ctx.localizations.get(frameId)?.bbox).toEqual({
      x: 0.3,
      y: 0.4,
      w: 0.2,
      h: 0.2,
    });
  });
});

describe("tool: save_finding", () => {
  it("attaches trusted bbox from a prior analysis, not from the model", async () => {
    h.vision.analyzeResponses = [
      { region: "rear_bumper", bbox: { x: 0.3, y: 0.4, w: 0.2, h: 0.2 } },
    ];
    const frameId = await extract("entrance", 11_000);
    await executeTool(h.ctx, "analyze_frame", {
      frameId,
      question: "damage?",
    });
    const res = await executeTool(h.ctx, "save_finding", {
      camera: "entrance",
      timestampMs: 11_000,
      observation: "existing dent",
      region: "rear_bumper",
      damageStatus: "pre_existing",
      evidenceFrameIds: [frameId],
    });
    const { findingId } = res.output as { findingId: string };
    const finding = await getFindingById(h.db, findingId);
    expect(finding?.bbox).toEqual({ x: 0.3, y: 0.4, w: 0.2, h: 0.2 });
  });
});

describe("tool: generate_report", () => {
  it("holds for manual review when there are no findings", async () => {
    const res = await executeTool(h.ctx, "generate_report", {});
    expect(res.terminal).toBe("manual_review_required");
  });

  it("compiles a review-ready report that cites saved evidence", async () => {
    const entrance = await extract("entrance", 11_000);
    const exit = await extract("exit", 40_000);
    await executeTool(h.ctx, "save_finding", {
      camera: "entrance",
      timestampMs: 11_000,
      observation: "clean before wash",
      damageStatus: "no_damage",
      evidenceFrameIds: [entrance],
    });
    await executeTool(h.ctx, "save_finding", {
      camera: "exit",
      timestampMs: 40_000,
      observation: "clean after wash",
      damageStatus: "no_damage",
      evidenceFrameIds: [exit],
    });
    const res = await executeTool(h.ctx, "generate_report", {});
    expect(res.terminal).toBe("review_ready");

    const report = await getReportByClaimId(h.db, h.claim.id);
    expect(report?.outcome).toBe("no_new_damage_detected");
    // every timeline entry cites a frame
    expect(report?.timeline.every((t) => t.frameId)).toBe(true);
    expect((await getClaimByIdOrThrow(h.db, h.claim.id)).reportId).toBe(report?.id);
  });
});
