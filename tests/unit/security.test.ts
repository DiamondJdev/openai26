import { describe, expect, it } from "vitest";
import {
  generateToken,
  hashToken,
  verifyToken,
} from "@/lib/security/tokens";
import { generatePin, hashPin, verifyPin } from "@/lib/security/pin";
import {
  afterFailure,
  afterSuccess,
  lockStatus,
} from "@/lib/security/throttle";
import { PIN_POLICY } from "@/lib/config/constants";

describe("link tokens", () => {
  it("generates a url-safe high-entropy token", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(generateToken()).not.toBe(token);
  });

  it("hashes deterministically for lookup", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
  });

  it("verifies a token against its hash in constant time", () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(verifyToken(token, hash)).toBe(true);
    expect(verifyToken("wrong", hash)).toBe(false);
    expect(verifyToken(token, "deadbeef")).toBe(false);
  });
});

describe("PIN hashing", () => {
  it("generates a numeric PIN of the configured length", () => {
    const pin = generatePin();
    expect(pin).toMatch(new RegExp(`^\\d{${PIN_POLICY.length}}$`));
  });

  it("produces a salted, non-reversible hash", () => {
    const encoded = hashPin("123456");
    expect(encoded).not.toContain("123456");
    // Same PIN, different salt → different stored value.
    expect(hashPin("123456")).not.toBe(encoded);
  });

  it("verifies the correct PIN and rejects wrong ones", () => {
    const encoded = hashPin("135790");
    expect(verifyPin("135790", encoded)).toBe(true);
    expect(verifyPin("000000", encoded)).toBe(false);
    expect(verifyPin("13579", encoded)).toBe(false);
  });

  it("rejects a malformed encoded hash without throwing", () => {
    expect(verifyPin("135790", "not-a-valid-hash")).toBe(false);
  });
});

describe("PIN throttle", () => {
  const t0 = Date.parse("2026-07-18T10:00:00.000Z");

  it("is unlocked for a fresh access record", () => {
    expect(lockStatus({ failedAttempts: 0, lockedUntil: null }, t0)).toEqual({
      locked: false,
      retryAfterMs: 0,
    });
  });

  it("counts failures below the threshold without locking", () => {
    let state = { failedAttempts: 0, lockedUntil: null as string | null };
    for (let i = 0; i < PIN_POLICY.maxFailedAttempts - 1; i++) {
      state = afterFailure(state, t0);
    }
    expect(state.failedAttempts).toBe(PIN_POLICY.maxFailedAttempts - 1);
    expect(lockStatus(state, t0).locked).toBe(false);
  });

  it("locks after reaching the max failed attempts", () => {
    let state = { failedAttempts: 0, lockedUntil: null as string | null };
    for (let i = 0; i < PIN_POLICY.maxFailedAttempts; i++) {
      state = afterFailure(state, t0);
    }
    const status = lockStatus(state, t0);
    expect(status.locked).toBe(true);
    expect(status.retryAfterMs).toBe(PIN_POLICY.lockoutMs);
  });

  it("unlocks once the lockout window elapses", () => {
    let state = { failedAttempts: 0, lockedUntil: null as string | null };
    for (let i = 0; i < PIN_POLICY.maxFailedAttempts; i++) {
      state = afterFailure(state, t0);
    }
    expect(lockStatus(state, t0 + PIN_POLICY.lockoutMs + 1).locked).toBe(false);
  });

  it("resets on success", () => {
    expect(afterSuccess()).toEqual({ failedAttempts: 0, lockedUntil: null });
  });
});
