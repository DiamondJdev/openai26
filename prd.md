# ClaimLens — Hackathon MVP PRD (v2)

**Event:** OpenAI Build Week · **Format:** one-day in-person hack night (~6–8 hrs) · **Team:** 3–4 people
**Scope:** one car wash, one fixed rig of 3 cameras (entrance / mid-tunnel / exit)

## What changed from v1, and why it's actually less work

- **Postgres → SQLite.** No server to provision, one file on disk.
- **"Arbitrary camera counts" → exactly 3, fixed, known positions.** This quietly kills the hardest problem in the original doc — cross-camera vehicle *tracking*. With 3 known checkpoints in a fixed order, there's nothing to track: you just pull the clip near the incident timestamp from each of the 3 feeds and let vision confirm it's the same car.
- **Python/FastAPI + Next.js → single Next.js/TypeScript app.** One language, one deploy target, no frontend/backend split to keep in sync mid-hackathon.
- **YOLO + GPT hybrid → GPT-5.6 only.** This is the big one: every step (reading a frame, comparing before/after, deciding what to look at next) is now a model call instead of a parallel classical-CV pipeline. Less code, not more — and it's the honest version of "why Codex," since the reasoning about *what to investigate next* is now genuinely done by the model, not by your control flow.

---

## 1. Executive Summary

ClaimLens is an investigation agent that answers "did our wash damage this customer's vehicle?" by reasoning over footage from a fixed 3-camera rig — entrance, mid-tunnel, exit — instead of a manager scrubbing through DVR footage by hand.

## 2. Problem

Manually investigating a damage claim means finding the right footage across 3 cameras, figuring out which vehicle is the customer's, comparing before/after, and writing it up. Slow, inconsistent, and it happens after every complaint. The footage already has the answer; nobody's asking it the question.

## 3. Vision

Turn 3 passive security cameras into one investigator you can ask "what happened?" and get an evidence-backed answer in under a minute.

## 4. Goals

- Cut investigation time from ~30–60 minutes to under 1 minute.
- Produce a report that cites its evidence, not just a verdict.
- Demonstrate genuine agentic reasoning — the model decides what to check, not a hardcoded sequence.

*(Dropped "reduce fraudulent claims" as a stated goal — it reads adversarial toward the customer if it slips into the pitch. The tool answers the question fairly either way; that's the better story.)*

## 5. Target User

Car wash manager, one location, one camera rig. (Multi-site is Phase 2, not this build.)

## 6. User Story

Customer says "your wash scratched my rear bumper." Manager types that into ClaimLens with the approximate time and vehicle description. ClaimLens investigates and returns a report in under a minute.

---

## 7. The Investigation Agent

This replaces the old fixed 7-step pipeline. One GPT-5.6 agent, given the claim, decides its own investigation path using a small tool set — this is both simpler to build than a branching pipeline and the actual point of the project.

**Tools available to the agent:**

| Tool | What it does |
|---|---|
| `get_clip_window(camera, timestamp, ±seconds)` | Pulls the relevant slice of footage from one of the 3 fixed cameras |
| `extract_frame(camera, timestamp)` | Grabs a single still frame from a clip (via ffmpeg) |
| `analyze_frame(image, question)` | Asks GPT-5.6 vision a specific question about one frame ("does this match a blue Honda Civic?", "any visible damage?") |
| `compare_frames(image_a, image_b, question)` | Asks GPT-5.6 vision to compare two frames ("is there new damage here that wasn't in the earlier frame?") |
| `save_finding(claim_id, observation)` | Writes a structured finding to SQLite |
| `generate_report(claim_id)` | Compiles saved findings into the final report |

**Example agent trace** (this is worth streaming live in the UI during the demo — watching it reason is the actual pitch):

```
Claim: "Your wash scratched my rear bumper" — blue Honda Civic, ~10:32am

1. get_clip_window(entrance, 10:32, ±90s)          → 3 vehicles in window
2. analyze_frame(...) x3 "match: blue Honda Civic?" → match at 10:32:11
3. extract_frame(entrance, 10:32:14)                → pre-wash frame
4. analyze_frame(pre-wash, "visible damage/accessories?")
      → "existing dent, rear-left panel; roof rack present"
5. get_clip_window(mid_tunnel, 10:32:50, ±30s)      → confirm same vehicle
6. analyze_frame(tunnel frame, "abnormal equipment contact?")
      → "no abnormal contact observed"
7. extract_frame(exit, 10:33:40)                    → post-wash frame
8. compare_frames(pre-wash, post-wash, "new damage near rear bumper?")
      → "no new damage; existing dent unchanged"
9. save_finding(...) x4
10. generate_report(claim_id)
```

## 8. Example Output

```
Investigation Summary — Incident CW-1048
Vehicle: Blue Honda Civic
Investigation time: 41 seconds

Timeline
10:32:11  Vehicle enters (entrance cam)
10:32:21  Roof rack noted
10:32:55  Mid-tunnel — no abnormal contact
10:33:40  Vehicle exits (exit cam)

Findings
- Existing dent, rear-left panel, visible before wash
- No abnormal equipment contact observed mid-tunnel
- No new damage detected between pre- and post-wash frames

Conclusion: No evidence the wash caused new damage.
Confidence: High — 3/3 checks consistent, no conflicting observations
```

Note the confidence line is now derived from how many checks agreed, not a bare self-reported percentage — that was a real credibility risk in v1 if a judge asked "94%, calculated how?"

**Demo tip carried over from the review:** don't only demo the exonerating case. Prep a second, shorter pass where the agent *does* find new damage. A tool that only ever says "not our fault" undermines its own credibility.

## 9. Functional Requirements

- The system shall pull the relevant clip window from each of the 3 fixed cameras given an incident timestamp.
- The system shall use GPT-5.6 vision to identify and confirm the vehicle in question across the 3 feeds.
- The system shall use GPT-5.6 vision to describe visible condition/accessories in extracted frames.
- The system shall use GPT-5.6 vision to compare pre- and post-wash frames for new damage.
- The system shall orchestrate the investigation via GPT-5.6 tool-calling — the model chooses which frames/cameras to examine, not a hardcoded sequence.
- The system shall store claims and findings in SQLite.
- The system shall generate a report citing the specific frames/timestamps behind each finding.

## 10. Nonfunctional Requirements

- Response time: under 60 seconds per investigation.
- Storage: SQLite for metadata, local filesystem for footage/frames. No cloud DB.
- Scope: single camera rig, single location. No multi-site support in this build.
- Explainability: every finding in the report must reference the frame/timestamp it came from.

## 11. Tech Stack

- **Frontend + Backend:** Next.js (App Router), TypeScript, Tailwind — one app, one deploy target. Backend logic lives in Route Handlers, no separate service.
- **Agent orchestration + vision + reasoning:** OpenAI Responses API, GPT-5.6, function/tool calling for everything in Section 7.
- **Frame extraction:** ffmpeg, called from a small Node wrapper.
- **Storage:** SQLite via `better-sqlite3` (or Prisma if the team prefers an ORM); footage and extracted frames on local disk.
- **Dev tool:** Codex CLI — feed it this PRD section-by-section as the goal spec and let it scaffold the Route Handlers, tool functions, and report UI; the team reviews and steers rather than hand-writing boilerplate.
- **Deployment:** run locally, tunnel with ngrok for the demo. No Docker, no Vercel, no Railway — there's one audience and one showing.

## 12. Why This Maximizes Codex/GPT Usage

Two layers, both real:

1. **Build-time:** Codex CLI writes most of the actual code — this PRD (specifically Sections 7, 9, and 11) is written to be handed to Codex directly as a goal spec, section by section, rather than translated by a human first.
2. **Run-time:** every investigative step is now a GPT-5.6 call — vision analysis, before/after comparison, and critically, the *decision of what to check next* — instead of the old YOLO-plus-hardcoded-pipeline split. That last part is the actual differentiator versus the commercial incumbents in this space (Spot AI, LiveReach, Ravin), which are built on classifier pipelines that help a human find footage. This is a model that decides.

## 13. Hour-by-Hour Build Plan (3–4 people)

| Time | Focus | Who |
|---|---|---|
| Hr 0–1 | Scaffold Next.js app via Codex; SQLite schema (`claims`, `findings`); load sample footage | Whole team together, then split |
| Hr 1–3 | Build the 6 tools + Responses API tool-calling loop | 2 people (agent/backend) |
| Hr 1–3 | Build claim-intake UI + live "agent trace" view | 1 person (frontend) |
| Hr 3–4 | Report generation + rendering | Backend person + frontend person converge |
| Hr 4–5 | Wire real footage in, run both demo scenarios (clean + damage-found) end to end | Whole team |
| Hr 5–6 | Fix what breaks — something will | Whole team |
| Hr 6–7 | Polish UI, tighten the report format, rehearse the pitch | 1 person on pitch, rest on polish |
| Hr 7–8 | Buffer + full run-through | Whole team |

## 14. Demo Flow

1. Show the 3 fixed camera views briefly to establish the real setup.
2. Type in a customer complaint.
3. Show the agent's tool-call trace streaming live — this is the "watch it think" moment, don't skip it.
4. Show the final report.
5. Second, quick pass: a scenario where it *does* find damage, to prove it's not just a "no" machine.
6. Close: "Security cameras already record the truth. ClaimLens gives businesses an AI investigator that can understand it."

## 15. Pre-Hackathon Prep (do this before Saturday, not during)

- Record entrance / mid-tunnel / exit footage for 2–3 test vehicles at a real self-serve wash: one clean pass, one with a pre-existing mark, one with genuine light contact for the "damage found" scenario.
- Get OpenAI API keys and confirm access to GPT-5.6 vision + Responses API tool calling ahead of time.
- Pre-install Node, ffmpeg, and Codex CLI on every laptop.
- Assign the Hour-by-Hour roles above before the clock starts.

## 16. Cut From v1 — explicit changelog

- YOLO / classical object detection and tracking — replaced entirely by GPT-5.6 vision calls.
- Postgres — replaced by SQLite.
- "Support arbitrary camera counts" — this build targets exactly one 3-camera rig.
- Docker + Vercel + Railway/Fly.io split deployment — replaced by local + ngrok.
- The hard "system shall track vehicle across cameras" requirement — replaced by per-camera GPT-5.6 vehicle-match confirmation, which is honest about what's actually happening and doesn't promise a harder CV problem than you're solving.