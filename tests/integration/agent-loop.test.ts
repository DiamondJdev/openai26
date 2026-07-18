import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildToolHarness, type ToolHarness } from "../helpers/tools";
import { scriptedDriver, tc } from "../helpers/driver";
import { runInvestigation } from "@/lib/agent/loop";
import { getReportByClaimId } from "@/lib/db/repositories/reports";
import { getClaimByIdOrThrow } from "@/lib/db/repositories/claims";
import { listEventsByClaim } from "@/lib/db/repositories/events";

let h: ToolHarness;
const LIMITS = { maxInvestigationMs: 45_000 };

beforeEach(async () => {
  h = await buildToolHarness();
});
afterEach(() => {
  h.cleanup();
});

/** Clean-pass plan: extract entrance+exit, analyze, compare, save, report. */
function cleanPlan(ids: string[], turn: number) {
  switch (turn) {
    case 0:
      return [tc("extract_frame", { camera: "entrance", timestampMs: 11_000 })];
    case 1:
      return [tc("extract_frame", { camera: "exit", timestampMs: 40_000 })];
    case 2:
      return [tc("analyze_frame", { frameId: ids[0], question: "match + damage?" })];
    case 3:
      return [
        tc("compare_frames", {
          frameIdA: ids[0],
          frameIdB: ids[1],
          question: "new damage near rear bumper?",
        }),
      ];
    case 4:
      return [
        tc("save_finding", {
          camera: "entrance",
          timestampMs: 11_000,
          observation: "clean before wash",
          damageStatus: "no_damage",
          evidenceFrameIds: [ids[0]],
        }),
      ];
    case 5:
      return [
        tc("save_finding", {
          camera: "exit",
          timestampMs: 40_000,
          observation: "clean after wash",
          damageStatus: "no_damage",
          evidenceFrameIds: [ids[1]],
        }),
      ];
    default:
      return [tc("generate_report", {})];
  }
}

describe("runInvestigation", () => {
  it("completes the clean-pass scenario with a cited report", async () => {
    const result = await runInvestigation({
      ctx: h.ctx,
      driver: scriptedDriver(cleanPlan),
      limits: LIMITS,
    });
    expect(result.status).toBe("review_ready");
    const report = getReportByClaimId(h.db, h.claim.id);
    expect(report?.outcome).toBe("no_new_damage_detected");
    expect(report?.timeline.every((t) => t.frameId)).toBe(true);
    expect(getClaimByIdOrThrow(h.db, h.claim.id).status).toBe("review_ready");
    const events = listEventsByClaim(h.db, h.claim.id);
    expect(events[0]?.type).toBe("started");
  });

  it("reaches a new-damage conclusion when the comparison finds new damage", async () => {
    h.vision.compareResponses = [
      {
        description: "fresh scratch on rear bumper",
        newDamage: true,
        region: "rear_bumper",
        bbox: { x: 0.4, y: 0.6, w: 0.2, h: 0.2 },
      },
    ];
    const plan = (ids: string[], turn: number) => {
      switch (turn) {
        case 0:
          return [tc("extract_frame", { camera: "entrance", timestampMs: 11_000 })];
        case 1:
          return [tc("extract_frame", { camera: "exit", timestampMs: 40_000 })];
        case 2:
          return [
            tc("compare_frames", {
              frameIdA: ids[0],
              frameIdB: ids[1],
              question: "new damage?",
            }),
          ];
        case 3:
          return [
            tc("save_finding", {
              camera: "exit",
              timestampMs: 40_000,
              observation: "new scratch on rear bumper",
              region: "rear_bumper",
              damageStatus: "new_damage",
              evidenceFrameIds: [ids[1]],
            }),
          ];
        default:
          return [tc("generate_report", {})];
      }
    };
    const result = await runInvestigation({
      ctx: h.ctx,
      driver: scriptedDriver(plan),
      limits: LIMITS,
    });
    expect(result.status).toBe("review_ready");
    expect(getReportByClaimId(h.db, h.claim.id)?.outcome).toBe(
      "new_damage_detected",
    );
  });

  it("routes obscured/inconclusive footage to manual review", async () => {
    h.vision.analyzeResponses = [{ description: "footage obscured", obscured: true }];
    const plan = (ids: string[], turn: number) => {
      switch (turn) {
        case 0:
          return [tc("extract_frame", { camera: "exit", timestampMs: 40_000 })];
        case 1:
          return [tc("analyze_frame", { frameId: ids[0], question: "damage?" })];
        case 2:
          return [
            tc("save_finding", {
              camera: "exit",
              timestampMs: 40_000,
              observation: "cannot tell — spray obscures rear bumper",
              damageStatus: "inconclusive",
              evidenceFrameIds: [ids[0]],
            }),
          ];
        default:
          return [tc("generate_report", {})];
      }
    };
    const result = await runInvestigation({
      ctx: h.ctx,
      driver: scriptedDriver(plan),
      limits: LIMITS,
    });
    expect(result.status).toBe("manual_review_required");
    expect(getClaimByIdOrThrow(h.db, h.claim.id).status).toBe(
      "manual_review_required",
    );
    expect(getReportByClaimId(h.db, h.claim.id)).toBeNull();
  });

  it("continues past a tool-call count until the investigation times out", async () => {
    const driver = scriptedDriver(() => [
      tc("extract_frame", { camera: "entrance", timestampMs: 1_000 }),
    ]);
    const nowValues = [0, 0, 0, 0, 0, 999_999];
    let i = 0;
    const now = () => nowValues[Math.min(i++, nowValues.length - 1)] ?? 999_999;
    const result = await runInvestigation({
      ctx: h.ctx,
      driver,
      limits: { maxInvestigationMs: 45_000 },
      now,
    });
    expect(result.status).toBe("manual_review_required");
    expect(result.reason).toMatch(/timed out/i);
    expect(result.toolCallCount).toBe(4);
  });

  it("holds for manual review when the run times out", async () => {
    const nowValues = [0, 0, 999_999, 999_999];
    let i = 0;
    const now = () => nowValues[Math.min(i++, nowValues.length - 1)] ?? 999_999;
    const driver = scriptedDriver(() => [
      tc("extract_frame", { camera: "entrance", timestampMs: 1_000 }),
    ]);
    const result = await runInvestigation({
      ctx: h.ctx,
      driver,
      limits: LIMITS,
      now,
    });
    expect(result.status).toBe("manual_review_required");
    expect(result.reason).toMatch(/timed out/i);
  });

  it("holds for manual review when the model stops without a report", async () => {
    const driver = scriptedDriver(() => []);
    const result = await runInvestigation({
      ctx: h.ctx,
      driver,
      limits: LIMITS,
    });
    expect(result.status).toBe("manual_review_required");
  });
});
