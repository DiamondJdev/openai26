import fs from "node:fs";
import type { DataPaths } from "@/lib/config/paths";

function removeFile(filePath: string): void {
  fs.rmSync(filePath, { force: true });
}

function removeDir(dirPath: string): void {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

/** Create the empty artifact directories if they do not already exist. */
export function ensureDataDirs(paths: DataPaths): void {
  for (const dir of [paths.root, paths.uploads, paths.frames, paths.crops]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Purge all demo data so no claim data survives a session: the SQLite file and
 * its WAL/SHM sidecars, plus every extracted frame, crop, and upload. Recreates
 * empty directories afterward. Idempotent and safe to call at startup or reset.
 */
export function purgeData(paths: DataPaths): void {
  removeFile(paths.db);
  removeFile(`${paths.db}-wal`);
  removeFile(`${paths.db}-shm`);
  removeDir(paths.uploads);
  removeDir(paths.frames);
  removeDir(paths.crops);
  ensureDataDirs(paths);
}
