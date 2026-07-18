import "server-only";
import { randomBytes } from "node:crypto";
import type { DB } from "@/lib/db/connection";
import { openDatabase } from "@/lib/db/connection";
import { getEnv, type AppEnv } from "@/lib/config/env";
import { resolveDataPaths, type DataPaths } from "@/lib/config/paths";
import { purgeData } from "@/lib/cleanup/purge";
import { loadManifest, seedFromManifest } from "@/lib/footage/manifest";

export interface AppContext {
  readonly db: DB;
  readonly paths: DataPaths;
  readonly footageRoot: string;
  readonly env: AppEnv;
  /** Per-process secret for signing customer session cookies. */
  readonly sessionSecret: string;
  readonly manifestLoaded: boolean;
}

// Cache on globalThis so Next.js HMR does not re-purge mid-session.
const GLOBAL_KEY = "__claimlens_ctx__";
type GlobalWithCtx = typeof globalThis & { [GLOBAL_KEY]?: AppContext };

function initialize(): AppContext {
  const env = getEnv();
  const paths = resolveDataPaths(env.dataDir, env.dbPath);

  // No claim data survives a session: wipe db, frames, uploads, crops on boot.
  purgeData(paths);
  const db = openDatabase(paths.db);

  let footageRoot = paths.root;
  let manifestLoaded = false;
  try {
    const { manifest, footageRoot: fr } = loadManifest(env.manifestPath);
    seedFromManifest(db, manifest);
    footageRoot = fr;
    manifestLoaded = true;
  } catch {
    // Manifest/footage may not be present yet (added later). The app still boots;
    // plate lookups simply return no visits until footage is seeded.
    manifestLoaded = false;
  }

  return {
    db,
    paths,
    footageRoot,
    env,
    sessionSecret: randomBytes(32).toString("hex"),
    manifestLoaded,
  };
}

/** The process-wide application context (lazy, initialized once). */
export function getAppContext(): AppContext {
  const g = globalThis as GlobalWithCtx;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = initialize();
  }
  return g[GLOBAL_KEY];
}
