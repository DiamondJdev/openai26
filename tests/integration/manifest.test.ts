import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadManifest, seedFromManifest } from "@/lib/footage/manifest";
import { extractFrameFromSource } from "@/lib/evidence/extract";
import { findLatestVisitByPlate } from "@/lib/db/repositories/visits";
import { ValidationError } from "@/lib/domain/errors";
import { testDb } from "../helpers/db";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "claimlens-man-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function writeManifest(obj: unknown): string {
  const p = path.join(tmp, "manifest.json");
  fs.writeFileSync(p, JSON.stringify(obj));
  return p;
}

describe("footage manifest", () => {
  it("keeps the checked-in demo footage extractable for every camera", async () => {
    const manifestPath = path.resolve("fixtures/manifest.json");
    const { manifest, footageRoot } = loadManifest(manifestPath);
    const visit = manifest.visits[0];
    if (!visit) throw new Error("Checked-in demo manifest has no visits");
    const framesDir = path.join(tmp, "frames");

    for (const [camera, source] of Object.entries(visit.sources)) {
      const sourcePath = path.join(footageRoot, source.file);
      const frame = await extractFrameFromSource({
        sourcePath,
        kind: source.kind ?? "image",
        timestampMs: 10_000,
        outPath: path.join(framesDir, `${camera}.jpg`),
      });

      expect(frame.width).toBeGreaterThan(0);
      expect(frame.height).toBeGreaterThan(0);
    }
  });

  it("loads, validates, and seeds visits with normalized plates", () => {
    const p = writeManifest({
      visits: [
        {
          plate: "7GAB-991",
          vehicleType: "car",
          occurredAt: "2026-07-18T10:32:00.000Z",
          sources: {
            entrance: { file: "v/entrance.mp4" },
            mid_tunnel: { file: "v/mid.mp4" },
            exit: { file: "v/exit.png" },
          },
        },
      ],
    });
    const { manifest, footageRoot } = loadManifest(p);
    expect(footageRoot).toBe(path.resolve(tmp));

    const db = testDb();
    expect(seedFromManifest(db, manifest)).toBe(1);

    const visit = findLatestVisitByPlate(db, "7GAB991");
    expect(visit).not.toBeNull();
    expect(visit?.vehicleType).toBe("car");
    // kind inferred from extension when omitted.
    expect(visit?.sources.entrance?.kind).toBe("video");
    expect(visit?.sources.exit?.kind).toBe("image");
  });

  it("rejects a manifest that fails schema validation", () => {
    const p = writeManifest({ visits: [{ plate: "", vehicleType: "boat" }] });
    expect(() => loadManifest(p)).toThrow(ValidationError);
  });

  it("throws a friendly error when the manifest file is missing", () => {
    expect(() => loadManifest(path.join(tmp, "nope.json"))).toThrow(
      ValidationError,
    );
  });
});
