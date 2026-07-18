import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { DB } from "@/lib/db/connection";
import { CAMERA_IDS } from "@/lib/domain/cameras";
import { VEHICLE_TYPES } from "@/lib/domain/vehicle";
import { insertVisit } from "@/lib/db/repositories/visits";
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

/** Seed the visits table from a validated manifest. Returns count inserted. */
export function seedFromManifest(db: DB, manifest: FootageManifest): number {
  let count = 0;
  for (const visit of manifest.visits) {
    insertVisit(db, {
      plateNormalized: normalizePlate(visit.plate),
      plateDisplay: visit.plate,
      vehicleType: visit.vehicleType,
      occurredAt: visit.occurredAt,
      sources: toSources(visit),
    });
    count += 1;
  }
  return count;
}
