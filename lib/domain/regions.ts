import type { VehicleType } from "./vehicle";

/**
 * The eight normalized damage areas. This is the canonical vocabulary shared by
 * the intake SVG selector, the agent tool schemas, and the report. Order matters
 * for stable rendering.
 */
export const DAMAGE_REGIONS = [
  "front_bumper",
  "hood",
  "windshield",
  "roof",
  "driver_side",
  "passenger_side",
  "rear_body",
  "rear_bumper",
] as const;

export type DamageRegion = (typeof DAMAGE_REGIONS)[number];

export interface RegionMeta {
  readonly id: DamageRegion;
  /** Plain-language label shown to employees and customers. */
  readonly label: string;
  /** Longer description used for the rear_body trunk/tailgate distinction. */
  readonly description: string;
}

export const REGION_META: Readonly<Record<DamageRegion, RegionMeta>> = {
  front_bumper: {
    id: "front_bumper",
    label: "Front bumper",
    description: "Front bumper and lower front fascia",
  },
  hood: { id: "hood", label: "Hood", description: "Hood panel" },
  windshield: {
    id: "windshield",
    label: "Windshield",
    description: "Front windshield glass",
  },
  roof: { id: "roof", label: "Roof", description: "Roof panel" },
  driver_side: {
    id: "driver_side",
    label: "Driver side",
    description: "Driver-side doors and panels",
  },
  passenger_side: {
    id: "passenger_side",
    label: "Passenger side",
    description: "Passenger-side doors and panels",
  },
  rear_body: {
    id: "rear_body",
    label: "Rear body",
    description: "Trunk or tailgate and rear glass",
  },
  rear_bumper: {
    id: "rear_bumper",
    label: "Rear bumper",
    description: "Rear bumper and lower rear fascia",
  },
};

export function isDamageRegion(value: unknown): value is DamageRegion {
  return (
    typeof value === "string" &&
    (DAMAGE_REGIONS as readonly string[]).includes(value)
  );
}

/**
 * All eight regions apply to both silhouettes; the parameter is retained so the
 * intake selector and validation can diverge later without a signature change.
 */
export function regionsForVehicle(_vehicle: VehicleType): readonly DamageRegion[] {
  return DAMAGE_REGIONS;
}
