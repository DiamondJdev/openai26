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
- A Neon `DATABASE_URL` and Blob credentials (`BLOB_READ_WRITE_TOKEN` locally,
  or Vercel OIDC/store credentials when deployed).
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

Set `CLAIMLENS_PUBLIC_BASE_URL` to the deployed app URL so generated customer
links are reachable. Employee access is configured with `EMPLOYEE_USERNAME` and
`EMPLOYEE_PASSWORD`; `/employee` redirects authorized staff to the sign-in page
and the signed session protects employee APIs as well.

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
