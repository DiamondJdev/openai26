import { getEnv } from "@/lib/config/env";
import { resolveDataPaths } from "@/lib/config/paths";
import { purgeData } from "@/lib/cleanup/purge";
import { openDatabase } from "@/lib/db/connection";
import { loadManifest, seedFromManifest } from "@/lib/footage/manifest";

// Reset data and seed the visit index from the footage manifest.
// Run with `npm run seed`.
const env = getEnv();
const paths = resolveDataPaths(env.dataDir, env.dbPath);
purgeData(paths);
const db = openDatabase(paths.db);

try {
  const { manifest, footageRoot } = loadManifest(env.manifestPath);
  const count = seedFromManifest(db, manifest);
  process.stdout.write(
    `Seeded ${count} visit(s) from ${env.manifestPath} (footage root: ${footageRoot})\n`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Could not seed manifest: ${message}\n`);
  process.exitCode = 1;
} finally {
  db.close();
}
