import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { resetDemo } from "@/lib/claims/reset";
import { getAppContext } from "@/lib/runtime/context";
import { POST } from "@/app/api/employee/reset/route";
import { buildAppHarness, type AppHarness } from "../helpers/app";

vi.mock("@/lib/runtime/context", () => ({
  getAppContext: vi.fn(),
}));

const getMockAppContext = vi.mocked(getAppContext);

let harness: AppHarness;

beforeEach(async () => {
  harness = await buildAppHarness();
  const manifestPath = path.join(harness.tmp, "reset-manifest.json");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({
      visits: [
        {
          plate: "RESET-123",
          vehicleType: "car",
          occurredAt: "2026-07-18T12:00:00.000Z",
          sources: {},
        },
      ],
    }),
  );
  const ctx = {
    ...harness.ctx,
    env: { ...harness.ctx.env, manifestPath },
  };
  harness = { ...harness, ctx };
  getMockAppContext.mockResolvedValue(ctx);
});

afterEach(async () => {
  vi.clearAllMocks();
  await harness.cleanup();
});

describe("hosted demo reset", () => {
  it("clears only ClaimLens artifacts and restores demo visits", async () => {
    const { ctx } = harness;
    await ctx.artifacts.putJpeg(
      "claimlens/uploads/claim_a/a.jpg",
      Buffer.from("a"),
    );
    await ctx.artifacts.putJpeg("other/keep.jpg", Buffer.from("keep"));

    const result = await resetDemo(ctx);

    expect(result).toEqual({ seededVisits: 1, deletedArtifacts: 1 });
    await expect(
      ctx.artifacts.get("claimlens/uploads/claim_a/a.jpg"),
    ).resolves.toBeNull();
    await expect(ctx.artifacts.get("other/keep.jpg")).resolves.toEqual(
      Buffer.from("keep"),
    );
    expect(await ctx.db.query("SELECT plate_display FROM visits")).toEqual([
      { plate_display: "RESET-123" },
    ]);
  });

  it("returns the reset result through the employee reset API", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { seededVisits: 1, deletedArtifacts: 0 },
    });
  });
});
