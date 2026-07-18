import type { Database } from "@/lib/db/connection";
import { createTestDatabase } from "@/lib/db/connection";
import { applyMigrations } from "@/lib/db/migrations";
import { insertVisit } from "@/lib/db/repositories/visits";
import { insertClaim } from "@/lib/db/repositories/claims";
import type { Claim, Visit } from "@/lib/domain/models";

/** A fresh migrated in-memory Postgres database for a single test. */
export async function testDb(): Promise<Database> {
  const db = await createTestDatabase();
  await applyMigrations(db);
  return db;
}

/** Seed one visit + one draft claim and return both, for reuse across tests. */
export async function seedClaim(
  db: Database,
  overrides: Partial<{ plateNormalized: string; note: string }> = {},
): Promise<{ visit: Visit; claim: Claim }> {
  const visit = await insertVisit(db, {
    plateNormalized: overrides.plateNormalized ?? "ABC123",
    plateDisplay: "ABC-123",
    vehicleType: "car",
    occurredAt: "2026-07-18T10:32:00.000Z",
  });
  const claim = await insertClaim(db, {
    visitId: visit.id,
    vehicleType: "car",
    selectedRegions: ["rear_bumper"],
    managerNote: overrides.note ?? "Customer says rear bumper scratched.",
  });
  return { visit, claim };
}
