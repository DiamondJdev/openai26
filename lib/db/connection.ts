import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "./schema";

export type DB = Database.Database;

function applyPragmasAndSchema(db: DB): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA_SQL);
}

/** Open (creating parent dirs as needed) a file-backed database. */
export function openDatabase(dbPath: string): DB {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  applyPragmasAndSchema(db);
  return db;
}

/** Open an in-memory database. Used by tests for isolation and speed. */
export function openMemoryDatabase(): DB {
  const db = new Database(":memory:");
  applyPragmasAndSchema(db);
  return db;
}
