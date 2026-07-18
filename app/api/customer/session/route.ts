import type { NextRequest } from "next/server";
import { getAppContext } from "@/lib/runtime/context";
import { getCustomerView, verifyAndStartSession } from "@/lib/claims/customer";
import { setSessionCookie } from "@/lib/api/session-cookie";
import { fail, handleError, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Establish a customer session from the link token + PIN (throttled). */
export async function POST(req: NextRequest) {
  const ctx = await getAppContext();
  try {
    const body = (await req.json().catch(() => ({}))) as {
      token?: unknown;
      pin?: unknown;
    };
    if (typeof body.token !== "string" || typeof body.pin !== "string") {
      return fail("Enter the PIN from your link.", 400);
    }
    const result = verifyAndStartSession(ctx, body.token, body.pin);
    if (!result.ok) {
      return fail(result.error, result.retryAfterMs ? 429 : 401);
    }
    const res = ok({ view: getCustomerView(ctx, result.claimId) });
    setSessionCookie(res, result.sessionToken);
    return res;
  } catch (error) {
    return handleError(error);
  }
}
