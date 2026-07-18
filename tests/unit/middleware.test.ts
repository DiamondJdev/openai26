import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { config, middleware } from "@/middleware";

const originalUsername = process.env.EMPLOYEE_USERNAME;
const originalPassword = process.env.EMPLOYEE_PASSWORD;

function request(authorization?: string): NextRequest {
  return new NextRequest("https://claimlens.example/employee", {
    headers: authorization ? { authorization } : undefined,
  });
}

function basic(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

afterEach(() => {
  if (originalUsername === undefined) delete process.env.EMPLOYEE_USERNAME;
  else process.env.EMPLOYEE_USERNAME = originalUsername;
  if (originalPassword === undefined) delete process.env.EMPLOYEE_PASSWORD;
  else process.env.EMPLOYEE_PASSWORD = originalPassword;
});

describe("employee middleware", () => {
  it("returns a Basic challenge when the authorization header is missing", () => {
    process.env.EMPLOYEE_USERNAME = "demo";
    process.env.EMPLOYEE_PASSWORD = "pass";

    const response = middleware(request());

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe(
      'Basic realm="ClaimLens employee"',
    );
  });

  it("continues for matching Basic credentials", () => {
    process.env.EMPLOYEE_USERNAME = "demo";
    process.env.EMPLOYEE_PASSWORD = "pass";

    const response = middleware(request(basic("demo", "pass")));

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("returns a challenge for the wrong username", () => {
    process.env.EMPLOYEE_USERNAME = "demo";
    process.env.EMPLOYEE_PASSWORD = "pass";

    expect(middleware(request(basic("other", "pass"))).status).toBe(401);
  });

  it("matches only the exact employee route", () => {
    expect(config.matcher).toEqual(["/employee"]);
    expect(config.matcher).not.toContain("/employee/claims/one");
    expect(config.matcher).not.toContain("/api/employee/claims");
  });
});
