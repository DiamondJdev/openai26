import { getEnv } from "@/lib/config/env";
import { resolveDataPaths } from "@/lib/config/paths";
import { purgeData } from "@/lib/cleanup/purge";

// Wipe all demo data (db, frames, crops, uploads). Run with `npm run reset`.
const env = getEnv();
const paths = resolveDataPaths(env.dataDir, env.dbPath);
purgeData(paths);
process.stdout.write(`Purged ClaimLens data under ${paths.root}\n`);
