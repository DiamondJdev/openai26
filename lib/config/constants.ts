import type { UploadKind } from "@/lib/domain/models";

/** Hard guardrails on an investigation run. Env may lower these, never raise. */
export const INVESTIGATION_LIMITS = {
  maxInvestigationMs: 45_000,
} as const;

/** Numeric PIN policy for the customer's private link. */
export const PIN_POLICY = {
  length: 6,
  maxFailedAttempts: 5,
  lockoutMs: 15 * 60 * 1000,
} as const;

/** Opaque link token length in bytes (before base64url encoding). */
export const TOKEN_BYTES = 32;

/** Upload validation limits, enforced at the system boundary. */
export const UPLOAD_LIMITS = {
  maxBytes: 12 * 1024 * 1024,
  maxDimension: 5000,
  minDimension: 32,
  allowedMime: ["image/jpeg", "image/png", "image/webp"] as const,
  /** All accepted uploads are re-encoded to this format with metadata stripped. */
  reencodeFormat: "jpeg" as const,
  reencodeQuality: 82,
} as const;

/** Required intake uploads, in the order they are collected. */
export const REQUIRED_UPLOAD_KINDS: readonly UploadKind[] = [
  "plate",
  "odometer",
  "insurance",
];

/** Max characters accepted for the manager note before it is truncated. */
export const MAX_MANAGER_NOTE_CHARS = 500;
