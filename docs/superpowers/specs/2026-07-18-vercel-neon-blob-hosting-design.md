# Vercel hosting, Neon, and Blob design

## Purpose

Make ClaimLens deployable on Vercel for a short-lived hackathon. Protect only
the `/employee` landing page with a shared username and password, generate
customer links for the current deployment, replace local SQLite persistence
with Neon Postgres, and move runtime files to private Vercel Blob storage.

## Decisions

- Authenticate exactly `/employee` with HTTP Basic Auth. Nested employee pages
  and every API route intentionally remain unprotected.
- Require `EMPLOYEE_USERNAME` and `EMPLOYEE_PASSWORD`; do not retain
  `EMPLOYEE_ACCESS_TOKEN`.
- Fail app configuration loading when either Basic Auth credential is absent or
  blank. `DATABASE_URL` and the Blob write credential are also required for a
  hosted application to run.
- Generate customer-link origins in this order:
  1. `CLAIMLENS_PUBLIC_BASE_URL` when explicitly set.
  2. `https://${VERCEL_URL}` for a Vercel deployment.
  3. `http://localhost:3000` for local development.
- Production and Preview deployments share one Neon database, by request.
- Use Neon Postgres directly through `@neondatabase/serverless`; do not add an
  ORM.
- Use one private Vercel Blob store for all customer uploads, evidence frames,
  and evidence crops. Blob pathnames, rather than public URLs, are stored in
  the database.
- The hosted demo supports still-image camera sources only. Video sources are
  rejected because Vercel does not supply the local `ffmpeg` binary used by the
  existing video extractor.
- Data persists until the employee explicitly resets the demo. Startup no
  longer purges data.

## Authentication and configuration

`middleware.ts` matches `/employee` only. It challenges unauthenticated
requests with a Basic Auth response and compares the decoded username and
password with `EMPLOYEE_USERNAME` and `EMPLOYEE_PASSWORD` in constant time.
No other route is matched.

`next.config.mjs` performs the startup/build preflight. Missing or blank
required variables cause `next dev`, `next build`, and `next start` to fail
before the server is usable. Required variables are:

- `EMPLOYEE_USERNAME`
- `EMPLOYEE_PASSWORD`
- `DATABASE_URL`
- `BLOB_READ_WRITE_TOKEN` (or the Vercel-provided private Blob runtime
  credential supported by the selected SDK version)

Credentials exist only in `.env.local` for local use and in Vercel project
settings for hosted environments. They are never given a `NEXT_PUBLIC_`
prefix, written to examples with a value, or returned from an API.

The Vercel project must expose system environment variables so `VERCEL_URL` is
available. `CLAIMLENS_PUBLIC_BASE_URL` remains an explicit override for local
and ngrok use.

## Postgres persistence

The current `better-sqlite3` database API is synchronous. Neon queries return
promises, so the database type, all repositories, and every service and route
that uses them become asynchronous. The migration uses parameterized tagged
template queries from `@neondatabase/serverless` and its non-interactive
transaction API where multiple changes must succeed together.

The schema is translated from SQLite to PostgreSQL with equivalent primary
keys, unique constraints, indexes, defaults, and foreign keys. JSON-encoded
domain fields remain JSON text unless a PostgreSQL JSON type makes the
repository mapping clearer without changing API behavior. Schema setup is
idempotent and safe to call at runtime; a database migration table records
applied migrations.

The migration removes `better-sqlite3` and local database paths from production
runtime configuration. Test utilities use an isolated Neon test schema or
branch, never the shared Preview/Production schema.

## Private Blob artifacts

Blob objects use ClaimLens-owned, opaque pathnames under a fixed prefix, such
as `claimlens/uploads/<claim-id>/<upload-id>.jpg` and
`claimlens/frames/<claim-id>/<frame-id>.jpg`. Every object is written with
private access. Database `stored_path` values become those pathnames.

The upload boundary continues to validate and re-encode customer images with
Sharp, but stores the resulting buffer with Vercel Blob rather than a local
file. Evidence extraction and crop generation operate on temporary buffers or
files in the request's temporary directory, then write their JPEG outputs to
private Blob. The current still-image fixture sources are bundled with the
Vercel function; the deployment configuration explicitly includes
`fixtures/**/*` in output tracing.

Customer crop and employee upload endpoints preserve their current authorization
behavior, loading the private blob server-side and streaming bytes only after
the relevant database and session checks. They never reveal Blob URLs.

When a visit source is a video, frame extraction returns a clear unsupported
source error before calling `ffmpeg`.

## Hosted reset

The employee home page gets a visible reset control with an explicit browser
confirmation. Its intentionally unprotected POST endpoint:

1. Deletes every private Blob object under the `claimlens/` prefix.
2. Truncates ClaimLens tables in dependency-safe order.
3. Reloads and validates the bundled footage manifest.
4. Re-seeds its demo visits.
5. Returns the seed result for display in the console.

The reset endpoint makes no attempt to synchronize with simultaneous claim
creation; concurrent requests are out of scope for the hackathon. It never
deletes objects outside the ClaimLens prefix.

## Error handling

- Configuration failures identify the missing variable name but never disclose
  a secret value.
- Database and Blob failures surface the existing generic API errors and are
  logged server-side.
- Missing or unauthorized private artifacts remain a `404` response.
- An unavailable Blob object during reset does not prevent the database from
  being re-seeded; reset reports failures accurately and leaves no false
  success state.
- Non-image footage sources fail with a direct, actionable validation error.

## Tests and verification

- Unit tests cover required-environment validation, Base URL precedence, and
  exact-route Basic Auth behavior.
- Repository integration tests cover Postgres CRUD, constraints, and
  transaction behavior against an isolated test schema or Neon branch.
- Artifact tests cover private Blob writes, authorized streaming, and rejection
  of unsupported video sources without invoking `ffmpeg`.
- Reset tests verify that only the ClaimLens Blob prefix is deleted, records
  are cleared, and fixture visits are re-seeded.
- Final verification runs the focused tests, full Vitest suite, TypeScript
  checks, and a production build with the required environment values.

## Deployment setup

In Vercel, set `EMPLOYEE_USERNAME`, `EMPLOYEE_PASSWORD`, `DATABASE_URL`, and
the private Blob credential for both Preview and Production. Create a private
Blob store and connect it to the project. Enable Automatically expose System
Environment Variables. Keep `DATABASE_URL` and Blob credentials server-only.

Before deployment, rotate the Neon connection password that was pasted into
the original conversation, then add the replacement only through Vercel's
secret environment-variable UI.
