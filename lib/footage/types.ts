import type { CameraId } from "@/lib/domain/cameras";

export const FOOTAGE_KINDS = ["video", "image"] as const;
export type FootageKind = (typeof FOOTAGE_KINDS)[number];

/** One camera's footage for a visit: a video clip or a single still image. */
export interface CameraSource {
  /** Path relative to the footage root — never an absolute or traversing path. */
  readonly file: string;
  readonly kind: FootageKind;
  readonly durationMs?: number;
}

/** Per-camera footage for a visit. Not every camera is guaranteed present. */
export type FootageSources = Partial<Record<CameraId, CameraSource>>;

const VIDEO_EXT = new Set([".mp4", ".mov", ".webm", ".mkv", ".m4v"]);
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);

/** Infer the footage kind from a file extension. Defaults to image. */
export function inferKind(file: string): FootageKind {
  const dot = file.lastIndexOf(".");
  const ext = dot >= 0 ? file.slice(dot).toLowerCase() : "";
  if (VIDEO_EXT.has(ext)) return "video";
  if (IMAGE_EXT.has(ext)) return "image";
  return "image";
}
