import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import DatabaseDriver from "better-sqlite3";
import { newDb } from "pg-mem";
import { SCHEMA_SQL } from "./schema";

type DatabaseParameter = string | number | boolean | null;

/** Shared asynchronous persistence boundary for production and tests. */
export interface Database {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    parameters?: readonly DatabaseParameter[],
  ): Promise<T[]>;
  close(): Promise<void>;
}

/** Adapt Neon HTTP queries to the application's database port. */
export function createNeonDatabase(connectionString: string): Database {
  const sql = neon(connectionString);

  return {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(
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
  const { Pool } = newDb().adapters.createPg();
  const pool = new Pool();

  return {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      parameters: readonly DatabaseParameter[] = [],
    ): Promise<T[]> {
      const result = await pool.query(text, [...parameters]);
      return result.rows as T[];
    },
    async close() {
      await pool.end();
    },
  };
}

// These synchronous SQLite exports are retained until Task 4 migrates the
// existing repositories and their callers to the new Database port.
export type DB = DatabaseDriver.Database;

function applyPragmasAndSchema(db: DB): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA_SQL);
}

/** Open (creating parent dirs as needed) a legacy file-backed database. */
export function openDatabase(dbPath: string): DB {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseDriver(dbPath);
  applyPragmasAndSchema(db);
  return db;
}

/** Open a legacy in-memory database for pre-migration integration tests. */
export function openMemoryDatabase(): DB {
  const db = new DatabaseDriver(":memory:");
  applyPragmasAndSchema(db);
  return db;
}
