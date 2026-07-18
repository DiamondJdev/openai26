import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import type { DB } from "@/lib/db/connection";
import { openMemoryDatabase } from "@/lib/db/connection";
import { insertVisit } from "@/lib/db/repositories/visits";
import { insertClaim, getClaimByIdOrThrow } from "@/lib/db/repositories/claims";
import type { Claim, Visit } from "@/lib/domain/models";
import type {
  ToolContext,
  VisionAnalysis,
  VisionComparison,
  VisionPort,
} from "@/lib/agent/tools/context";

/** Deterministic vision fake with per-call programmable responses. */
export class FakeVision implements VisionPort {
  analyzeResponses: Partial<VisionAnalysis>[] = [];
  compareResponses: Partial<VisionComparison>[] = [];
  analyzeCalls = 0;
  compareCalls = 0;

  async analyzeFrame(): Promise<VisionAnalysis> {
    const override = this.analyzeResponses[this.analyzeCalls] ?? {};
    this.analyzeCalls += 1;
    return {
      description: "frame analyzed",
      damageObserved: false,
      obscured: false,
      matchesVehicle: true,
      region: null,
      bbox: null,
      ...override,
    };
  }

  async compareFrames(): Promise<VisionComparison> {
    const override = this.compareResponses[this.compareCalls] ?? {};
    this.compareCalls += 1;
    return {
      description: "frames compared",
      newDamage: false,
      obscured: false,
      region: null,
      bbox: null,
      ...override,
    };
  }
}

export interface ToolHarness {
  readonly db: DB;
  readonly ctx: ToolContext;
  readonly vision: FakeVision;
  readonly claim: Claim;
  readonly visit: Visit;
  readonly tmp: string;
  refreshClaim(): void;
  cleanup(): void;
}

async function writePng(file: string, background: string): Promise<void> {
  await sharp({
    create: { width: 320, height: 240, channels: 3, background },
  })
    .png()
    .toFile(file);
}

/** Build a fully scoped ToolContext backed by real on-disk image footage. */
export async function buildToolHarness(): Promise<ToolHarness> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "claimlens-tools-"));
  const footageRoot = path.join(tmp, "footage");
  const framesDir = path.join(tmp, "frames");
  const cropsDir = path.join(tmp, "crops");
  fs.mkdirSync(path.join(footageRoot, "v"), { recursive: true });

  await writePng(path.join(footageRoot, "v", "entrance.png"), "#1133aa");
  await writePng(path.join(footageRoot, "v", "mid.png"), "#33aa11");
  await writePng(path.join(footageRoot, "v", "exit.png"), "#aa1133");

  const db = openMemoryDatabase();
  const visit = insertVisit(db, {
    plateNormalized: "7GAB991",
    plateDisplay: "7GAB-991",
    vehicleType: "car",
    occurredAt: "2026-07-18T10:32:00.000Z",
    sources: {
      entrance: { file: "v/entrance.png", kind: "image" },
      mid_tunnel: { file: "v/mid.png", kind: "image" },
      exit: { file: "v/exit.png", kind: "image" },
    },
  });
  const created = insertClaim(db, {
    visitId: visit.id,
    vehicleType: "car",
    selectedRegions: ["rear_bumper"],
    managerNote: "Customer says rear bumper scratched.",
  });

  const vision = new FakeVision();
  let claim = created;
  const ctx: ToolContext = {
    db,
    get claim() {
      return claim;
    },
    visit,
    footageRoot,
    framesDir,
    cropsDir,
    vision,
    localizations: new Map(),
  };

  return {
    db,
    ctx,
    vision,
    claim: created,
    visit,
    tmp,
    refreshClaim() {
      claim = getClaimByIdOrThrow(db, created.id);
    },
    cleanup() {
      db.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    },
  };
}
