import fs from "node:fs";
import type { NextRequest } from "next/server";
import { getAppContext } from "@/lib/runtime/context";
import { getCropById } from "@/lib/db/repositories/evidence";
import { getClaimById } from "@/lib/db/repositories/claims";
import { readSessionClaimId } from "@/lib/api/session-cookie";
import { fail } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serve a released evidence crop to the owning customer only. Requires a valid
 * session for the crop's claim, and that the claim is released with sharing on.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = getAppContext();
  const claimId = readSessionClaimId(req, ctx);
  if (!claimId) return fail("Not found.", 404);

  const crop = getCropById(ctx.db, id);
  if (!crop || crop.claimId !== claimId) return fail("Not found.", 404);

  const claim = getClaimById(ctx.db, claimId);
  if (!claim || claim.status !== "released" || !claim.shareEvidenceCrops) {
    return fail("Not found.", 404);
  }
  if (!fs.existsSync(crop.storedPath)) return fail("Not found.", 404);

  const bytes = fs.readFileSync(crop.storedPath);
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
  });
}
