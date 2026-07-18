import path from "node:path";

export interface DataPaths {
  readonly root: string;
  readonly db: string;
  readonly uploads: string;
  readonly frames: string;
  readonly crops: string;
}

/**
 * Resolve the on-disk layout for a given data directory. Tests pass a temp dir;
 * the app passes the configured CLAIMLENS_DATA_DIR. All runtime data lives under
 * `root` so cleanup can purge a single tree.
 */
export function resolveDataPaths(dataDir: string, dbPath?: string): DataPaths {
  const root = path.resolve(dataDir);
  return {
    root,
    db: dbPath && dbPath.trim() !== "" ? path.resolve(dbPath) : path.join(root, "claimlens.sqlite"),
    uploads: path.join(root, "uploads"),
    frames: path.join(root, "frames"),
    crops: path.join(root, "crops"),
  };
}
