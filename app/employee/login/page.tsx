import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  EMPLOYEE_COOKIE,
  employeeSecret,
  verifyEmployeeToken,
} from "@/lib/security/employee-session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

/** Only allow internal console paths as a post-login redirect target. */
function safeNext(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (
    typeof value === "string" &&
    value.startsWith("/employee") &&
    !value.startsWith("//") &&
    !value.startsWith("/employee/login")
  ) {
    return value;
  }
  return "/employee";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = safeNext((await searchParams).next);

  // Skip the form entirely if there's already a valid session.
  const secret = employeeSecret();
  if (secret) {
    const token = (await cookies()).get(EMPLOYEE_COOKIE)?.value;
    if (token && (await verifyEmployeeToken(token, secret, Date.now()))) {
      redirect(next);
    }
  }

  return <LoginForm next={next} />;
}
