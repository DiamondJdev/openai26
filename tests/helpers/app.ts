import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import type { AppContext } from "@/lib/runtime/context";
import { openMemoryDatabase } from "@/lib/db/connection";
import { resolveDataPaths } from "@/lib/config/paths";
import { ensureDataDirs } from "@/lib/cleanup/purge";
import { insertVisit } from "@/lib/db/repositories/visits";

export interface AppHarness {
  readonly ctx: AppContext;
  readonly tmp: string;
  cleanup(): void;
}

async function writePng(file: string, background: string): Promise<void> {
  await sharp({ create: { width: 320, height: 240, channels: 3, background } })
    .png()
    .toFile(file);
}

/** Build a self-contained AppContext with seeded footage for service-level tests. */
export async function buildAppHarness(
  plate = "TEST-123",
): Promise<AppHarness> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "claimlens-app-"));
  const footageRoot = path.join(tmp, "footage");
  fs.mkdirSync(path.join(footageRoot, "v"), { recursive: true });
  await writePng(path.join(footageRoot, "v", "entrance.png"), "#123456");
  await writePng(path.join(footageRoot, "v", "mid.png"), "#345612");
  await writePng(path.join(footageRoot, "v", "exit.png"), "#561234");

  const paths = resolveDataPaths(path.join(tmp, "data"));
  ensureDataDirs(paths);
  const db = openMemoryDatabase();

  insertVisit(db, {
    plateNormalized: plate.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    plateDisplay: plate,
    vehicleType: "car",
    occurredAt: "2026-07-18T10:32:00.000Z",
    sources: {
      entrance: { file: "v/entrance.png", kind: "image" },
      mid_tunnel: { file: "v/mid.png", kind: "image" },
      exit: { file: "v/exit.png", kind: "image" },
    },
  });

  const ctx: AppContext = {
    db,
    paths,
    footageRoot,
    sessionSecret: "test-secret-please-change",
    manifestLoaded: true,
    env: {
      openAiApiKey: "",
      model: "gpt-5.6",
      publicBaseUrl: "http://localhost:3000",
      databaseUrl: "",
      dataDir: paths.root,
      dbPath: paths.db,
      manifestPath: "",
      maxInvestigationMs: 45_000,
    },
  };

  return {
    ctx,
    tmp,
    cleanup() {
      db.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    },
  };
}

/** A valid small JPEG buffer for intake upload tests. */
export async function jpegBuffer(): Promise<Buffer> {
  return sharp({ create: { width: 200, height: 150, channels: 3, background: "#999" } })
    .jpeg()
    .toBuffer();
}
