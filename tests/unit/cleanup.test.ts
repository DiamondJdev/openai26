import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveDataPaths } from "@/lib/config/paths";
import { ensureDataDirs, purgeData } from "@/lib/cleanup/purge";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "claimlens-purge-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("purgeData", () => {
  it("removes the db, sidecars, and all artifact directories then recreates empty dirs", () => {
    const paths = resolveDataPaths(tmp);
    ensureDataDirs(paths);

    fs.writeFileSync(paths.db, "db");
    fs.writeFileSync(`${paths.db}-wal`, "wal");
    fs.writeFileSync(`${paths.db}-shm`, "shm");
    fs.writeFileSync(path.join(paths.uploads, "u.jpg"), "x");
    fs.writeFileSync(path.join(paths.frames, "f.jpg"), "x");
    fs.writeFileSync(path.join(paths.crops, "c.jpg"), "x");

    purgeData(paths);

    expect(fs.existsSync(paths.db)).toBe(false);
    expect(fs.existsSync(`${paths.db}-wal`)).toBe(false);
    expect(fs.existsSync(`${paths.db}-shm`)).toBe(false);
    expect(fs.readdirSync(paths.uploads)).toEqual([]);
    expect(fs.readdirSync(paths.frames)).toEqual([]);
    expect(fs.readdirSync(paths.crops)).toEqual([]);
  });

  it("is idempotent and safe when nothing exists yet", () => {
    const paths = resolveDataPaths(path.join(tmp, "nested", "data"));
    expect(() => purgeData(paths)).not.toThrow();
    expect(() => purgeData(paths)).not.toThrow();
    expect(fs.existsSync(paths.uploads)).toBe(true);
  });

  it("purges a db path located outside the data root", () => {
    const externalDb = path.join(tmp, "external.sqlite");
    const paths = resolveDataPaths(path.join(tmp, "data"), externalDb);
    ensureDataDirs(paths);
    fs.writeFileSync(externalDb, "db");
    purgeData(paths);
    expect(fs.existsSync(externalDb)).toBe(false);
  });
});
