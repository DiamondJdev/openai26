import fs from "node:fs";
import path from "node:path";
import { ToolSecurityError } from "@/lib/domain/errors";
import type { FootageKind } from "./types";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];
const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".mkv", ".m4v"];

/**
 * Resolve a footage file path against an allowed root, rejecting any path that
 * escapes the root (traversal, absolute paths, symlink-style tricks). This is
 * the single choke point that keeps camera/file access scoped — the model can
 * never reach an arbitrary path on disk.
 */
export function resolveFootagePath(footageRoot: string, file: string): string {
  const root = path.resolve(footageRoot);
  const resolved = path.resolve(root, file);
  const rel = path.relative(root, resolved);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new ToolSecurityError("Footage path escapes the allowed root");
  }
  return resolved;
}

/**
 * Locate a source after a harmless format-only rename (for example .jpg to
 * .png) without broadening the footage-root scope. Visits persist a manifest
 * snapshot, so this keeps an in-progress claim usable if its stills or clips
 * are re-encoded in place during a development session.
 */
export function resolveAvailableFootagePath(
  footageRoot: string,
  file: string,
  kind: FootageKind,
): string {
  const exactPath = resolveFootagePath(footageRoot, file);
  if (fs.existsSync(exactPath)) return exactPath;

  const extension = path.extname(file);
  if (!extension) return exactPath;

  const stem = file.slice(0, -extension.length);
  const alternatives = kind === "image" ? IMAGE_EXTENSIONS : VIDEO_EXTENSIONS;
  for (const alternative of alternatives) {
    if (alternative === extension.toLowerCase()) continue;
    const candidate = resolveFootagePath(footageRoot, `${stem}${alternative}`);
    if (fs.existsSync(candidate)) return candidate;
  }

  return exactPath;
}
