import { getEnv } from "@/lib/config/env";
import { createNeonDatabase } from "@/lib/db/connection";
import { applyMigrations } from "@/lib/db/migrations";

// The historical reset command now safely applies schema migrations only.
async function main(): Promise<void> {
  const env = getEnv();
  if (!env.databaseUrl.trim()) throw new Error("DATABASE_URL is required");
  const db = createNeonDatabase(env.databaseUrl);
  try {
    await applyMigrations(db);
    process.stdout.write("ClaimLens schema is ready; no production data was removed.\n");
  } finally {
    await db.close();
  }
}

await main();
