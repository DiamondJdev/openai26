import { NextResponse, type NextRequest } from "next/server";

/**
 * Optional gate for the employee console + APIs. The plan treats employee access
 * as trusted local access with no accounts, so this is OFF by default. But the
 * moment the app is tunneled (e.g. ngrok) to reach the customer `/c/*` link, the
 * employee routes become reachable too — set EMPLOYEE_ACCESS_TOKEN to require
 * HTTP Basic auth (any username, password = the token) on those routes.
 */
export const config = {
  matcher: ["/employee/:path*", "/api/employee/:path*"],
};

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="ClaimLens employee"' },
  });
}

export function middleware(req: NextRequest): NextResponse {
  const token = process.env.EMPLOYEE_ACCESS_TOKEN;
  if (!token) return NextResponse.next(); // local trusted default

  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return unauthorized();

  let decoded = "";
  try {
    decoded = atob(encoded);
  } catch {
    return unauthorized();
  }
  const password = decoded.slice(decoded.indexOf(":") + 1);
  if (!constantTimeEqual(password, token)) return unauthorized();
  return NextResponse.next();
}
