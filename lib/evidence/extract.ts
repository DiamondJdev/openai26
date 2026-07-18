import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { FootageKind } from "@/lib/footage/types";
import { runFfmpeg } from "./ffmpeg";

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
 * Extract a single still frame. For a video, seeks to the timestamp via ffmpeg;
 * for a still image, re-encodes the image (timestamp ignored). Output is always
 * a clean JPEG with no metadata. Throws if no usable frame is produced.
 */
export async function extractFrameFromSource(
  input: ExtractFrameInput,
): Promise<ExtractedFrame> {
  fs.mkdirSync(path.dirname(input.outPath), { recursive: true });

  if (input.kind === "image") {
    await sharp(input.sourcePath)
      .rotate()
      .jpeg({ quality: 85 })
      .toFile(input.outPath);
  } else {
    const seconds = Math.max(0, input.timestampMs / 1000);
    await runFfmpeg([
      "-y",
      "-ss",
      seconds.toFixed(3),
      "-i",
      input.sourcePath,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      input.outPath,
    ]);
  }

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
