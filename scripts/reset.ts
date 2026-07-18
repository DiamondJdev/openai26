import { getEnv } from "@/lib/config/env";
import { createNeonDatabase } from "@/lib/db/connection";
import { applyMigrations, resetClaimLensDatabase } from "@/lib/db/migrations";
import { PrivateBlobArtifactStore } from "@/lib/storage/artifacts";

/** Explicitly clear ClaimLens database rows and private artifacts, then recreate schema. */
async function main(): Promise<void> {
  const env = getEnv();
  if (!env.databaseUrl.trim()) throw new Error("DATABASE_URL is required");
  const db = createNeonDatabase(env.databaseUrl);
  try {
    // Recover the schema first so reset is safe even on a fresh deployment.
    await applyMigrations(db);
    await resetClaimLensDatabase(db);
    await new PrivateBlobArtifactStore().deletePrefix("claimlens/");
    process.stdout.write("ClaimLens database and private artifacts were reset.\n");
  } finally {
    await db.close();
  }
}

await main();
