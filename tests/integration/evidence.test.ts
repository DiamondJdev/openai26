import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { runFfmpeg } from "@/lib/evidence/ffmpeg";
import { extractFrameFromSource } from "@/lib/evidence/extract";
import { createRegionCrop, isValidBBox } from "@/lib/evidence/crop";
import { resolveFootagePath } from "@/lib/footage/resolve";
import { ToolSecurityError } from "@/lib/domain/errors";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "claimlens-evi-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function makePng(w: number, h: number, file: string): Promise<string> {
  const p = path.join(tmp, file);
  await sharp({
    create: { width: w, height: h, channels: 3, background: "#2244aa" },
  })
    .png()
    .toFile(p);
  return p;
}

describe("frame extraction", () => {
  it("extracts a frame from a still image source", async () => {
    const src = await makePng(320, 240, "still.png");
    const out = path.join(tmp, "frames", "e.jpg");
    const frame = await extractFrameFromSource({
      sourcePath: src,
      kind: "image",
      timestampMs: 0,
      outPath: out,
    });
    expect(fs.existsSync(out)).toBe(true);
    expect(frame.width).toBe(320);
    expect(frame.height).toBe(240);
  });

  it("extracts a frame from a video source at a timestamp", async () => {
    const video = path.join(tmp, "clip.mp4");
    await runFfmpeg([
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=green:s=320x240:d=1",
      "-pix_fmt",
      "yuv420p",
      video,
    ]);
    const out = path.join(tmp, "frames", "v.jpg");
    const frame = await extractFrameFromSource({
      sourcePath: video,
      kind: "video",
      timestampMs: 500,
      outPath: out,
    });
    expect(fs.existsSync(out)).toBe(true);
    expect(frame.width).toBe(320);
    expect(frame.height).toBe(240);
  });
});

describe("region crops", () => {
  it("validates normalized bounding boxes", () => {
    expect(isValidBBox({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 })).toBe(true);
    expect(isValidBBox({ x: 0.9, y: 0.1, w: 0.5, h: 0.1 })).toBe(false);
    expect(isValidBBox({ x: -0.1, y: 0, w: 0.5, h: 0.5 })).toBe(false);
    expect(isValidBBox({ x: 0, y: 0, w: 0, h: 0.5 })).toBe(false);
  });

  it("creates a focused crop from a valid box", async () => {
    const frame = await makePng(400, 300, "frame.png");
    const out = path.join(tmp, "crops", "c.jpg");
    const result = await createRegionCrop({
      framePath: frame,
      bbox: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
      outPath: out,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.width).toBe(200);
    expect(result.height).toBe(150);
    expect(fs.existsSync(out)).toBe(true);
  });

  it("refuses an invalid box without throwing", async () => {
    const frame = await makePng(400, 300, "frame2.png");
    const result = await createRegionCrop({
      framePath: frame,
      bbox: { x: 0.95, y: 0.95, w: 0.5, h: 0.5 },
      outPath: path.join(tmp, "crops", "bad.jpg"),
    });
    expect(result.ok).toBe(false);
  });

  it("refuses a crop that would be too small", async () => {
    const frame = await makePng(400, 300, "frame3.png");
    const result = await createRegionCrop({
      framePath: frame,
      bbox: { x: 0, y: 0, w: 0.01, h: 0.01 },
      outPath: path.join(tmp, "crops", "tiny.jpg"),
      minPx: 24,
    });
    expect(result.ok).toBe(false);
  });
});

describe("footage path scoping", () => {
  it("resolves a path inside the root", () => {
    const resolved = resolveFootagePath(tmp, "visit/entrance.mp4");
    expect(resolved.startsWith(path.resolve(tmp))).toBe(true);
  });

  it("rejects traversal and absolute paths", () => {
    expect(() => resolveFootagePath(tmp, "../../etc/passwd")).toThrow(
      ToolSecurityError,
    );
    expect(() => resolveFootagePath(tmp, "/etc/passwd")).toThrow(
      ToolSecurityError,
    );
  });
});
