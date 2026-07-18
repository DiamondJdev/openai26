import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Database } from "@/lib/db/connection";
import { CAMERA_IDS } from "@/lib/domain/cameras";
import { VEHICLE_TYPES } from "@/lib/domain/vehicle";
import { normalizePlate } from "@/lib/domain/plate";
import { ValidationError } from "@/lib/domain/errors";
import { FOOTAGE_KINDS, inferKind, type FootageSources } from "./types";

const cameraSourceSchema = z.object({
  file: z.string().min(1),
  kind: z.enum(FOOTAGE_KINDS).optional(),
  durationMs: z.number().int().positive().optional(),
});

const manifestVisitSchema = z.object({
  plate: z.string().min(1),
  vehicleType: z.enum(VEHICLE_TYPES),
  occurredAt: z.string().min(1),
  sources: z.record(z.enum(CAMERA_IDS), cameraSourceSchema),
});

const manifestSchema = z.object({
  footageRoot: z.string().optional(),
  visits: z.array(manifestVisitSchema),
});

export type ManifestVisit = z.infer<typeof manifestVisitSchema>;
export type FootageManifest = z.infer<typeof manifestSchema>;

export interface LoadedManifest {
  readonly manifest: FootageManifest;
  /** Absolute directory every footage file must resolve inside. */
  readonly footageRoot: string;
}

/** Read, parse, and validate a footage manifest from disk. */
export function loadManifest(manifestPath: string): LoadedManifest {
  const abs = path.resolve(manifestPath);
  let raw: string;
  try {
    raw = fs.readFileSync(abs, "utf8");
  } catch {
    throw new ValidationError(`Footage manifest not found: ${abs}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ValidationError("Footage manifest is not valid JSON");
  }
  const parsed = manifestSchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError(
      `Footage manifest failed validation: ${parsed.error.message}`,
    );
  }
  const manifestDir = path.dirname(abs);
  const footageRoot = parsed.data.footageRoot
    ? path.resolve(manifestDir, parsed.data.footageRoot)
    : manifestDir;
  return { manifest: parsed.data, footageRoot };
}

function toSources(visit: ManifestVisit): FootageSources {
  const sources: FootageSources = {};
  for (const camera of CAMERA_IDS) {
    const src = visit.sources[camera];
    if (!src) continue;
    sources[camera] = {
      file: src.file,
      kind: src.kind ?? inferKind(src.file),
      ...(src.durationMs !== undefined ? { durationMs: src.durationMs } : {}),
    };
  }
  return sources;
}

function seedVisitId(visit: ManifestVisit, sources: FootageSources): string {
  const identity = JSON.stringify({
    plateNormalized: normalizePlate(visit.plate),
    plateDisplay: visit.plate,
    vehicleType: visit.vehicleType,
    occurredAt: visit.occurredAt,
    sources,
  });
  return `visit_seed_${createHash("sha256").update(identity).digest("hex")}`;
}

export async function seedFromManifest(
  db: Database,
  manifest: FootageManifest,
): Promise<number> {
  let count = 0;
  for (const visit of manifest.visits) {
    const sources = toSources(visit);
    const id = seedVisitId(visit, sources);
    const inserted = await db.query<{ id: string }>(
      `INSERT INTO visits (id, plate_normalized, plate_display, vehicle_type, occurred_at, sources)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [
        id,
        normalizePlate(visit.plate),
        visit.plate,
        visit.vehicleType,
        visit.occurredAt,
        JSON.stringify(sources),
      ],
    );
    count += inserted.length;
  }
  return count;
}
