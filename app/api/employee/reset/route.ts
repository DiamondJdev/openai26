import { handleError, ok } from "@/lib/api/http";
import { resetDemo } from "@/lib/claims/reset";
import { getAppContext } from "@/lib/runtime/context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reset ClaimLens demo data. Employee session middleware protects this route. */
export async function POST() {
  try {
    const ctx = await getAppContext();
    return ok(await resetDemo(ctx));
  } catch (error) {
    return handleError(error);
  }
}
