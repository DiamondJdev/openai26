import { getAppContext } from "@/lib/runtime/context";
import { getUploadById } from "@/lib/db/repositories/uploads";
import { fail } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serve a customer upload to the trusted local employee context only. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAppContext();
  const upload = await getUploadById(ctx.db, id);
  if (!upload) {
    return fail("Not found.", 404);
  }
  const bytes = await ctx.artifacts.get(upload.storedPath);
  if (!bytes) return fail("Not found.", 404);
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": upload.mime,
      "Cache-Control": "no-store",
    },
  });
}
