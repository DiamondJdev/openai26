import { describe, expect, it } from "vitest";
import {
  getEnv,
  requireDeploymentEnv,
  resolvePublicBaseUrl,
} from "@/lib/config/env";

describe("deployment environment", () => {
  it("uses an explicit base URL before Vercel's current deployment", () => {
    expect(
      resolvePublicBaseUrl({
        CLAIMLENS_PUBLIC_BASE_URL: "https://tunnel.example/",
        VERCEL_URL: "claimlens-preview.vercel.app",
      }),
    ).toBe("https://tunnel.example");
  });

  it("uses the current Vercel URL when no override is present", () => {
    expect(
      resolvePublicBaseUrl({ VERCEL_URL: "claimlens-preview.vercel.app" }),
    ).toBe("https://claimlens-preview.vercel.app");
  });

  it("rejects a missing password", () => {
    expect(() => requireDeploymentEnv({ EMPLOYEE_USERNAME: "demo" })).toThrow(
      "EMPLOYEE_PASSWORD",
    );
  });

  it("requires credentials, a database URL, and a supported Blob configuration", () => {
    expect(() =>
      requireDeploymentEnv({
        EMPLOYEE_USERNAME: "demo",
        EMPLOYEE_PASSWORD: "pass",
        DATABASE_URL: "postgres://example",
      }),
    ).toThrow("BLOB_READ_WRITE_TOKEN");
  });

  it("accepts Vercel OIDC with a Blob store ID", () => {
    expect(() =>
      requireDeploymentEnv({
        EMPLOYEE_USERNAME: "demo",
        EMPLOYEE_PASSWORD: "pass",
        DATABASE_URL: "postgres://example",
        VERCEL_OIDC_TOKEN: "oidc-token",
        BLOB_STORE_ID: "store-id",
      }),
    ).not.toThrow();
  });

  it("exposes the database URL and resolved public base URL", () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousBaseUrl = process.env.CLAIMLENS_PUBLIC_BASE_URL;
    const previousVercelUrl = process.env.VERCEL_URL;
    process.env.DATABASE_URL = "postgres://example";
    process.env.CLAIMLENS_PUBLIC_BASE_URL = "https://tunnel.example/";
    delete process.env.VERCEL_URL;

    expect(getEnv()).toMatchObject({
      databaseUrl: "postgres://example",
      publicBaseUrl: "https://tunnel.example",
    });

    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousBaseUrl === undefined) delete process.env.CLAIMLENS_PUBLIC_BASE_URL;
    else process.env.CLAIMLENS_PUBLIC_BASE_URL = previousBaseUrl;
    if (previousVercelUrl === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = previousVercelUrl;
  });
});
