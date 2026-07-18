import "server-only";
import type { AppContext } from "@/lib/runtime/context";
import { CLAIMLENS_RESET_SQL } from "@/lib/db/migrations";
import { loadManifest, seedFromManifest } from "@/lib/footage/manifest";

export interface DemoResetResult {
  readonly seededVisits: number;
  readonly deletedArtifacts: number;
}

/** Restore the hosted demo to its manifest-seeded, artifact-free state. */
export async function resetDemo(ctx: AppContext): Promise<DemoResetResult> {
  const deletedArtifacts = await ctx.artifacts.deletePrefix("claimlens/");
  await ctx.db.query(CLAIMLENS_RESET_SQL);
  const loaded = loadManifest(ctx.env.manifestPath);
  const seededVisits = await seedFromManifest(ctx.db, loaded.manifest);
  return { seededVisits, deletedArtifacts };
}
