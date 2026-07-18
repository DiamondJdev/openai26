import "server-only";
import type { AppContext } from "@/lib/runtime/context";
import type { Claim } from "@/lib/domain/models";
import type { DamageRegion } from "@/lib/domain/regions";
import type { VehicleType } from "@/lib/domain/vehicle";
import { isDamageRegion } from "@/lib/domain/regions";
import { isVehicleType } from "@/lib/domain/vehicle";
import { validatePlate } from "@/lib/domain/plate";
import { NotFoundError, ValidationError } from "@/lib/domain/errors";
import { MAX_MANAGER_NOTE_CHARS } from "@/lib/config/constants";
import { sanitizeUntrusted } from "@/lib/agent/prompt";
import { findLatestVisitByPlate } from "@/lib/db/repositories/visits";
import {
  getClaimByIdOrThrow,
  insertClaim,
  setClaimSelection,
} from "@/lib/db/repositories/claims";
import { insertCustomerAccess } from "@/lib/db/repositories/customer-access";
import { generateToken, hashToken } from "@/lib/security/tokens";
import { generatePin, hashPin } from "@/lib/security/pin";

export interface CreateClaimInput {
  readonly plate: string;
  readonly managerNote: string;
}

export interface CreatedClaim {
  readonly claim: Claim;
  /** Private customer link — shown once for manual sharing. */
  readonly url: string;
  /** Plain PIN — shown once, never stored in the clear. */
  readonly pin: string;
}

/**
 * Create a draft claim from a manager-entered plate, selecting the latest visit,
 * and issue a private link token + PIN (only hashes are stored).
 */
export async function createClaim(
  ctx: AppContext,
  input: CreateClaimInput,
): Promise<CreatedClaim> {
  const plate = validatePlate(input.plate);
  if (!plate.ok) throw new ValidationError(plate.error);

  const visit = await findLatestVisitByPlate(ctx.db, plate.normalized);
  if (!visit) {
    throw new NotFoundError("No recent wash visit was found for that plate.");
  }

  const claim = await insertClaim(ctx.db, {
    visitId: visit.id,
    vehicleType: visit.vehicleType,
    selectedRegions: [],
    managerNote: sanitizeUntrusted(input.managerNote, MAX_MANAGER_NOTE_CHARS),
  });

  const token = generateToken();
  const pin = generatePin();
  await insertCustomerAccess(ctx.db, {
    claimId: claim.id,
    tokenHash: hashToken(token),
    pinHash: hashPin(pin),
  });

  const base = ctx.env.publicBaseUrl.replace(/\/$/, "");
  return { claim, url: `${base}/c/${token}`, pin };
}

export interface IntakeSelection {
  readonly vehicleType: VehicleType;
  readonly selectedRegions: readonly DamageRegion[];
}

/** Validate and persist the employee's vehicle-type + damage-region selection. */
export async function setClaimIntake(
  ctx: AppContext,
  claimId: string,
  input: unknown,
): Promise<Claim> {
  const body = (input ?? {}) as {
    vehicleType?: unknown;
    selectedRegions?: unknown;
  };
  if (!isVehicleType(body.vehicleType)) {
    throw new ValidationError("Choose a vehicle type.");
  }
  if (
    !Array.isArray(body.selectedRegions) ||
    body.selectedRegions.length === 0
  ) {
    throw new ValidationError("Select at least one damage area.");
  }
  const regions = body.selectedRegions.filter(isDamageRegion);
  if (regions.length !== body.selectedRegions.length) {
    throw new ValidationError("Unknown damage area selected.");
  }
  // Dedupe while preserving order.
  const unique = [...new Set(regions)] as DamageRegion[];
  const claim = await getClaimByIdOrThrow(ctx.db, claimId);
  // Only editable before the investigation runs, so the report/crops can never
  // diverge from the regions they were generated against.
  if (claim.status !== "customer_submitted") {
    throw new ValidationError(
      "Damage areas can only be set before the investigation runs.",
    );
  }
  return await setClaimSelection(ctx.db, claimId, body.vehicleType, unique);
}
