import type { NextRequest } from "next/server";
import { getAppContext } from "@/lib/runtime/context";
import { getClaimById } from "@/lib/db/repositories/claims";
import { listEventsAfter } from "@/lib/db/repositories/events";
import { isInvestigationRunning } from "@/lib/claims/run-background";
import { fail, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Poll investigation events after a sequence number (live-trace streaming). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAppContext();
  const claim = await getClaimById(ctx.db, id);
  if (!claim) return fail("Claim not found.", 404);

  const afterParam = req.nextUrl.searchParams.get("after");
  const after = afterParam ? Number.parseInt(afterParam, 10) : -1;
  const afterSeq = Number.isFinite(after) ? after : -1;

  const events = (await listEventsAfter(ctx.db, id, afterSeq)).map((e) => ({
    seq: e.seq,
    type: e.type,
    plainLanguage: e.plainLanguage,
    detail: e.detail,
    createdAt: e.createdAt,
  }));

  return ok({
    events,
    status: claim.status,
    running: isInvestigationRunning(id),
  });
}
