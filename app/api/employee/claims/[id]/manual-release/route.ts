import type { NextRequest } from "next/server";
import { getAppContext } from "@/lib/runtime/context";
import { getClaimById } from "@/lib/db/repositories/claims";
import {
  completeManualReview,
  resolveHumanReviewOutcome,
} from "@/lib/claims/release";
import { claimDetail } from "@/lib/api/serialize";
import { fail, handleError, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Record an employee's final manual-review decision and release it. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAppContext();
  if (!getClaimById(ctx.db, id)) return fail("Claim not found.", 404);
  try {
    const body = await req.json().catch(() => ({}));
    const outcome = resolveHumanReviewOutcome(body);
    completeManualReview(ctx.db, id, outcome);
    const updated = getClaimById(ctx.db, id)!;
    return ok({ claim: claimDetail(ctx, updated) });
  } catch (error) {
    return handleError(error);
  }
}
