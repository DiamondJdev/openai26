import { createTestDatabase } from "@/lib/db/connection";
import { applyMigrations } from "@/lib/db/migrations";
import { seedFromManifest, type FootageManifest } from "@/lib/footage/manifest";
import { describe, expect, it } from "vitest";

describe("ClaimLens migrations", () => {
  it("creates ClaimLens tables only once", async () => {
    const db = await createTestDatabase();
    await applyMigrations(db);
    await applyMigrations(db);
    await db.query(
      "INSERT INTO visits (id, plate_normalized, plate_display, vehicle_type, occurred_at, sources) VALUES ($1, $2, $3, $4, $5, $6)",
      [
        "visit_test",
        "TEST123",
        "TEST-123",
        "car",
        "2026-07-18T10:00:00.000Z",
        "{}",
      ],
    );
    expect(await db.query("SELECT id FROM visits")).toEqual([
      { id: "visit_test" },
    ]);
    await db.close();
  });

  it("seeds a manifest only once", async () => {
    const db = await createTestDatabase();
    const manifest: FootageManifest = {
      visits: [
        {
          plate: "TEST-123",
          vehicleType: "car",
          occurredAt: "2026-07-18T10:00:00.000Z",
          sources: {},
        },
      ],
    };
    await applyMigrations(db);

    expect(await seedFromManifest(db, manifest)).toBe(1);
    expect(await seedFromManifest(db, manifest)).toBe(0);
    expect(await db.query("SELECT id FROM visits")).toHaveLength(1);

    await db.close();
  });
});
