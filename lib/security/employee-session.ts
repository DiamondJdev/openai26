/**
 * Employee console session: a stateless, signed, expiring cookie token.
 *
 * Deliberately edge-safe — uses only Web Crypto (`crypto.subtle`) and
 * base64url via `btoa`/`atob`, no `node:crypto` — so the same code signs the
 * token in a Node route handler and verifies it in Edge middleware. The signing
 * secret is derived from the configured console credentials, so rotating the
 * password invalidates every outstanding session.
 *
 * Must not import `server-only` or any Node-only module.
 */

export const EMPLOYEE_COOKIE = "cl_employee";
export const EMPLOYEE_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours.

const encoder = new TextEncoder();

/** The shared HMAC secret, or null when the console credentials are unset. */
export function employeeSecret(): string | null {
  const username = process.env.EMPLOYEE_USERNAME ?? "";
  const password = process.env.EMPLOYEE_PASSWORD ?? "";
  if (!username || !password) return null;
  return `${username}:${password}`;
}

/** Constant-time string comparison (safe in both Edge and Node runtimes). */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Whether the supplied credentials match the configured console login. */
export function credentialsValid(username: string, password: string): boolean {
  const expectedUser = process.env.EMPLOYEE_USERNAME ?? "";
  const expectedPass = process.env.EMPLOYEE_PASSWORD ?? "";
  if (!expectedUser || !expectedPass) return false;
  // Compare both regardless of the first result to avoid short-circuit timing.
  const userOk = constantTimeEqual(username, expectedUser);
  const passOk = constantTimeEqual(password, expectedPass);
  return userOk && passOk;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + pad);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Create a signed `payload.signature` token that expires after the TTL. */
export async function createEmployeeToken(
  secret: string,
  nowMs: number,
): Promise<string> {
  const payload = base64UrlEncode(
    encoder.encode(JSON.stringify({ e: nowMs + EMPLOYEE_SESSION_TTL_MS })),
  );
  const key = await hmacKey(secret);
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(payload)),
  );
  return `${payload}.${base64UrlEncode(signature)}`;
}

/** Verify a session token's signature and expiry. */
export async function verifyEmployeeToken(
  token: string,
  secret: string,
  nowMs: number,
): Promise<boolean> {
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  let signatureBytes: Uint8Array<ArrayBuffer>;
  try {
    signatureBytes = base64UrlDecode(signature);
  } catch {
    return false;
  }

  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    encoder.encode(payload),
  );
  if (!valid) return false;

  try {
    const parsed = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payload)),
    ) as { e?: unknown };
    return typeof parsed.e === "number" && nowMs <= parsed.e;
  } catch {
    return false;
  }
}
