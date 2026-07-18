import type { NextRequest } from "next/server";
import { getAppContext } from "@/lib/runtime/context";
import { getClaimById } from "@/lib/db/repositories/claims";
import { holdClaim } from "@/lib/claims/release";
import { claimDetail } from "@/lib/api/serialize";
import { fail, handleError, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = getAppContext();
  if (!getClaimById(ctx.db, id)) return fail("Claim not found.", 404);
  try {
    const body = (await req.json().catch(() => ({}))) as { reason?: unknown };
    const reason =
      typeof body.reason === "string" && body.reason.trim().length > 0
        ? body.reason.trim().slice(0, 300)
        : "Manager requested manual review.";
    holdClaim(ctx.db, id, reason);
    const updated = getClaimById(ctx.db, id)!;
    return ok({ claim: claimDetail(ctx, updated) });
  } catch (error) {
    return handleError(error);
  }
}
