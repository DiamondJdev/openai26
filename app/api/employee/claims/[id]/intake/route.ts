import type { NextRequest } from "next/server";
import { getAppContext } from "@/lib/runtime/context";
import { setClaimIntake } from "@/lib/claims/create";
import { getClaimById } from "@/lib/db/repositories/claims";
import { claimDetail } from "@/lib/api/serialize";
import { fail, handleError, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAppContext();
  if (!getClaimById(ctx.db, id)) return fail("Claim not found.", 404);
  try {
    const body = await req.json().catch(() => ({}));
    const updated = setClaimIntake(ctx, id, body);
    return ok({ claim: claimDetail(ctx, updated) });
  } catch (error) {
    return handleError(error);
  }
}
