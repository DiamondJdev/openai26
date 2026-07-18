# ClaimLens

An AI investigator for car-wash damage claims. Three fixed cameras (entrance /
mid-tunnel / exit) already record the truth; ClaimLens reasons over the footage
with GPT-5.6 and answers, with cited evidence, whether the wash caused new
damage — in under a minute.

One local Next.js/TypeScript app covers the full claim lifecycle:

1. **Employee** starts a plate-based claim and shares a private link + PIN.
2. **Customer** enters the PIN and submits a private intake packet (name, email,
   phone, plate/odometer/insurance photos, consent).
3. **Employee** marks the reported damage areas and runs the three-camera
   investigation, watching the agent's plain-language trace live.
4. **Employee** releases the immutable report — optionally with focused
   before/after crops — or holds it for manual review.

## Stack

- Next.js (App Router) + TypeScript + Tailwind — one app, one deploy target.
- Neon Postgres for claims and private Vercel Blob for uploads, frames, and crops.
- OpenAI Responses API (GPT-5.6) with function tools for the agent + vision.
- Still-image fixture sources plus `sharp` for re-encoding and crops.

## Prerequisites

- Node 20+.
- A Neon `DATABASE_URL` and a private Vercel Blob store.
- An OpenAI API key with GPT-5.6 vision + Responses tool calling for live runs.

## Setup

```bash
npm install
cp .env.example .env.local   # set DATABASE_URL, Blob credentials, and OPENAI_API_KEY
```

Drop the before/after wash images under `fixtures/footage/` and point
`fixtures/manifest.json` at them (see `fixtures/README.md`).

## Run

```bash
npm run dev      # http://localhost:3000  → /employee for the console
npm run reset    # explicitly wipe ClaimLens database rows and private artifacts
npm run seed     # idempotently seed manifest visits into Neon
```

For local development, set `BLOB_READ_WRITE_TOKEN` in `.env.local`. Set
`CLAIMLENS_PUBLIC_BASE_URL` only when you need to override the generated
customer-link host; otherwise it uses `VERCEL_URL` on Vercel and localhost
locally.

## Deploy to Vercel

1. Create or connect a **private Blob store** in the Vercel project. ClaimLens
   stores uploads, extracted frames, and crops under `claimlens/`; it does not
   use public Blob URLs.
2. Connect a Neon database and set `DATABASE_URL` for both Preview and
   Production. **Preview and Production share the same Neon database by
   design**, so a reset from either deployment resets the shared demo data.
3. Set `EMPLOYEE_USERNAME`, `EMPLOYEE_PASSWORD`, `DATABASE_URL`, and
   `OPENAI_API_KEY` as server-only values for Preview and Production. Do not
   prefix these with `NEXT_PUBLIC_`.
4. For Vercel Blob access, enable Vercel OIDC and provide `BLOB_STORE_ID`; the
   deployed app uses Vercel's `VERCEL_OIDC_TOKEN`. For local commands, use
   `BLOB_READ_WRITE_TOKEN` instead. The example environment file lists both
   modes without containing a secret.
5. In Vercel project settings, enable **Automatically expose System Environment
   Variables**. This makes `VERCEL_URL` available, allowing each claim's
   customer link to use the hostname of the deployment that created it. Leave
   `CLAIMLENS_PUBLIC_BASE_URL` unset on Vercel unless a fixed custom hostname is
   required.

After deploying, visit `/employee`. Staff sign in at `/employee/login` using
the configured username and password. Successful login creates a signed,
expiring employee session cookie. That session protects every employee page and
API, except `/employee/login`, `/api/employee/login`, and
`/api/employee/logout` (which clears the cookie). The login route has a small
in-memory per-instance attempt limiter; that simplicity is an intentional
hackathon tradeoff.

The employee dashboard contains a **protected employee reset control**. It
deletes only ClaimLens database rows and `claimlens/` Blob artifacts, then
re-seeds the fixture visits. It does not delete the Blob store, the Neon
database, or unrelated records. Because Preview and Production share Neon,
treat that button as a reset of the hosted demo, not an isolated Preview reset.

Footage sources must be **still images**. Vercel has no ffmpeg-based video path
in this application, so video footage is not supported.

## Test & verify

```bash
npm run test:run   # unit + integration + e2e (Vitest)
npm run typecheck
npm run build
```

## Security & privacy posture

- Link tokens and PINs are stored only as hashes; failed PINs are throttled.
- Uploads are validated, re-encoded (metadata stripped), and **never** sent to
  the model — only extracted footage frames are.
- The manager note is passed to the model as untrusted data, never instructions;
  every model tool argument is schema-validated and scoped to the claim.
- Reports are generated only from findings that cite stored evidence.
- Artifact pathnames remain private under `claimlens/`; image bytes are served
  only after the appropriate customer or employee authorization check.
- No startup purge occurs. `npm run reset` is an explicit destructive operation.
