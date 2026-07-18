import type { CameraId } from "./cameras";
import type { DamageRegion } from "./regions";
import type { NormalizedBBox } from "./geometry";

/** The three possible conclusions an investigation can reach. */
export const REPORT_OUTCOMES = [
  "no_new_damage_detected",
  "new_damage_detected",
  "manual_review_required",
] as const;

export type ReportOutcome = (typeof REPORT_OUTCOMES)[number];

export function isReportOutcome(value: unknown): value is ReportOutcome {
  return (
    typeof value === "string" &&
    (REPORT_OUTCOMES as readonly string[]).includes(value)
  );
}

/** Outcomes that are allowed to reach employee review. */
export const REVIEWABLE_OUTCOMES: readonly ReportOutcome[] = [
  "no_new_damage_detected",
  "new_damage_detected",
];

/**
 * Per-finding damage classification. The report outcome is DERIVED from the set
 * of these across all findings — the model never states the conclusion directly.
 */
export const DAMAGE_STATUSES = [
  "no_damage",
  "pre_existing",
  "new_damage",
  "inconclusive",
] as const;

export type DamageStatus = (typeof DAMAGE_STATUSES)[number];

export function isDamageStatus(value: unknown): value is DamageStatus {
  return (
    typeof value === "string" &&
    (DAMAGE_STATUSES as readonly string[]).includes(value)
  );
}

export type ConfidenceLevel = "high" | "medium" | "low";

/**
 * Confidence is derived from how many independent checks agreed — never a bare
 * self-reported percentage.
 */
export interface Confidence {
  readonly level: ConfidenceLevel;
  readonly agreeingChecks: number;
  readonly totalChecks: number;
  readonly rationale: string;
}

/**
 * A structured finding. Every finding MUST cite at least one stored evidence
 * frame; a finding with no citation is invalid and rejected at report time.
 */
export interface Finding {
  readonly id: string;
  readonly claimId: string;
  readonly camera: CameraId;
  readonly timestampMs: number;
  /** Plain-language observation shown in the timeline expanders. */
  readonly observation: string;
  readonly region: DamageRegion | null;
  readonly damageStatus: DamageStatus;
  /** Vision-localized region box on the cited frame, for release crops. */
  readonly bbox: NormalizedBBox | null;
  /** Stored evidence frame ids this finding is derived from (non-empty). */
  readonly evidenceFrameIds: readonly string[];
  readonly createdAt: string;
}

export interface TimelineEntry {
  readonly timestampMs: number;
  readonly camera: CameraId;
  /** Plain-language description ("Vehicle enters", "Mid-tunnel — no contact"). */
  readonly label: string;
  readonly frameId: string | null;
}

export interface Report {
  readonly id: string;
  readonly claimId: string;
  readonly outcome: ReportOutcome;
  readonly summary: string;
  readonly conclusion: string;
  readonly timeline: readonly TimelineEntry[];
  readonly findingIds: readonly string[];
  readonly confidence: Confidence;
  readonly generatedAt: string;
}

/** Options an employee sets when releasing a report to the customer. */
export interface ReleaseOptions {
  /** Default OFF — releases only focused, timestamped entrance/exit crops. */
  readonly shareEvidenceCrops: boolean;
}
