import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Minimal signed session token: base64url(payload).hmac. Used for the customer's
 * short-lived link session after the PIN is verified, so the PIN is not required
 * on every poll. Stateless and tamper-evident.
 */
export function signSession(
  claimId: string,
  expiresAtMs: number,
  secret: string,
): string {
  const payload = Buffer.from(
    JSON.stringify({ c: claimId, e: expiresAtMs }),
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/** Verify a session token; returns the claim id or null if invalid/expired. */
export function verifySession(
  token: string,
  secret: string,
  nowMs: number,
): string | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      c?: unknown;
      e?: unknown;
    };
    if (typeof parsed.c !== "string" || typeof parsed.e !== "number") return null;
    if (nowMs > parsed.e) return null;
    return parsed.c;
  } catch {
    return null;
  }
}
