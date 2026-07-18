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

/** ClaimLens tables in FK-safe order for a full operator reset. */
export const CLAIMLENS_RESET_TABLES = [
  "reports",
  "investigation_events",
  "findings",
  "evidence_crops",
  "evidence_frames",
  "uploads",
  "customer_submissions",
  "customer_access",
  "claims",
  "visits",
] as const;

/** Postgres-only reset used by the operator command and hosted demo reset. */
export const CLAIMLENS_RESET_SQL = `TRUNCATE TABLE ${CLAIMLENS_RESET_TABLES.join(
  ", ",
)} RESTART IDENTITY CASCADE`;

function isDuplicateSchemaObject(error: unknown): boolean {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined;
  const message = error instanceof Error ? error.message : "";
  return (
    code === "42P07" ||
    code === "42710" ||
    /(?:relation|index).*already exists|duplicate (?:table|index|object)/i.test(
      message,
    )
  );
}

async function createSchemaObject(db: Database, statement: string): Promise<void> {
  try {
    await db.query(statement);
  } catch (error) {
    if (!isDuplicateSchemaObject(error)) throw error;
  }
}

/** Apply every unapplied ClaimLens Postgres migration in version order. */
export async function applyMigrations(db: Database): Promise<void> {
  await createSchemaObject(
    db,
    `CREATE TABLE schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )`,
  );

  const applied = await db.query<{ version: string }>(
    "SELECT version FROM schema_migrations",
  );
  const appliedVersions = new Set(applied.map((migration) => migration.version));

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue;

    for (const statement of migration.statements) {
      await createSchemaObject(db, statement);
    }
    await db.query(
      `INSERT INTO schema_migrations (version, applied_at) VALUES ($1, $2)
       ON CONFLICT (version) DO NOTHING`,
      [migration.version, new Date().toISOString()],
    );
  }
}

/** Remove all ClaimLens domain data for an explicit operator reset. */
export async function resetClaimLensDatabase(db: Database): Promise<void> {
  await applyMigrations(db);
  await db.query(CLAIMLENS_RESET_SQL);
}
