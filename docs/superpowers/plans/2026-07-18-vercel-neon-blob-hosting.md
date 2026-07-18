# Vercel, Neon, and Blob Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Host ClaimLens on Vercel with exact-route employee Basic Auth, deployment-aware customer links, Neon Postgres persistence, private Vercel Blob artifacts, and a hosted reset control.

**Architecture:** Replace the synchronous SQLite boundary with an asynchronous Database adapter backed by the Neon serverless driver. Add an ArtifactStore port backed by private Vercel Blob; it retains Blob pathnames in Postgres and uses temporary files only while Sharp or the existing vision driver requires filesystem paths.

**Tech Stack:** Next.js 15 App Router, TypeScript, @neondatabase/serverless, @vercel/blob, Neon Postgres, Vercel Functions, pg-mem, Vitest, Sharp.

## Global Constraints

- Protect exactly /employee with HTTP Basic Auth; do not protect nested employee routes or any API route.
- Fail next dev, next build, and next start when EMPLOYEE_USERNAME, EMPLOYEE_PASSWORD, DATABASE_URL, or Vercel Blob credentials are unavailable.
- Keep the current random per-instance customer session signing key. Do not add CLAIMLENS_SESSION_SECRET.
- Resolve customer-link origins in this order: CLAIMLENS_PUBLIC_BASE_URL, then https + VERCEL_URL, then localhost.
- Use DATABASE_URL only through server-side environment variables; never commit, log, or return it.
- Use the Neon driver directly, with no ORM. Repositories return promises.
- Preview and Production deliberately share the Neon database.
- All durable artifacts stay in one private Blob store below claimlens/. Never reveal Blob URLs.
- Support bundled still images only. A video source returns video_unsupported without calling ffmpeg.
- Data persists until hosted reset. Reset only deletes the claimlens/ Blob prefix, truncates ClaimLens tables, and re-seeds fixtures.
- The reset API is intentionally unprotected; the UI must ask for browser confirmation.
- Schedule investigation work with Next after() rather than an untracked background promise. The work remains bounded by the existing 45-second investigation limit.

---

## Task 1: Add asynchronous database and artifact ports

**Files:**

- Modify: package.json
- Modify: package-lock.json
- Replace: lib/db/connection.ts
- Create: lib/storage/artifacts.ts
- Modify: tests/helpers/db.ts
- Modify: tests/helpers/app.ts
- Modify: tests/helpers/tools.ts
- Test: tests/unit/db-connection.test.ts
- Test: tests/unit/artifacts.test.ts

**Interfaces:**

- Produces Database.query(text, parameters), Database.close(), createNeonDatabase(url), createTestDatabase().
- Produces ArtifactStore.putJpeg(pathname, bytes), ArtifactStore.get(pathname), ArtifactStore.withLocalFile(pathname, callback), ArtifactStore.deletePrefix(prefix).
- Later tasks receive ctx.db: Database and ctx.artifacts: ArtifactStore.

- [ ] **Step 1: Write failing port tests**

~~~ts
it("executes asynchronous parameterized Postgres queries", async () => {
  const db = await createTestDatabase();
  await db.query("CREATE TABLE probe (value TEXT NOT NULL)");
  await db.query("INSERT INTO probe (value) VALUES ($1)", ["neon-shape"]);
  expect(await db.query("SELECT value FROM probe")).toEqual([{ value: "neon-shape" }]);
  await db.close();
});

it("rejects Blob paths outside the ClaimLens prefix", async () => {
  const artifacts = createInMemoryArtifactStore();
  await expect(artifacts.putJpeg("other/image.jpg", Buffer.from("x")))
    .rejects.toThrow("claimlens/");
});
~~~

- [ ] **Step 2: Confirm the tests fail for missing exports**

Run: npm run test:run -- tests/unit/db-connection.test.ts tests/unit/artifacts.test.ts

Expected: FAIL because neither asynchronous port exists.

- [ ] **Step 3: Install dependencies and implement production/test adapters**

Run: npm install @neondatabase/serverless @vercel/blob && npm install -D pg-mem

Implement this adapter; use sql.query rather than interpolation for the shared Database interface:

~~~ts
export interface Database {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    parameters?: readonly (string | number | boolean | null)[],
  ): Promise<T[]>;
  close(): Promise<void>;
}

export function createNeonDatabase(connectionString: string): Database {
  const sql = neon(connectionString);
  return {
    async query(text, parameters = []) {
      return await sql.query(text, [...parameters]);
    },
    async close() {},
  };
}
~~~

Implement createTestDatabase with pg-mem's createPg().Pool adapter and the identical Database interface. Implement PrivateBlobArtifactStore with put(pathname, body, { access: "private", contentType: "image/jpeg" }), get(pathname, { access: "private" }), paginated list({ prefix }), and del. Implement InMemoryArtifactStore for tests. Both stores must reject any pathname that does not start with claimlens/.

- [ ] **Step 4: Verify the adapter boundary**

Run: npm run test:run -- tests/unit/db-connection.test.ts tests/unit/artifacts.test.ts && npm run typecheck

Expected: PASS; test helpers no longer import better-sqlite3.

- [ ] **Step 5: Commit the ports**

~~~bash
git add package.json package-lock.json lib/db/connection.ts lib/storage/artifacts.ts tests/helpers/db.ts tests/helpers/app.ts tests/helpers/tools.ts tests/unit/db-connection.test.ts tests/unit/artifacts.test.ts
git commit -m "chore: add Neon and Blob persistence ports"
~~~

## Task 2: Add Vercel environment validation, Base URL selection, and Basic Auth

**Files:**

- Modify: lib/config/env.ts
- Modify: next.config.mjs
- Modify: middleware.ts
- Modify: .env.example
- Test: tests/unit/env.test.ts
- Test: tests/unit/middleware.test.ts

**Interfaces:**

- Produces resolvePublicBaseUrl(env), requireDeploymentEnv(env), and getEnv().databaseUrl.
- Middleware reads EMPLOYEE_USERNAME and EMPLOYEE_PASSWORD and matches only /employee.

- [ ] **Step 1: Write failing config and middleware tests**

~~~ts
it("uses an explicit base URL before Vercel's current deployment", () => {
  expect(resolvePublicBaseUrl({
    CLAIMLENS_PUBLIC_BASE_URL: "https://tunnel.example/",
    VERCEL_URL: "claimlens-preview.vercel.app",
  })).toBe("https://tunnel.example");
});

it("uses the current Vercel URL when no override is present", () => {
  expect(resolvePublicBaseUrl({ VERCEL_URL: "claimlens-preview.vercel.app" }))
    .toBe("https://claimlens-preview.vercel.app");
});

it("rejects a missing password", () => {
  expect(() => requireDeploymentEnv({ EMPLOYEE_USERNAME: "demo" }))
    .toThrow("EMPLOYEE_PASSWORD");
});
~~~

Create middleware tests for: missing header returns 401 plus WWW-Authenticate; matching demo:pass returns next; wrong username returns 401; /employee/claims/one and /api/employee/claims are not matched.

- [ ] **Step 2: Run and observe the expected failure**

Run: npm run test:run -- tests/unit/env.test.ts tests/unit/middleware.test.ts

Expected: FAIL because username validation and pure URL/config functions are absent.

- [ ] **Step 3: Implement strict environment and exact-route auth**

Use these semantics:

~~~ts
export function resolvePublicBaseUrl(env: NodeJS.ProcessEnv): string {
  const explicit = env.CLAIMLENS_PUBLIC_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercelUrl = env.VERCEL_URL?.trim();
  return vercelUrl ? "https://" + vercelUrl : "http://localhost:3000";
}
~~~

requireDeploymentEnv must reject blank EMPLOYEE_USERNAME, EMPLOYEE_PASSWORD, and DATABASE_URL. It must accept either BLOB_READ_WRITE_TOKEN or the pair VERCEL_OIDC_TOKEN plus BLOB_STORE_ID. Invoke it while loading next.config.mjs.

Set middleware matcher to ["/employee"]. Parse the decoded Basic payload at its first colon; constant-time compare both username and password. Retain a 401 challenge for missing, malformed, or non-matching headers. Replace EMPLOYEE_ACCESS_TOKEN in .env.example with empty required server-only names; never include a real value.

- [ ] **Step 4: Verify focused behavior**

Run: npm run test:run -- tests/unit/env.test.ts tests/unit/middleware.test.ts && npm run typecheck

Expected: PASS; only /employee is challenged.

- [ ] **Step 5: Commit the configuration behavior**

~~~bash
git add lib/config/env.ts next.config.mjs middleware.ts .env.example tests/unit/env.test.ts tests/unit/middleware.test.ts
git commit -m "feat: configure Vercel employee access"
~~~

## Task 3: Create idempotent Neon migrations and initialize context without purge

**Files:**

- Create: lib/db/migrations.ts
- Modify: lib/db/schema.ts
- Modify: lib/runtime/context.ts
- Modify: lib/config/paths.ts
- Delete: lib/cleanup/purge.ts
- Modify: scripts/reset.ts
- Modify: scripts/seed.ts
- Test: tests/unit/migrations.test.ts

**Interfaces:**

- Produces applyMigrations(db): Promise<void>.
- Produces seedFromManifest(db, manifest): Promise<number>.
- getAppContext(): Promise<AppContext>; AppContext exposes db, artifacts, footageRoot, env, sessionSecret, and manifestLoaded—not DataPaths.

- [ ] **Step 1: Write a failing idempotency test**

~~~ts
it("creates ClaimLens tables only once", async () => {
  const db = await createTestDatabase();
  await applyMigrations(db);
  await applyMigrations(db);
  await db.query(
    "INSERT INTO visits (id, plate_normalized, plate_display, vehicle_type, occurred_at, sources) VALUES ($1, $2, $3, $4, $5, $6)",
    ["visit_test", "TEST123", "TEST-123", "car", "2026-07-18T10:00:00.000Z", "{}"],
  );
  expect(await db.query("SELECT id FROM visits")).toEqual([{ id: "visit_test" }]);
  await db.close();
});
~~~

- [ ] **Step 2: Run it and verify it fails**

Run: npm run test:run -- tests/unit/migrations.test.ts

Expected: FAIL because applyMigrations does not exist.

- [ ] **Step 3: Implement the PostgreSQL schema and async initialization**

Create schema_migrations(version TEXT PRIMARY KEY, applied_at TEXT NOT NULL). Translate all existing ClaimLens tables, keys, unique constraints, and indexes from lib/db/schema.ts. Use BOOLEAN NOT NULL DEFAULT FALSE for share_evidence_crops; leave timestamps and serialized domain arrays/objects as TEXT to preserve current mapper behavior.

For each unapplied migration: run its statements, then insert migration version and current ISO time. Update repository seed insertion to be idempotent with ON CONFLICT (id) DO NOTHING.

Cache an async initialization promise on globalThis. It creates Neon from env.databaseUrl, applies migrations, creates PrivateBlobArtifactStore, loads fixtures, and seeds only when visits is empty. It must not call a purge function. Delete all production references to .data, SQLite paths, and startup cleanup.

- [ ] **Step 4: Verify schema bootstrap**

Run: npm run test:run -- tests/unit/migrations.test.ts tests/unit/config.test.ts && npm run typecheck

Expected: PASS twice against the same test database; runtime performs no destructive startup filesystem work.

- [ ] **Step 5: Commit the Neon bootstrap**

~~~bash
git add lib/db/migrations.ts lib/db/schema.ts lib/runtime/context.ts lib/config/paths.ts scripts/reset.ts scripts/seed.ts tests/unit/migrations.test.ts
git rm lib/cleanup/purge.ts
git commit -m "feat: initialize ClaimLens schema in Neon"
~~~

## Task 4: Convert repositories and all domain callers to async Postgres

**Files:**

- Modify: lib/db/repositories/claims.ts
- Modify: lib/db/repositories/customer-access.ts
- Modify: lib/db/repositories/events.ts
- Modify: lib/db/repositories/evidence.ts
- Modify: lib/db/repositories/findings.ts
- Modify: lib/db/repositories/reports.ts
- Modify: lib/db/repositories/submissions.ts
- Modify: lib/db/repositories/uploads.ts
- Modify: lib/db/repositories/visits.ts
- Modify: lib/claims/create.ts
- Modify: lib/claims/customer.ts
- Modify: lib/claims/investigate.ts
- Modify: lib/claims/release.ts
- Modify: lib/claims/run-background.ts
- Modify: lib/agent/report-compiler.ts
- Modify: app/api/customer/session/route.ts
- Modify: app/api/customer/claim/route.ts
- Modify: app/api/customer/claim/intake/route.ts
- Modify: app/api/employee/claims/route.ts
- Modify: app/api/employee/claims/[id]/route.ts
- Modify: app/api/employee/claims/[id]/intake/route.ts
- Modify: app/api/employee/claims/[id]/hold/route.ts
- Modify: app/api/employee/claims/[id]/manual-release/route.ts
- Modify: app/api/employee/claims/[id]/release/route.ts
- Modify: app/api/employee/claims/[id]/events/route.ts
- Modify: app/api/employee/claims/[id]/investigate/route.ts
- Test: tests/integration/db.test.ts
- Test: tests/integration/e2e.test.ts
- Test: tests/integration/report-compiler.test.ts

**Interfaces:**

- Every repository export returns Promise<Value> or Promise<Value | null>.
- createClaim, setClaimIntake, verifyAndStartSession, getCustomerView, releaseReport, completeManualReview, and holdClaim become async.
- Route handlers await getAppContext and all service/repository calls.

- [ ] **Step 1: Update integration tests to express the async contract**

~~~ts
const created = await createClaim(harness.ctx, {
  plate: "TEST-123",
  managerNote: "rear bumper",
});
expect(created.url).toMatch(/^http:\/\/localhost:3000\/c\//);

const [first, second] = await Promise.all([
  appendEvent(db, eventInput),
  appendEvent(db, eventInput),
]);
expect([first.seq, second.seq].sort()).toEqual([0, 1]);
~~~

- [ ] **Step 2: Run focused tests and verify they fail**

Run: npm run test:run -- tests/integration/db.test.ts tests/integration/e2e.test.ts

Expected: FAIL because the SQLite methods prepare, get, all, run, and transaction remain.

- [ ] **Step 3: Implement async repositories and propagate awaits**

Replace each repository query with await db.query using $1-style parameters. Use RETURNING * for inserts/updates; preserve existing mapRow conversions and JSON serialization. Map Postgres share_evidence_crops directly as boolean.

Make event sequence assignment atomic in one query:

~~~sql
WITH locked AS (
  SELECT pg_advisory_xact_lock(hashtext($1))
), next_event AS (
  SELECT COALESCE(MAX(seq), -1) + 1 AS seq
  FROM investigation_events, locked
  WHERE claim_id = $1
)
INSERT INTO investigation_events (id, claim_id, seq, type, plain_language, detail, created_at)
SELECT $2, $1, next_event.seq, $3, $4, $5, $6 FROM next_event
RETURNING *;
~~~

Await all reads before mapping/serializing. In the investigation route, use after from next/server to start the promise inside the request lifecycle; in the after failure handler await appendEvent and holdForManualReview. Keep maxDuration at least 60 seconds and retain the existing 45-second investigation guardrail.

- [ ] **Step 4: Verify workflow tests and eliminate SQLite calls**

Run: npm run test:run -- tests/integration/db.test.ts tests/integration/e2e.test.ts tests/integration/report-compiler.test.ts tests/integration/agent-loop.test.ts && npm run typecheck && rg -n "\.prepare\(|\.transaction\(" lib app

Expected: tests PASS; ripgrep reports no production SQLite API calls.

- [ ] **Step 5: Commit async persistence**

~~~bash
git add lib/db/repositories lib/claims lib/agent/report-compiler.ts app/api/customer app/api/employee tests/integration/db.test.ts tests/integration/e2e.test.ts tests/integration/report-compiler.test.ts
git commit -m "feat: migrate ClaimLens workflows to Postgres"
~~~

## Task 5: Persist uploads, evidence, and crops through private Blob

**Files:**

- Modify: lib/claims/customer.ts
- Modify: app/api/customer/crops/[id]/route.ts
- Modify: app/api/employee/uploads/[id]/route.ts
- Modify: lib/agent/tools/context.ts
- Modify: lib/agent/tools/execute.ts
- Modify: lib/evidence/extract.ts
- Modify: lib/evidence/crop.ts
- Modify: lib/evidence/release-crops.ts
- Modify: lib/agent/openai-vision.ts
- Modify: lib/footage/manifest.ts
- Modify: lib/footage/resolve.ts
- Modify: next.config.mjs
- Test: tests/unit/uploads.test.ts
- Test: tests/integration/evidence.test.ts
- Test: tests/integration/tools.test.ts

**Interfaces:**

- Upload/evidence/crop storedPath values become claimlens/ Blob pathnames.
- ArtifactStore.withLocalFile(pathname, callback) supplies temporary local input to Sharp and the existing vision driver.
- Video extraction returns { ok: false, reason: "video_unsupported" }.

- [ ] **Step 1: Write failing Blob-artifact behavior tests**

~~~ts
it("persists a validated intake image under the private uploads prefix", async () => {
  await submitIntake(ctx, claimId, validIntake);
  const uploads = await listUploadsByClaim(ctx.db, claimId);
  expect(uploads.map((upload) => upload.storedPath))
    .toEqual(expect.arrayContaining([expect.stringMatching(/^claimlens\/uploads\//)]));
});

it("rejects a video source without invoking ffmpeg", async () => {
  const result = await executeTool(videoToolContext, "extract_frame", {
    camera: "entrance", timestampMs: 0,
  });
  expect(result.output).toMatchObject({ ok: false, reason: "video_unsupported" });
});
~~~

- [ ] **Step 2: Run and verify failure**

Run: npm run test:run -- tests/unit/uploads.test.ts tests/integration/evidence.test.ts tests/integration/tools.test.ts

Expected: FAIL because durable image files still use local paths and video invokes the current extractor.

- [ ] **Step 3: Implement private artifact flow**

Keep validation/re-encoding with Sharp, then store each JPEG using a generated opaque pathname such as claimlens/uploads/<claim-id>/<upload-id>.jpg. Insert only that pathname in Postgres.

For static fixture image input and intermediate Sharp output, create a unique directory below os.tmpdir(), remove it in finally, and persist the resulting JPEG buffer through ArtifactStore. For frame analysis, comparison, and crop production, call withLocalFile so existing imagePath APIs continue to receive a local temporary file. Then store final frames as claimlens/frames/<claim-id>/<frame-id>.jpg and crops as claimlens/crops/<claim-id>/<crop-id>.jpg.

The customer crop route and employee upload route must authorize from Postgres/session first, then get bytes via ArtifactStore and return a no-store response. They must not import node:fs or return Blob URLs.

Add outputFileTracingIncludes to next.config.mjs for ./fixtures/**/* so image fixtures are included in Vercel function bundles. When source.kind is video, add the user-visible investigation event and return video_unsupported before resolveAvailableFootagePath or runFfmpeg.

- [ ] **Step 4: Verify durable file behavior**

Run: npm run test:run -- tests/unit/uploads.test.ts tests/integration/evidence.test.ts tests/integration/tools.test.ts && rg -n "fs\.(readFileSync|writeFileSync|existsSync).*storedPath" app lib

Expected: tests PASS; no route reads a durable artifact from local disk.

- [ ] **Step 5: Commit private artifact migration**

~~~bash
git add lib/claims/customer.ts app/api/customer/crops/[id]/route.ts app/api/employee/uploads/[id]/route.ts lib/agent/tools lib/evidence lib/agent/openai-vision.ts lib/footage next.config.mjs tests/unit/uploads.test.ts tests/integration/evidence.test.ts tests/integration/tools.test.ts
git commit -m "feat: persist ClaimLens artifacts in private Blob"
~~~

## Task 6: Add reset-and-reseed service, API, and employee control

**Files:**

- Create: lib/claims/reset.ts
- Create: app/api/employee/reset/route.ts
- Modify: app/employee/page.tsx
- Test: tests/integration/reset.test.ts
- Test: tests/unit/employee-reset.test.tsx

**Interfaces:**

- Produces resetDemo(ctx): Promise<{ seededVisits: number; deletedArtifacts: number }>.
- POST /api/employee/reset returns the reset result with the existing ok/fail response helpers.

- [ ] **Step 1: Write failing reset tests**

~~~ts
it("clears only ClaimLens artifacts and restores demo visits", async () => {
  await ctx.artifacts.putJpeg("claimlens/uploads/claim_a/a.jpg", Buffer.from("a"));
  await ctx.artifacts.putJpeg("other/keep.jpg", Buffer.from("keep"));

  const result = await resetDemo(ctx);

  expect(result.seededVisits).toBeGreaterThan(0);
  await expect(ctx.artifacts.get("claimlens/uploads/claim_a/a.jpg")).resolves.toBeNull();
  await expect(ctx.artifacts.get("other/keep.jpg")).resolves.toEqual(Buffer.from("keep"));
});
~~~

~~~tsx
it("does not POST reset when the confirmation is cancelled", async () => {
  vi.stubGlobal("confirm", vi.fn(() => false));
  render(<EmployeeDashboard />);
  await userEvent.click(screen.getByRole("button", { name: "Reset demo data" }));
  expect(fetch).not.toHaveBeenCalled();
});
~~~

- [ ] **Step 2: Run and confirm the tests fail**

Run: npm run test:run -- tests/integration/reset.test.ts tests/unit/employee-reset.test.tsx

Expected: FAIL because resetDemo, its route, and its UI do not exist.

- [ ] **Step 3: Implement reset with scoped deletion and reseed**

Implement in this exact order:

~~~ts
const deletedArtifacts = await ctx.artifacts.deletePrefix("claimlens/");
await ctx.db.query(
  "TRUNCATE TABLE reports, investigation_events, findings, evidence_crops, evidence_frames, uploads, customer_submissions, customer_access, claims, visits RESTART IDENTITY CASCADE",
);
const loaded = loadManifest(ctx.env.manifestPath);
const seededVisits = await seedFromManifest(ctx.db, loaded.manifest);
return { deletedArtifacts, seededVisits };
~~~

Create the unprotected POST route and use handleError for failures. Add a destructive Reset demo data button at the employee home. Only issue apiPost("/api/employee/reset", {}) after window.confirm returns true. Display completion count/error and reload the queue after success.

- [ ] **Step 4: Verify reset safety**

Run: npm run test:run -- tests/integration/reset.test.ts tests/unit/employee-reset.test.tsx && npm run typecheck

Expected: PASS; cancellation sends no request and unrelated Blob keys survive.

- [ ] **Step 5: Commit reset behavior**

~~~bash
git add lib/claims/reset.ts app/api/employee/reset/route.ts app/employee/page.tsx tests/integration/reset.test.ts tests/unit/employee-reset.test.tsx
git commit -m "feat: add hosted ClaimLens demo reset"
~~~

## Task 7: Update documentation, scripts, and production verification

**Files:**

- Modify: README.md
- Modify: demo.md
- Modify: .env.example
- Modify: scripts/reset.ts
- Modify: scripts/seed.ts
- Modify: tests/smoke.test.ts

**Interfaces:**

- Documentation lists the actual Vercel setup and explicitly identifies the intentionally vulnerable areas: only the base employee page is protected and reset API is not protected.

- [ ] **Step 1: Write a failing environment-example smoke test**

~~~ts
it("documents server-side Vercel persistence variables", () => {
  const example = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
  expect(example).toContain("EMPLOYEE_USERNAME=");
  expect(example).toContain("EMPLOYEE_PASSWORD=");
  expect(example).toContain("DATABASE_URL=");
  expect(example).toContain("BLOB_READ_WRITE_TOKEN=");
});
~~~

- [ ] **Step 2: Run and verify it fails until docs are complete**

Run: npm run test:run -- tests/smoke.test.ts

Expected: FAIL if any required variable remains undocumented.

- [ ] **Step 3: Document the deployment and remove obsolete local persistence guidance**

Update README and demo runbook with these exact steps:

1. Create/connect a private Vercel Blob store.
2. Set server-only employee credentials and DATABASE_URL for Preview and Production.
3. Configure Blob with BLOB_READ_WRITE_TOKEN locally or Vercel OIDC plus BLOB_STORE_ID on Vercel.
4. Enable Automatically expose System Environment Variables so VERCEL_URL resolves customer links to the current deployment.
5. Explain Preview and Production share Neon by design.
6. Explain reset deletes only claimlens/ data and re-seeds fixture visits.
7. Explain only still images are supported; Vercel has no ffmpeg-based video path.
8. State that the base employee page is Basic-Auth protected but nested employee paths, APIs, and reset are intentionally unprotected for this hackathon.

Replace local filesystem reset/seed scripts with scripts that invoke the new async context/reset behavior using server-side variables. Remove EMPLOYEE_ACCESS_TOKEN, better-sqlite3, automatic startup purge, and tunnel-only configuration advice. Never write the supplied Neon URL into a tracked file.

- [ ] **Step 4: Run the final verification commands**

Run: npm run test:run && npm run typecheck && EMPLOYEE_USERNAME=demo EMPLOYEE_PASSWORD=demo DATABASE_URL=postgresql://placeholder BLOB_READ_WRITE_TOKEN=placeholder npm run build

Expected: all tests/typecheck PASS and build reaches normal Next compilation without a missing-variable failure.

For Vercel acceptance testing: deploy with real project secrets, visit /employee and verify the Basic Auth prompt, create a claim, verify its customer URL starts with that deployment hostname, submit three image files, verify authorized artifact delivery, then use reset and confirm fixture plates reappear.

- [ ] **Step 5: Commit deployment handoff**

~~~bash
git add README.md demo.md .env.example scripts/reset.ts scripts/seed.ts tests/smoke.test.ts
git commit -m "docs: document ClaimLens Vercel deployment"
~~~

## Plan self-review

- Spec coverage: Task 2 covers exact-route auth, required runtime config, and VERCEL_URL. Tasks 1, 3, and 4 cover the Neon migration. Tasks 1 and 5 cover private Blob and image-only evidence. Task 6 covers the intentionally unprotected reset UI/API, prefix safety, truncation, and reseeding. Task 4 replaces untracked background work with after(). The per-instance customer session key is intentionally unchanged by the Global Constraints.
- Placeholder scan: no unresolved implementation marker, deferred requirement, or unspecified test is present.
- Type consistency: Task 1 introduces Database and ArtifactStore before Task 3 context, Task 4 repositories/services, Task 5 evidence, and Task 6 reset consume them.
