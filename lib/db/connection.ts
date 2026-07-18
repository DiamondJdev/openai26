import { neon } from "@neondatabase/serverless";
import { DataType, newDb } from "pg-mem";

type DatabaseParameter = string | number | boolean | null;

/** Shared asynchronous persistence boundary for production and tests. */
export interface Database {
  query<T = Record<string, unknown>>(
    text: string,
    parameters?: readonly DatabaseParameter[],
  ): Promise<T[]>;
  close(): Promise<void>;
}

/** Adapt Neon HTTP queries to the application's database port. */
export function createNeonDatabase(connectionString: string): Database {
  const sql = neon(connectionString);

  return {
    async query<T = Record<string, unknown>>(
      text: string,
      parameters: readonly DatabaseParameter[] = [],
    ): Promise<T[]> {
      return await sql.query(text, [...parameters]) as T[];
    },
    async close() {},
  };
}

/** Create an isolated in-memory Postgres database for adapter and future repository tests. */
export async function createTestDatabase(): Promise<Database> {
  const memory = newDb();
  memory.public.registerFunction({
    name: "hashtext",
    args: [DataType.text],
    returns: DataType.integer,
    implementation: (value: string) => {
      let hash = 0;
      for (let index = 0; index < value.length; index += 1) {
        hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
      }
      return hash;
    },
  });
  memory.public.registerFunction({
    name: "pg_advisory_xact_lock",
    args: [DataType.integer],
    returns: DataType.bool,
    implementation: () => true,
  });
  const { Pool } = memory.adapters.createPg();
  const pool = new Pool();
  let eventQueue: Promise<void> = Promise.resolve();

  async function queryEventCte(
    parameters: readonly DatabaseParameter[],
  ): Promise<Record<string, unknown>[]> {
    const [claimId, id, type, plainLanguage, detail, createdAt] = parameters;
    if (
      typeof claimId !== "string" ||
      typeof id !== "string" ||
      typeof type !== "string" ||
      typeof plainLanguage !== "string" ||
      typeof createdAt !== "string"
    ) {
      throw new Error("Invalid event CTE parameters");
    }
    const next = await pool.query(
      "SELECT COALESCE(MAX(seq), -1) + 1 AS seq FROM investigation_events WHERE claim_id = $1",
      [claimId],
    );
    const result = await pool.query(
      `INSERT INTO investigation_events (id, claim_id, seq, type, plain_language, detail, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, claimId, Number(next.rows[0]?.seq ?? 0), type, plainLanguage, detail, createdAt],
    );
    return result.rows as Record<string, unknown>[];
  }

  return {
    async query<T = Record<string, unknown>>(
      text: string,
      parameters: readonly DatabaseParameter[] = [],
    ): Promise<T[]> {
      // pg-mem cannot execute a data-modifying CTE. Serialize the equivalent
      // operation only in this test adapter; Neon executes the repository's
      // advisory-lock CTE unchanged in production.
      if (/^\s*WITH locked AS/i.test(text)) {
        let release!: () => void;
        const current = new Promise<void>((resolve) => {
          release = resolve;
        });
        const previous = eventQueue;
        eventQueue = current;
        await previous;
        try {
          return (await queryEventCte(parameters)) as T[];
        } finally {
          release();
        }
      }
      const result = await pool.query(text, [...parameters]);
      return result.rows as T[];
    },
    async close() {
      await pool.end();
    },
  };
}
