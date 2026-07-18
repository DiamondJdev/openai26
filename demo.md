# ClaimLens — Demo Runbook

A ~3-minute live demo of the full claim lifecycle: an employee starts a
plate-based claim on the **laptop**, the customer submits their intake on a
**phone** using the deployed private link, the employee runs the three-camera
investigation and watches the agent reason live, then releases the cited report
to the customer's phone.

Two devices:
- **Laptop** → employee console (`/employee`)
- **Phone** → customer flow (the private `/c/<link>` on the current deployment)

---

## 1. Before you start (prereqs)

- An **OpenAI API key** with GPT-5.6 vision + Responses tool calling. The live
  investigation is real-model-only — without a key it routes to manual review.
- The **wash footage wired in** (see step 3). Without footage the agent can't
  extract frames and will route to manual review.
- A deployed Vercel URL that both the laptop and phone can reach.

---

## 2. Configure `.env.local`

```bash
cp .env.example .env.local
```

Set these values:

```bash
OPENAI_API_KEY=sk-...                 # your key
CLAIMLENS_MODEL=gpt-5.6               # confirm this is the model id your account exposes
EMPLOYEE_USERNAME=demo-operator       # server-only console sign-in name
EMPLOYEE_PASSWORD=<strong-password>   # server-only console sign-in password
DATABASE_URL=postgresql://...          # Neon database shared by the hosted demo
BLOB_READ_WRITE_TOKEN=...             # local `npm run seed` / `npm run reset` only
# Leave CLAIMLENS_PUBLIC_BASE_URL unset on Vercel to use the active VERCEL_URL.
```

For the hosted deployment, configure `EMPLOYEE_USERNAME`,
`EMPLOYEE_PASSWORD`, `DATABASE_URL`, and `OPENAI_API_KEY` as server-only
Preview and Production variables. Connect a private Vercel Blob store, enable
Vercel OIDC, and set `BLOB_STORE_ID`; Vercel supplies `VERCEL_OIDC_TOKEN`.
Enable **Automatically expose System Environment Variables** so `VERCEL_URL`
generates customer links for the current deployment. Preview and Production
intentionally use the same Neon database.

---

## 3. Wire the footage

Two demo plates are pre-seeded in `fixtures/manifest.json`. Drop your stills so
each camera has a file, then confirm the filenames match the manifest:

```
fixtures/footage/demo-clean/    entrance.png  mid.png  exit.png    → plate 7GAB991  (car,    clean pass)
fixtures/footage/demo-damage/   entrance.png  mid.png  exit.png    → plate 8XYZ204  (pickup, new damage)
```

If you only have before/after pairs, map `before → entrance` (+ `mid`) and
`after → exit`, and edit `fixtures/manifest.json` to point at your real
filenames (`"kind": "image"`). ClaimLens supports still images only; the
Vercel deployment has no ffmpeg-based video path. Optionally verify the seed:

```bash
npm run seed        # prints how many visits were seeded from the manifest
```

> There is no startup purge. The hosted employee dashboard has a protected reset
> control: it deletes only ClaimLens database rows and `claimlens/` Blob
> artifacts, then re-seeds these fixture visits. Because Preview and Production
> share Neon, reset deliberately affects the shared demo data.

---

## 4. Start the hosted demo

Deploy the configured Vercel project. Do not set `CLAIMLENS_PUBLIC_BASE_URL`
unless you need a fixed custom domain: `VERCEL_URL` supplies the active host.

- **Laptop:** open `https://<deployment-host>/employee` → redirected to
  `/employee/login` → enter `EMPLOYEE_USERNAME` and `EMPLOYEE_PASSWORD`.
- **Phone:** you'll open the private customer link generated in beat 1 below.

> A signed, expiring employee session protects every employee page and API
> after login, including the hosted reset API. Only `/employee/login`,
> `/api/employee/login`, and `/api/employee/logout` are reachable without that
> session.

---

## 5. The live demo

### Scenario A — clean pass (plate `7GAB991`)

1. **Start the claim (laptop).** In `/employee`, enter plate **`7GAB991`** and a
   complaint note ("customer says the rear bumper was scratched") → **Create
   claim & get link**. Copy the **private link** and **PIN** (shown once).
   Relay them to the phone (text / AirDrop / paste into a QR generator).
2. **Customer submits (phone).** Open the link → enter the **PIN** → fill name,
   email, phone → take/upload the **plate, odometer, insurance** photos → check
   **consent** → **Submit claim**. The phone now shows *"We're reviewing your
   claim."*
3. **Pick it up (laptop).** The claim appears in the **live queue** as *Ready to
   investigate*. Open it — you'll see the customer's details and photos. On the
   car/pickup diagram, confirm the **vehicle type** and tap the reported
   **damage areas** (e.g. Rear bumper) → **Start investigation**.
4. **Watch it think (laptop).** The plain-language trace streams live: pulls the
   clip window, confirms the vehicle, extracts entrance/exit frames, compares
   before/after, saves each finding with its evidence, then compiles the report.
   Expand a step to show the camera, timestamp, and evidence frame behind it.
   **This is the moment — don't rush it.**
5. **Release (laptop).** The report shows the conclusion, a cited timeline, and a
   confidence line derived from how many checks agreed. Leave **Share evidence
   photos** off (or flip it on to include the focused entrance/exit crops) →
   **Release report (unchanged)**. (Note you can only release or hold — never
   edit the conclusion.)
6. **Result (phone).** The customer's page flips from "under review" to the
   approved conclusion, any shared crops, and outcome-based contact cards.

### Scenario B — new damage found (plate `8XYZ204`)

Run the same beats quickly with plate **`8XYZ204`** (pickup). Here the agent
*does* find new damage, so the report concludes **new damage detected** — proof
it isn't just a "not our fault" machine. Release with **Share evidence photos**
on to show the before/after crops on the customer's phone.

---

## 6. Pitch & closing

- **The one-liner going in:** "Three passive security cameras already record the
  truth of every wash. Nobody's asking them the question."
- **During beat 4:** narrate that the model is *deciding what to check next* —
  which camera, which frame, what to compare — not following a hardcoded script.
  That decision loop is the point.
- **On credibility:** the confidence line is derived from agreeing checks, and
  every finding in the report cites the exact frame and timestamp it came from —
  it's an evidence-backed answer, not a verdict.
- **Closing line:** *"Security cameras already record the truth. ClaimLens gives
  businesses an AI investigator that can understand it."*
