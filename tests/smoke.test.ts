import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("toolchain smoke test", () => {
  it("runs the test runner", () => {
    expect(1 + 1).toBe(2);
  });

  it("documents the hosted deployment contract", () => {
    const read = (file: string) =>
      fs.readFileSync(path.join(process.cwd(), file), "utf8");
    const environment = read(".env.example");
    const normalize = (value: string) => value.replace(/\s+/g, " ");
    const readme = normalize(read("README.md"));
    const demo = normalize(read("demo.md"));

    for (const variable of [
      "EMPLOYEE_USERNAME=",
      "EMPLOYEE_PASSWORD=",
      "DATABASE_URL=",
      "BLOB_READ_WRITE_TOKEN=",
      "VERCEL_OIDC_TOKEN=",
      "BLOB_STORE_ID=",
    ]) {
      expect(environment).toContain(variable);
    }

    expect(readme).toContain("Automatically expose System Environment Variables");
    expect(readme).toContain("Preview and Production share the same Neon database");
    expect(readme).toContain("signed, expiring employee session cookie");
    expect(readme).toContain("/api/employee/logout");
    expect(readme).toContain("private Blob store");
    expect(readme).toContain("still images");
    expect(readme).toContain("protected employee reset control");
    expect(demo).toContain("/employee/login");
    expect(demo).not.toContain("EMPLOYEE_ACCESS_TOKEN");
    expect(demo).not.toContain("HTTP Basic auth");
    expect(demo).toContain("no ffmpeg-based video path");
  });
});
