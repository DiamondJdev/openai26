import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import type { AppContext } from "@/lib/runtime/context";
import { verifySession } from "@/lib/security/session";

export const SESSION_COOKIE = "cl_session";
const MAX_AGE_SECONDS = 2 * 60 * 60;

/** Read and verify the customer's signed session cookie; returns the claim id. */
export function readSessionClaimId(
  req: NextRequest,
  ctx: AppContext,
): string | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token, ctx.sessionSecret, Date.now());
}

/** Attach the signed session cookie (httpOnly) to a response. */
export function setSessionCookie(res: NextResponse, sessionToken: string): void {
  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}
