import { getAppContext } from "@/lib/runtime/context";
import { getClaimById } from "@/lib/db/repositories/claims";
import {
  isInvestigationRunning,
  launchInvestigation,
} from "@/lib/claims/run-background";
import { fail, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = getAppContext();
  const claim = getClaimById(ctx.db, id);
  if (!claim) return fail("Claim not found.", 404);
  if (isInvestigationRunning(id)) {
    return ok({ started: true, alreadyRunning: true });
  }
  if (claim.status !== "customer_submitted") {
    return fail(
      "The customer must submit their intake before an investigation can run.",
      409,
    );
  }
  if (claim.selectedRegions.length === 0) {
    return fail("Mark the reported damage areas before investigating.", 409);
  }
  launchInvestigation(ctx, id);
  return ok({ started: true });
}
