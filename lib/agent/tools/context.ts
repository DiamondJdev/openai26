import type { Database } from "@/lib/db/connection";
import type { ArtifactStore } from "@/lib/storage/artifacts";
import type { Claim, InvestigationEvent, Visit } from "@/lib/domain/models";
import type { DamageRegion } from "@/lib/domain/regions";
import type { NormalizedBBox } from "@/lib/domain/geometry";
import type { VehicleType } from "@/lib/domain/vehicle";

/** Trusted, model-safe claim context. The manager note travels as DATA only. */
export interface ClaimVisionContext {
  readonly vehicleType: VehicleType;
  readonly selectedRegions: readonly DamageRegion[];
  /** Untrusted manager note — provided as data, never as instructions. */
  readonly managerNote: string;
}

export interface VisionAnalysis {
  readonly description: string;
  readonly damageObserved: boolean;
  readonly obscured: boolean;
  readonly matchesVehicle: boolean | null;
  readonly region: DamageRegion | null;
  readonly bbox: NormalizedBBox | null;
}

export interface VisionComparison {
  readonly description: string;
  readonly newDamage: boolean;
  readonly obscured: boolean;
  readonly region: DamageRegion | null;
  readonly bbox: NormalizedBBox | null;
}

/**
 * The vision adapter. In production this calls GPT-5.6 vision; in tests it is a
 * deterministic fake. Customer uploads are NEVER passed here — only extracted
 * evidence frames scoped to the current claim.
 */
export interface VisionPort {
  analyzeFrame(input: {
    imagePath: string;
    question: string;
    claim: ClaimVisionContext;
  }): Promise<VisionAnalysis>;
  compareFrames(input: {
    imagePathA: string;
    imagePathB: string;
    question: string;
    claim: ClaimVisionContext;
  }): Promise<VisionComparison>;
}

/**
 * Everything a tool call is allowed to touch, scoped to a single claim. There is
 * no ambient access to other claims, arbitrary files, or cameras beyond the
 * current visit's sources.
 */
export interface ToolContext {
  readonly db: Database;
  readonly artifacts: ArtifactStore;
  readonly claim: Claim;
  readonly visit: Visit;
  readonly footageRoot: string;
  readonly vision: VisionPort;
  /**
   * Vision localizations captured during analyze/compare, keyed by frameId. Used
   * to attach trusted bbox coordinates to findings — the model never supplies
   * geometry directly.
   */
  readonly localizations: Map<string, { region: DamageRegion | null; bbox: NormalizedBBox | null }>;
  /** Optional streaming sink; every appended event is forwarded here. */
  readonly onEvent?: (event: InvestigationEvent) => void;
}

export function claimVisionContext(claim: Claim): ClaimVisionContext {
  return {
    vehicleType: claim.vehicleType,
    selectedRegions: claim.selectedRegions,
    managerNote: claim.managerNote,
  };
}
