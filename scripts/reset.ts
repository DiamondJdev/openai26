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
    await resetClaimLensDatabase(db);
    await new PrivateBlobArtifactStore().deletePrefix("claimlens/");
    await applyMigrations(db);
    process.stdout.write("ClaimLens database and private artifacts were reset.\n");
  } finally {
    await db.close();
  }
}

await main();
