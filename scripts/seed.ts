import { getEnv } from "@/lib/config/env";
import { createNeonDatabase } from "@/lib/db/connection";
import { applyMigrations } from "@/lib/db/migrations";
import { loadManifest, seedFromManifest } from "@/lib/footage/manifest";

/** Seed any manifest visits absent from Neon. Run with `npm run seed`. */
async function main(): Promise<void> {
  const env = getEnv();
  if (!env.databaseUrl.trim()) throw new Error("DATABASE_URL is required");
  const db = createNeonDatabase(env.databaseUrl);

  try {
    await applyMigrations(db);
    const { manifest, footageRoot } = loadManifest(env.manifestPath);
    const count = await seedFromManifest(db, manifest);
    process.stdout.write(
      `Seeded ${count} visit(s) from ${env.manifestPath} (footage root: ${footageRoot})\n`,
    );
  } finally {
    await db.close();
  }
}

await main();
