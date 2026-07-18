import type { Database } from "../connection";
import type { Visit } from "@/lib/domain/models";
import type { VehicleType } from "@/lib/domain/vehicle";
import type { FootageSources } from "@/lib/footage/types";
import { newId } from "@/lib/util/id";

interface VisitRow { id: string; plate_normalized: string; plate_display: string; vehicle_type: string; occurred_at: string; sources: string; }
function mapRow(row: VisitRow): Visit { return { id: row.id, plateNormalized: row.plate_normalized, plateDisplay: row.plate_display, vehicleType: row.vehicle_type as VehicleType, occurredAt: row.occurred_at, sources: JSON.parse(row.sources) as FootageSources }; }
export interface NewVisit { readonly plateNormalized: string; readonly plateDisplay: string; readonly vehicleType: VehicleType; readonly occurredAt: string; readonly sources?: FootageSources; }
export async function insertVisit(db: Database, input: NewVisit): Promise<Visit> {
  const rows = await db.query<VisitRow>(
    `INSERT INTO visits (id, plate_normalized, plate_display, vehicle_type, occurred_at, sources)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [newId("visit"), input.plateNormalized, input.plateDisplay, input.vehicleType, input.occurredAt, JSON.stringify(input.sources ?? {})],
  );
  if (!rows[0]) throw new Error("Visit was not created");
  return mapRow(rows[0]);
}
export async function getVisitById(db: Database, id: string): Promise<Visit | null> { const rows = await db.query<VisitRow>("SELECT * FROM visits WHERE id = $1", [id]); return rows[0] ? mapRow(rows[0]) : null; }
/** Select the most recent visit for a normalized plate. */
export async function findLatestVisitByPlate(db: Database, plateNormalized: string): Promise<Visit | null> { const rows = await db.query<VisitRow>("SELECT * FROM visits WHERE plate_normalized = $1 ORDER BY occurred_at DESC, id DESC LIMIT 1", [plateNormalized]); return rows[0] ? mapRow(rows[0]) : null; }
