import "server-only";
import { randomBytes } from "node:crypto";
import type { Database } from "@/lib/db/connection";
import { createNeonDatabase } from "@/lib/db/connection";
import { getEnv, type AppEnv } from "@/lib/config/env";
import { applyMigrations } from "@/lib/db/migrations";
import { loadManifest, seedFromManifest } from "@/lib/footage/manifest";
import { PrivateBlobArtifactStore, type ArtifactStore } from "@/lib/storage/artifacts";

export interface AppContext {
  readonly db: Database;
  readonly artifacts: ArtifactStore;
  readonly footageRoot: string;
  readonly env: AppEnv;
  /** Per-process secret for signing customer session cookies. */
  readonly sessionSecret: string;
  readonly manifestLoaded: boolean;
}

// Cache the full asynchronous bootstrap across Next.js HMR reloads.
const GLOBAL_KEY = "__claimlens_ctx__";
type GlobalWithCtx = typeof globalThis & { [GLOBAL_KEY]?: Promise<AppContext> };

async function initialize(): Promise<AppContext> {
  const env = getEnv();
  if (!env.databaseUrl.trim()) {
    throw new Error("DATABASE_URL is required to initialize ClaimLens");
  }

  const db = createNeonDatabase(env.databaseUrl);
  await applyMigrations(db);
  const artifacts = new PrivateBlobArtifactStore();
  let manifest: ReturnType<typeof loadManifest>["manifest"];
  let footageRoot: string;
  try {
    const loaded = loadManifest(env.manifestPath);
    manifest = loaded.manifest;
    const { footageRoot: fr } = loaded;
    footageRoot = fr;
  } catch {
    // Manifest/footage may not be present yet (added later). The app still boots;
    // plate lookups simply return no visits until footage is seeded.
    return {
      db,
      artifacts,
      footageRoot: "",
      env,
      sessionSecret: randomBytes(32).toString("hex"),
      manifestLoaded: false,
    };
  }

  const visits = await db.query<{ count: number | string }>(
    "SELECT COUNT(*) AS count FROM visits",
  );
  if (Number(visits[0]?.count ?? 0) === 0) {
    await seedFromManifest(db, manifest);
  }

  return {
    db,
    artifacts,
    footageRoot,
    env,
    sessionSecret: randomBytes(32).toString("hex"),
    manifestLoaded: true,
  };
}

/** The process-wide application context (lazy, initialized once). */
export function getAppContext(): Promise<AppContext> {
  const g = globalThis as GlobalWithCtx;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = initialize();
  }
  return g[GLOBAL_KEY];
}
