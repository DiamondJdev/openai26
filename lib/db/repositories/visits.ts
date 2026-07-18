import type { DB } from "../connection";
import type { Visit } from "@/lib/domain/models";
import type { VehicleType } from "@/lib/domain/vehicle";
import type { FootageSources } from "@/lib/footage/types";
import { newId } from "@/lib/util/id";

interface VisitRow {
  id: string;
  plate_normalized: string;
  plate_display: string;
  vehicle_type: string;
  occurred_at: string;
  sources: string;
}

function mapRow(row: VisitRow): Visit {
  return {
    id: row.id,
    plateNormalized: row.plate_normalized,
    plateDisplay: row.plate_display,
    vehicleType: row.vehicle_type as VehicleType,
    occurredAt: row.occurred_at,
    sources: JSON.parse(row.sources) as FootageSources,
  };
}

export interface NewVisit {
  readonly plateNormalized: string;
  readonly plateDisplay: string;
  readonly vehicleType: VehicleType;
  readonly occurredAt: string;
  readonly sources?: FootageSources;
}

export function insertVisit(db: DB, input: NewVisit): Visit {
  const visit: Visit = {
    id: newId("visit"),
    plateNormalized: input.plateNormalized,
    plateDisplay: input.plateDisplay,
    vehicleType: input.vehicleType,
    occurredAt: input.occurredAt,
    sources: input.sources ?? {},
  };
  db.prepare(
    `INSERT INTO visits (id, plate_normalized, plate_display, vehicle_type, occurred_at, sources)
     VALUES (@id, @plateNormalized, @plateDisplay, @vehicleType, @occurredAt, @sources)`,
  ).run({
    id: visit.id,
    plateNormalized: visit.plateNormalized,
    plateDisplay: visit.plateDisplay,
    vehicleType: visit.vehicleType,
    occurredAt: visit.occurredAt,
    sources: JSON.stringify(visit.sources),
  });
  return visit;
}

export function getVisitById(db: DB, id: string): Visit | null {
  const row = db.prepare("SELECT * FROM visits WHERE id = ?").get(id) as
    | VisitRow
    | undefined;
  return row ? mapRow(row) : null;
}

/**
 * Select the most recent visit for a normalized plate. Returns null when no
 * visit matches — the manager cannot create a customer link without one.
 */
export function findLatestVisitByPlate(
  db: DB,
  plateNormalized: string,
): Visit | null {
  const row = db
    .prepare(
      `SELECT * FROM visits WHERE plate_normalized = ?
       ORDER BY occurred_at DESC, id DESC LIMIT 1`,
    )
    .get(plateNormalized) as VisitRow | undefined;
  return row ? mapRow(row) : null;
}
