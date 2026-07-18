import { NextResponse, type NextRequest } from "next/server";

/**
 * Gate the employee landing page with the server-only Basic Auth credentials.
 * Nested employee routes and APIs deliberately do not match this middleware.
 */
export const config = {
  matcher: ["/employee"],
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
  const username = process.env.EMPLOYEE_USERNAME ?? "";
  const password = process.env.EMPLOYEE_PASSWORD ?? "";

  const header = req.headers.get("authorization") ?? "";
  const basic = /^Basic ([^\s]+)$/.exec(header);
  if (!basic) return unauthorized();
  const encoded = basic[1];
  if (!encoded) return unauthorized();

  let decoded = "";
  try {
    decoded = atob(encoded);
  } catch {
    return unauthorized();
  }
  const separator = decoded.indexOf(":");
  if (separator < 0) return unauthorized();

  const suppliedUsername = decoded.slice(0, separator);
  const suppliedPassword = decoded.slice(separator + 1);
  const usernameMatches = constantTimeEqual(suppliedUsername, username);
  const passwordMatches = constantTimeEqual(suppliedPassword, password);
  if (!usernameMatches || !passwordMatches) return unauthorized();
  return NextResponse.next();
}
