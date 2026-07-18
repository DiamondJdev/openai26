import type { CameraId } from "./cameras";
import type { ClaimStatus } from "./claim-status";
import type { DamageRegion } from "./regions";
import type { VehicleType } from "./vehicle";
import type { FootageSources } from "@/lib/footage/types";

/**
 * A single wash pass captured by the fixed rig. The visit index is seeded from
 * the footage manifest; a manager's normalized plate lookup selects the latest
 * matching visit before a customer link can be created.
 */
export interface Visit {
  readonly id: string;
  readonly plateNormalized: string;
  readonly plateDisplay: string;
  readonly vehicleType: VehicleType;
  /** ISO-8601 timestamp the vehicle entered the wash. */
  readonly occurredAt: string;
  /** Per-camera footage for this visit, resolved from the seeded manifest. */
  readonly sources: FootageSources;
}

export interface Claim {
  readonly id: string;
  readonly visitId: string;
  readonly status: ClaimStatus;
  readonly vehicleType: VehicleType;
  readonly selectedRegions: readonly DamageRegion[];
  /**
   * Bounded, manager-entered note. Treated as UNTRUSTED DATA when handed to the
   * model — never as instructions.
   */
  readonly managerNote: string;
  readonly reportId: string | null;
  /** Set when the employee releases the report; controls crop visibility. */
  readonly shareEvidenceCrops: boolean;
  readonly releasedAt: string | null;
  /** Reason recorded when the claim is held for manual review. */
  readonly manualReviewReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Auth record gating the customer's private link. Only hashes are stored; raw
 * token and PIN are shown once at creation and never persisted in the clear.
 */
export interface CustomerAccess {
  readonly id: string;
  readonly claimId: string;
  readonly tokenHash: string;
  readonly pinHash: string;
  readonly failedAttempts: number;
  /** ISO timestamp until which PIN attempts are locked out, or null. */
  readonly lockedUntil: string | null;
  readonly createdAt: string;
}

/** The customer's intake profile (uploads are stored as separate Upload rows). */
export interface CustomerSubmission {
  readonly id: string;
  readonly claimId: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly consentAt: string;
  readonly submittedAt: string;
}

export const UPLOAD_KINDS = ["plate", "odometer", "insurance"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export function isUploadKind(value: unknown): value is UploadKind {
  return (
    typeof value === "string" &&
    (UPLOAD_KINDS as readonly string[]).includes(value)
  );
}

/**
 * A validated, re-encoded customer upload. Customer uploads NEVER reach the
 * model and are served only to the correct customer or local employee context.
 */
export interface Upload {
  readonly id: string;
  readonly claimId: string;
  readonly kind: UploadKind;
  readonly storedPath: string;
  readonly mime: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly sha256: string;
  readonly createdAt: string;
}

/** A single still frame extracted from one camera clip, scoped to a claim. */
export interface EvidenceFrame {
  readonly id: string;
  readonly claimId: string;
  readonly camera: CameraId;
  readonly timestampMs: number;
  readonly storedPath: string;
  readonly createdAt: string;
}

/** A focused, timestamped crop of one region, generated from an evidence frame. */
export interface EvidenceCrop {
  readonly id: string;
  readonly claimId: string;
  readonly frameId: string;
  readonly camera: CameraId;
  readonly region: DamageRegion;
  readonly storedPath: string;
  readonly createdAt: string;
}

export const INVESTIGATION_EVENT_TYPES = [
  "started",
  "tool_call",
  "tool_result",
  "observation",
  "finding_saved",
  "report_generated",
  "manual_review",
  "error",
  "completed",
] as const;

export type InvestigationEventType = (typeof INVESTIGATION_EVENT_TYPES)[number];

/**
 * An append-only, plain-language step in the investigation timeline. The
 * `detail` object exposes only camera / timestamp / frame — never prompts,
 * raw tool arguments, or customer uploads.
 */
export interface InvestigationEvent {
  readonly id: string;
  readonly claimId: string;
  readonly seq: number;
  readonly type: InvestigationEventType;
  readonly plainLanguage: string;
  readonly detail: InvestigationEventDetail | null;
  readonly createdAt: string;
}

export interface InvestigationEventDetail {
  readonly camera?: CameraId;
  readonly timestampMs?: number;
  readonly frameId?: string;
}
