import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { FootageKind } from "@/lib/footage/types";

export interface ExtractedFrame {
  readonly path: string;
  readonly width: number;
  readonly height: number;
}

export interface ExtractFrameInput {
  /** Absolute path, already scoped to the footage root by resolveFootagePath. */
  readonly sourcePath: string;
  readonly kind: FootageKind;
  readonly timestampMs: number;
  /** Absolute output path for the extracted JPEG. */
  readonly outPath: string;
}

/**
 * Re-encode a still image as a clean JPEG (timestamp ignored). Video footage is
 * intentionally unsupported in the Vercel deployment and is rejected before
 * any ffmpeg process can be started.
 */
export async function extractFrameFromSource(
  input: ExtractFrameInput,
): Promise<ExtractedFrame> {
  fs.mkdirSync(path.dirname(input.outPath), { recursive: true });

  if (input.kind === "video") throw new Error("video_unsupported");
  await sharp(input.sourcePath)
    .rotate()
    .jpeg({ quality: 85 })
    .toFile(input.outPath);

  if (!fs.existsSync(input.outPath) || fs.statSync(input.outPath).size === 0) {
    throw new Error("Frame extraction produced no output");
  }

  const meta = await sharp(input.outPath).metadata();
  return {
    path: input.outPath,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
  };
}
