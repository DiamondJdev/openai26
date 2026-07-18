import { EMPLOYEE_COOKIE } from "@/lib/security/employee-session";
import { ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Clear the employee session cookie. */
export async function POST() {
  const res = ok({ ok: true });
  res.cookies.set(EMPLOYEE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
