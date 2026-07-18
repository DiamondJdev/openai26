import path from "node:path";

export interface LegacyArtifactPaths {
  readonly root: string;
  readonly uploads: string;
  readonly frames: string;
  readonly crops: string;
}

/**
 * Test-only artifact layout used by the still-synchronous service test harness.
 * Production context initialization no longer reads or writes a local data tree.
 */
export function resolveLegacyArtifactPaths(dataDir: string): LegacyArtifactPaths {
  const root = path.resolve(dataDir);
  return {
    root,
    uploads: path.join(root, "uploads"),
    frames: path.join(root, "frames"),
    crops: path.join(root, "crops"),
  };
}
