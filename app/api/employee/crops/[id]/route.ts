import { getAppContext } from "@/lib/runtime/context";
import { getCropById } from "@/lib/db/repositories/evidence";
import { fail } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serve an evidence crop to the trusted local employee context so the manager
 * can preview exactly what would be shared before releasing the report.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAppContext();
  const crop = await getCropById(ctx.db, id);
  if (!crop) {
    return fail("Not found.", 404);
  }
  const bytes = await ctx.artifacts.get(crop.storedPath);
  if (!bytes) return fail("Not found.", 404);
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
  });
}
