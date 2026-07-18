import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { config, middleware } from "@/middleware";
import {
  EMPLOYEE_COOKIE,
  createEmployeeToken,
} from "@/lib/security/employee-session";

const originalUsername = process.env.EMPLOYEE_USERNAME;
const originalPassword = process.env.EMPLOYEE_PASSWORD;

function request(pathname: string, token?: string): NextRequest {
  return new NextRequest(`https://claimlens.example${pathname}`, {
    headers: token ? { cookie: `${EMPLOYEE_COOKIE}=${token}` } : undefined,
  });
}

function configureCredentials(): void {
  process.env.EMPLOYEE_USERNAME = "demo";
  process.env.EMPLOYEE_PASSWORD = "pass";
}

afterEach(() => {
  if (originalUsername === undefined) delete process.env.EMPLOYEE_USERNAME;
  else process.env.EMPLOYEE_USERNAME = originalUsername;
  if (originalPassword === undefined) delete process.env.EMPLOYEE_PASSWORD;
  else process.env.EMPLOYEE_PASSWORD = originalPassword;
});

describe("employee session middleware", () => {
  it("redirects an unauthenticated employee page request to login with its destination", async () => {
    configureCredentials();

    const response = await middleware(request("/employee/claims/demo?tab=events"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://claimlens.example/employee/login?next=%2Femployee%2Fclaims%2Fdemo%3Ftab%3Devents",
    );
  });

  it("returns a JSON 401 for the protected employee reset API without a session", async () => {
    configureCredentials();

    const response = await middleware(request("/api/employee/reset"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Authentication required.",
    });
  });

  it("allows login and logout endpoints to establish or clear a session", async () => {
    const login = await middleware(request("/api/employee/login"));
    const logout = await middleware(request("/api/employee/logout"));

    expect(login.headers.get("x-middleware-next")).toBe("1");
    expect(logout.headers.get("x-middleware-next")).toBe("1");
  });

  it("continues employee pages and APIs for a valid session cookie", async () => {
    configureCredentials();
    const token = await createEmployeeToken("demo:pass", Date.now());

    const page = await middleware(request("/employee", token));
    const api = await middleware(request("/api/employee/reset", token));

    expect(page.headers.get("x-middleware-next")).toBe("1");
    expect(api.headers.get("x-middleware-next")).toBe("1");
  });

  it("matches employee pages and APIs", () => {
    expect(config.matcher).toEqual([
      "/employee/:path*",
      "/api/employee/:path*",
    ]);
  });
});
