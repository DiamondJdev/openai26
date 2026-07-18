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
- SQLite via `better-sqlite3`; footage/frames/uploads on local disk.
- OpenAI Responses API (GPT-5.6) with function tools for the agent + vision.
- `ffmpeg` for frame extraction, `sharp` for re-encoding and crops.

## Prerequisites

- Node 20+ and `ffmpeg` on PATH.
- An OpenAI API key with GPT-5.6 vision + Responses tool calling.

## Setup

```bash
npm install
cp .env.example .env.local   # set OPENAI_API_KEY (and CLAIMLENS_MODEL if needed)
```

Drop the before/after wash images under `fixtures/footage/` and point
`fixtures/manifest.json` at them (see `fixtures/README.md`).

## Run

```bash
npm run dev      # http://localhost:3000  → /employee for the console
npm run reset    # wipe all demo data (also happens automatically on startup)
npm run seed     # reset + re-seed the visit index from the manifest
```

For a remote demo, tunnel with ngrok and set `CLAIMLENS_PUBLIC_BASE_URL` to the
tunnel URL so generated customer links are reachable. **When tunneling, also set
`EMPLOYEE_ACCESS_TOKEN`** — exposing the customer link exposes the employee
routes too, and that token gates `/employee` + `/api/employee/*` behind HTTP
Basic auth (any username, password = the token). It is off by default for
trusted local use.

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
- All demo data (DB, frames, crops, uploads) is purged on startup/reset — no
  claim data survives a session.
