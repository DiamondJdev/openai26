import type { NextRequest } from "next/server";
import {
  EMPLOYEE_COOKIE,
  EMPLOYEE_SESSION_TTL_MS,
  createEmployeeToken,
  credentialsValid,
  employeeSecret,
} from "@/lib/security/employee-session";
import { fail, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lightweight in-memory rate limit (per server instance). The console has a
// single shared credential, so this is a brute-force brake, not per-user authz.
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 5 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string, nowMs: number): boolean {
  const entry = attempts.get(key);
  if (!entry || nowMs > entry.resetAt) {
    attempts.set(key, { count: 0, resetAt: nowMs + WINDOW_MS });
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string, nowMs: number): void {
  const entry = attempts.get(key) ?? { count: 0, resetAt: nowMs + WINDOW_MS };
  attempts.set(key, { count: entry.count + 1, resetAt: entry.resetAt });
}

/** Verify console credentials and, on success, set the signed session cookie. */
export async function POST(req: NextRequest) {
  const secret = employeeSecret();
  if (!secret) {
    return fail("The console login is not configured.", 500);
  }

  const nowMs = Date.now();
  const clientKey = req.headers.get("x-forwarded-for") ?? "local";
  if (rateLimited(clientKey, nowMs)) {
    return fail("Too many attempts. Wait a few minutes and try again.", 429);
  }

  const body = (await req.json().catch(() => ({}))) as {
    username?: unknown;
    password?: unknown;
  };
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!credentialsValid(username, password)) {
    recordFailure(clientKey, nowMs);
    return fail("Incorrect username or password.", 401);
  }

  const token = await createEmployeeToken(secret, nowMs);
  const res = ok({ ok: true });
  res.cookies.set(EMPLOYEE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(EMPLOYEE_SESSION_TTL_MS / 1000),
  });
  return res;
}
