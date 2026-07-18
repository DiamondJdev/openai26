import { NextResponse, type NextRequest } from "next/server";
import {
  EMPLOYEE_COOKIE,
  employeeSecret,
  verifyEmployeeToken,
} from "@/lib/security/employee-session";

/**
 * Gate the employee console (pages and APIs) behind a signed session cookie.
 * Unauthenticated page requests are sent to the themed login page; API requests
 * get a JSON 401 so client fetches surface a clean error instead of HTML.
 */
export const config = {
  matcher: ["/employee/:path*", "/api/employee/:path*"],
};

// Routes reachable without a session: the login page and its auth endpoints.
const PUBLIC_PATHS = new Set([
  "/employee/login",
  "/api/employee/login",
  "/api/employee/logout",
]);

function unauthenticated(req: NextRequest): NextResponse {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  }
  const loginUrl = new URL("/employee/login", req.url);
  loginUrl.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  if (PUBLIC_PATHS.has(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const secret = employeeSecret();
  if (!secret) return unauthenticated(req);

  const token = req.cookies.get(EMPLOYEE_COOKIE)?.value;
  if (!token) return unauthenticated(req);

  const valid = await verifyEmployeeToken(token, secret, Date.now());
  if (!valid) return unauthenticated(req);

  return NextResponse.next();
}
