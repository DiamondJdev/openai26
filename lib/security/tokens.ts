import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { TOKEN_BYTES } from "@/lib/config/constants";

/** Generate a high-entropy, URL-safe opaque link token. */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Deterministic SHA-256 hash of a token, used both as the DB lookup key and for
 * verification. Safe without a per-token salt because the token itself carries
 * ~256 bits of entropy (no brute-force surface).
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison of a presented token against its stored hash. */
export function verifyToken(token: string, storedHash: string): boolean {
  const computed = Buffer.from(hashToken(token), "hex");
  let stored: Buffer;
  try {
    stored = Buffer.from(storedHash, "hex");
  } catch {
    return false;
  }
  if (computed.length !== stored.length || stored.length === 0) return false;
  return timingSafeEqual(computed, stored);
}
