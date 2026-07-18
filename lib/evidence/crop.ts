import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { isValidBBox, type NormalizedBBox } from "@/lib/domain/geometry";

export { isValidBBox, type NormalizedBBox };

export type CropResult =
  | {
      readonly ok: true;
      readonly path: string;
      readonly width: number;
      readonly height: number;
    }
  | { readonly ok: false; readonly reason: string };

export interface CreateCropInput {
  readonly framePath: string;
  readonly bbox: NormalizedBBox;
  readonly outPath: string;
  readonly minPx?: number;
}

/**
 * Crop a focused region from a frame using validated normalized coordinates.
 * Returns a discriminated failure (never throws for a bad box) so the caller can
 * keep customer photos unavailable and require manual review when a usable crop
 * cannot be produced.
 */
export async function createRegionCrop(
  input: CreateCropInput,
): Promise<CropResult> {
  if (!isValidBBox(input.bbox)) return { ok: false, reason: "invalid_bbox" };

  let meta: sharp.Metadata;
  try {
    meta = await sharp(input.framePath).metadata();
  } catch {
    return { ok: false, reason: "unreadable_frame" };
  }
  const frameW = meta.width ?? 0;
  const frameH = meta.height ?? 0;
  if (frameW <= 0 || frameH <= 0)
    return { ok: false, reason: "unreadable_frame" };

  const left = Math.max(0, Math.round(input.bbox.x * frameW));
  const top = Math.max(0, Math.round(input.bbox.y * frameH));
  const width = Math.min(frameW - left, Math.round(input.bbox.w * frameW));
  const height = Math.min(frameH - top, Math.round(input.bbox.h * frameH));

  const minPx = input.minPx ?? 24;
  if (width < minPx || height < minPx)
    return { ok: false, reason: "crop_too_small" };

  try {
    fs.mkdirSync(path.dirname(input.outPath), { recursive: true });
    await sharp(input.framePath)
      .extract({ left, top, width, height })
      .jpeg({ quality: 85 })
      .toFile(input.outPath);
  } catch {
    return { ok: false, reason: "crop_failed" };
  }
  return { ok: true, path: input.outPath, width, height };
}
