import type { Database } from "./connection";
import { POSTGRES_SCHEMA_STATEMENTS } from "./schema";

interface Migration {
  readonly version: string;
  readonly statements: readonly string[];
}

const MIGRATIONS: readonly Migration[] = [
  {
    version: "001_initial_claimlens_schema",
    statements: POSTGRES_SCHEMA_STATEMENTS,
  },
];

/** Apply every unapplied ClaimLens Postgres migration in version order. */
export async function applyMigrations(db: Database): Promise<void> {
  try {
    await db.query(
      `CREATE TABLE schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )`,
    );
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;
    const message = error instanceof Error ? error.message : "";
    if (code !== "42P07" && !/already exists/i.test(message)) throw error;
  }

  const applied = await db.query<{ version: string }>(
    "SELECT version FROM schema_migrations",
  );
  const appliedVersions = new Set(applied.map((migration) => migration.version));

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue;

    for (const statement of migration.statements) {
      await db.query(statement);
    }
    await db.query(
      "INSERT INTO schema_migrations (version, applied_at) VALUES ($1, $2)",
      [migration.version, new Date().toISOString()],
    );
  }
}
