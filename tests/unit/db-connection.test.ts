import { createTestDatabase } from "@/lib/db/connection";
import { describe, expect, it } from "vitest";

describe("database connection", () => {
  it("executes asynchronous parameterized Postgres queries", async () => {
    const db = await createTestDatabase();
    await db.query("CREATE TABLE probe (value TEXT NOT NULL)");
    await db.query("INSERT INTO probe (value) VALUES ($1)", ["neon-shape"]);

    expect(await db.query("SELECT value FROM probe")).toEqual([
      { value: "neon-shape" },
    ]);

    await db.close();
  });
});
