import type { DB } from "@/lib/db/connection";
import { openMemoryDatabase } from "@/lib/db/connection";
import { insertVisit } from "@/lib/db/repositories/visits";
import { insertClaim } from "@/lib/db/repositories/claims";
import type { Claim, Visit } from "@/lib/domain/models";

/** A fresh in-memory database for a single test. */
export function testDb(): DB {
  return openMemoryDatabase();
}

/** Seed one visit + one draft claim and return both, for reuse across tests. */
export function seedClaim(
  db: DB,
  overrides: Partial<{ plateNormalized: string; note: string }> = {},
): { visit: Visit; claim: Claim } {
  const visit = insertVisit(db, {
    plateNormalized: overrides.plateNormalized ?? "ABC123",
    plateDisplay: "ABC-123",
    vehicleType: "car",
    occurredAt: "2026-07-18T10:32:00.000Z",
  });
  const claim = insertClaim(db, {
    visitId: visit.id,
    vehicleType: "car",
    selectedRegions: ["rear_bumper"],
    managerNote: overrides.note ?? "Customer says rear bumper scratched.",
  });
  return { visit, claim };
}
