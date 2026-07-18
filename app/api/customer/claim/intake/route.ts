import type { NextRequest } from "next/server";
import { getAppContext } from "@/lib/runtime/context";
import {
  getCustomerView,
  submitIntake,
  type IntakeFile,
} from "@/lib/claims/customer";
import { REQUIRED_UPLOAD_KINDS } from "@/lib/config/constants";
import { readSessionClaimId } from "@/lib/api/session-cookie";
import { fail, handleError, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function str(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

/** Submit the customer intake packet (multipart: profile fields + 3 photos). */
export async function POST(req: NextRequest) {
  const ctx = getAppContext();
  const claimId = readSessionClaimId(req, ctx);
  if (!claimId) return fail("Your session has expired. Re-enter your PIN.", 401);

  try {
    const form = await req.formData();
    const files: IntakeFile[] = [];
    for (const kind of REQUIRED_UPLOAD_KINDS) {
      const entry = form.get(kind);
      if (!(entry instanceof File)) {
        return fail(`Add your ${kind} photo.`, 400);
      }
      const bytes = Buffer.from(await entry.arrayBuffer());
      files.push({ kind, bytes });
    }

    await submitIntake(ctx, claimId, {
      name: str(form, "name"),
      email: str(form, "email"),
      phone: str(form, "phone"),
      consent: str(form, "consent") === "true",
      files,
    });

    return ok({ view: getCustomerView(ctx, claimId) });
  } catch (error) {
    return handleError(error);
  }
}
