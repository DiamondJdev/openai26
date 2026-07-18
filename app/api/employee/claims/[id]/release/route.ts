import type { NextRequest } from "next/server";
import { getAppContext } from "@/lib/runtime/context";
import { getClaimById } from "@/lib/db/repositories/claims";
import { releaseReport, resolveReleaseOptions } from "@/lib/claims/release";
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
  if (!(await getClaimById(ctx.db, id))) return fail("Claim not found.", 404);
  try {
    const body = await req.json().catch(() => ({}));
    const options = resolveReleaseOptions(body);
    await releaseReport(ctx.db, id, options, ctx.artifacts);
    const updated = await getClaimById(ctx.db, id);
    if (!updated) return fail("Claim not found.", 404);
    return ok({ claim: await claimDetail(ctx, updated) });
  } catch (error) {
    return handleError(error);
  }
}
