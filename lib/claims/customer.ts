import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { AppContext } from "@/lib/runtime/context";
import type { UploadKind } from "@/lib/domain/models";
import type { ReportOutcome } from "@/lib/domain/report";
import { REQUIRED_UPLOAD_KINDS } from "@/lib/config/constants";
import { CONTACT_CARDS, type ContactCard } from "@/lib/config/contact-cards";
import { ValidationError } from "@/lib/domain/errors";
import { assertTransition } from "@/lib/domain/claim-state-machine";
import { hashToken, verifyToken } from "@/lib/security/tokens";
import { verifyPin } from "@/lib/security/pin";
import {
  afterFailure,
  afterSuccess,
  lockStatus,
} from "@/lib/security/throttle";
import { signSession } from "@/lib/security/session";
import {
  getAccessByClaimId,
  getAccessByTokenHash,
  updateAccessThrottle,
} from "@/lib/db/repositories/customer-access";
import {
  getClaimByIdOrThrow,
  updateClaimStatus,
} from "@/lib/db/repositories/claims";
import { insertSubmission } from "@/lib/db/repositories/submissions";
import { insertUpload } from "@/lib/db/repositories/uploads";
import { listCropsByClaim } from "@/lib/db/repositories/evidence";
import { getReportByClaimId } from "@/lib/db/repositories/reports";
import {
  validateAndReencode,
  type ValidatedImage,
} from "@/lib/uploads/validate";
import { nowIso } from "@/lib/util/time";

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const GENERIC_AUTH_ERROR = "That link or PIN is not valid.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Same-length dummy so verifyToken runs identically whether or not a record
// exists (removes a token-existence timing side channel).
const DUMMY_TOKEN_HASH = "0".repeat(64);

export type SessionResult =
  | {
      readonly ok: true;
      readonly sessionToken: string;
      readonly claimId: string;
    }
  | {
      readonly ok: false;
      readonly error: string;
      readonly retryAfterMs?: number;
    };

/**
 * Verify a link token + PIN with throttling, and on success mint a short-lived
 * signed session so the PIN is not needed on every request. All failures return
 * one generic message so the response never reveals which factor was wrong.
 */
export function verifyAndStartSession(
  ctx: AppContext,
  token: string,
  pin: string,
  nowMs: number = Date.now(),
): SessionResult {
  const access = getAccessByTokenHash(ctx.db, hashToken(token));
  if (!access || !verifyToken(token, access.tokenHash)) {
    return { ok: false, error: GENERIC_AUTH_ERROR };
  }

  const lock = lockStatus(access, nowMs);
  if (lock.locked) {
    return {
      ok: false,
      error: "Too many attempts. Please wait and try again.",
      retryAfterMs: lock.retryAfterMs,
    };
  }

  if (!verifyPin(pin, access.pinHash)) {
    const next = afterFailure(access, nowMs);
    updateAccessThrottle(
      ctx.db,
      access.id,
      next.failedAttempts,
      next.lockedUntil,
    );
    return { ok: false, error: GENERIC_AUTH_ERROR };
  }

  const reset = afterSuccess();
  updateAccessThrottle(
    ctx.db,
    access.id,
    reset.failedAttempts,
    reset.lockedUntil,
  );
  const sessionToken = signSession(
    access.claimId,
    nowMs + SESSION_TTL_MS,
    ctx.sessionSecret,
  );
  return { ok: true, sessionToken, claimId: access.claimId };
}

export interface IntakeFile {
  readonly kind: UploadKind;
  readonly bytes: Buffer;
}

export interface IntakeInput {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly consent: boolean;
  readonly files: readonly IntakeFile[];
}

/**
 * Validate and store the customer intake packet: profile fields + the three
 * required photos (each re-encoded and stripped of metadata), then move the
 * claim to `customer_submitted`. Uploads never reach the model.
 */
export async function submitIntake(
  ctx: AppContext,
  claimId: string,
  input: IntakeInput,
): Promise<void> {
  const claim = getClaimByIdOrThrow(ctx.db, claimId);
  assertTransition(claim.status, "customer_submitted");

  const name = input.name.trim();
  const email = input.email.trim();
  const phone = input.phone.trim();
  if (name.length === 0) throw new ValidationError("Enter your name.");
  if (!EMAIL_RE.test(email)) throw new ValidationError("Enter a valid email.");
  if (phone.replace(/\D/g, "").length < 7) {
    throw new ValidationError("Enter a valid phone number.");
  }
  if (!input.consent)
    throw new ValidationError("Consent is required to proceed.");

  for (const kind of REQUIRED_UPLOAD_KINDS) {
    const provided = input.files.find((f) => f.kind === kind);
    if (!provided) throw new ValidationError(`Add your ${kind} photo.`);
  }

  fs.mkdirSync(ctx.paths.uploads, { recursive: true });
  const stored: { kind: UploadKind; image: ValidatedImage }[] = [];
  for (const kind of REQUIRED_UPLOAD_KINDS) {
    const file = input.files.find((f) => f.kind === kind)!;
    const result = await validateAndReencode(file.bytes);
    if (!result.ok)
      throw new ValidationError(`The ${kind} photo could not be read.`);
    stored.push({ kind, image: result.image });
  }

  // Persist only after every file validates, so a rejected file leaves no rows.
  for (const { kind, image } of stored) {
    const storedPath = path.join(
      ctx.paths.uploads,
      `${claimId}-${kind}-${image.sha256.slice(0, 12)}.jpg`,
    );
    fs.writeFileSync(storedPath, image.data);
    insertUpload(ctx.db, {
      claimId,
      kind,
      storedPath,
      mime: image.mime,
      width: image.width,
      height: image.height,
      bytes: image.bytes,
      sha256: image.sha256,
    });
  }

  insertSubmission(ctx.db, {
    claimId,
    name,
    email,
    phone,
    consentAt: nowIso(),
  });
  updateClaimStatus(ctx.db, claimId, "customer_submitted");
}

export interface CustomerCropRef {
  readonly id: string;
  readonly region: string;
  readonly camera: string;
}

export type CustomerView =
  | { readonly state: "intake" }
  | { readonly state: "under_review" }
  | {
      readonly state: "released";
      readonly outcome: ReportOutcome;
      readonly conclusion: string;
      readonly summary: string;
      readonly crops: readonly CustomerCropRef[];
      readonly contactCards: readonly ContactCard[];
    };

/**
 * The state-appropriate customer view. Before release the customer sees only
 * "under review". After release they see the approved conclusion, any shared
 * crops, and outcome-based contact cards — never uploads, notes, or tool traces.
 */
export function getCustomerView(
  ctx: AppContext,
  claimId: string,
): CustomerView {
  const claim = getClaimByIdOrThrow(ctx.db, claimId);

  if (claim.status === "draft") return { state: "intake" };
  if (claim.status !== "released") return { state: "under_review" };

  const report = getReportByClaimId(ctx.db, claimId);
  if (!report) return { state: "under_review" };

  const crops = claim.shareEvidenceCrops
    ? listCropsByClaim(ctx.db, claimId).map((c) => ({
        id: c.id,
        region: c.region,
        camera: c.camera,
      }))
    : [];

  return {
    state: "released",
    outcome: report.outcome,
    conclusion: report.conclusion,
    summary: report.summary,
    crops,
    contactCards: CONTACT_CARDS[report.outcome],
  };
}

/** Look up the access record for a claim (used to confirm a session's claim). */
export function claimHasAccess(ctx: AppContext, claimId: string): boolean {
  return getAccessByClaimId(ctx.db, claimId) !== null;
}
