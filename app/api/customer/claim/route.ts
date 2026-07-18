import type { NextRequest } from "next/server";
import { getAppContext } from "@/lib/runtime/context";
import { getCustomerView } from "@/lib/claims/customer";
import { readSessionClaimId } from "@/lib/api/session-cookie";
import { fail, handleError, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** State-appropriate customer view for the current session. */
export async function GET(req: NextRequest) {
  const ctx = await getAppContext();
  const claimId = readSessionClaimId(req, ctx);
  if (!claimId) return fail("Your session has expired. Re-enter your PIN.", 401);
  try {
    return ok({ view: getCustomerView(ctx, claimId) });
  } catch (error) {
    return handleError(error);
  }
}
