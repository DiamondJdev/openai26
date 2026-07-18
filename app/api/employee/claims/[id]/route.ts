import { getAppContext } from "@/lib/runtime/context";
import { getClaimById } from "@/lib/db/repositories/claims";
import { claimDetail } from "@/lib/api/serialize";
import { fail, ok } from "@/lib/api/http";
import { isInvestigationRunning } from "@/lib/claims/run-background";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAppContext();
  const claim = getClaimById(ctx.db, id);
  if (!claim) return fail("Claim not found.", 404);
  return ok({
    claim: claimDetail(ctx, claim),
    investigationRunning: isInvestigationRunning(id),
  });
}
