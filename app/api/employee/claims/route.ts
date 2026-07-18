import type { NextRequest } from "next/server";
import { getAppContext } from "@/lib/runtime/context";
import { createClaim } from "@/lib/claims/create";
import { listClaims } from "@/lib/db/repositories/claims";
import { claimSummary } from "@/lib/api/serialize";
import { fail, handleError, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getAppContext();
  const claims = await Promise.all((await listClaims(ctx.db)).map((claim) => claimSummary(ctx, claim)));
  return ok({ claims });
}

export async function POST(req: NextRequest) {
  const ctx = await getAppContext();
  try {
    const body = (await req.json().catch(() => ({}))) as {
      plate?: unknown;
      managerNote?: unknown;
    };
    if (typeof body.plate !== "string") return fail("A plate is required.");
    const created = await createClaim(ctx, {
      plate: body.plate,
      managerNote: typeof body.managerNote === "string" ? body.managerNote : "",
    });
    return ok(
      {
        claim: await claimSummary(ctx, created.claim),
        url: created.url,
        pin: created.pin,
      },
      201,
    );
  } catch (error) {
    return handleError(error);
  }
}
