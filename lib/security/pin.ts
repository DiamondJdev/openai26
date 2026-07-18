import {
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { PIN_POLICY } from "@/lib/config/constants";

// scrypt cost parameters. Deliberately slow to blunt brute force of a low-entropy
// PIN; throttling (see throttle.ts) is the primary defense.
const N = 16_384;
const R = 8;
const P = 1;
const KEYLEN = 32;
const SALT_BYTES = 16;

/** Generate a numeric PIN of the configured length, allowing leading zeros. */
export function generatePin(): string {
  const max = 10 ** PIN_POLICY.length;
  return String(randomInt(0, max)).padStart(PIN_POLICY.length, "0");
}

/** Hash a PIN with a fresh random salt. Encoded as scrypt$N$r$p$salt$hash. */
export function hashPin(pin: string): string {
  const salt = randomBytes(SALT_BYTES);
  const hash = scryptSync(pin, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/** Constant-time verification of a PIN against its encoded hash. */
export function verifyPin(pin: string, encoded: string): boolean {
  const parts = encoded.split("$");
  if (parts.length !== 6) return false;
  const [scheme, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
  if (scheme !== "scrypt" || !nRaw || !rRaw || !pRaw || !saltB64 || !hashB64) {
    return false;
  }
  const n = Number.parseInt(nRaw, 10);
  const r = Number.parseInt(rRaw, 10);
  const p = Number.parseInt(pRaw, 10);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }
  try {
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    if (salt.length === 0 || expected.length === 0) return false;
    const actual = scryptSync(pin, salt, expected.length, { N: n, r, p });
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}
