# BlackBox — 3-Person Task Split & Hackathon Win Strategy

This assumes all three of you share the same `01-antigravity-build-prompt.md` and `AGENT.md` as the single source of truth — nobody invents their own data model or their own idea of what a field is called. That shared contract is what lets three people build in parallel without the classic hackathon disaster of "your API doesn't match my frontend at 3am."

## 1. Why split by feature, not by layer

The instinct is to split "one frontend person, one backend person, one database person." Don't. That creates a chain of blockers — the frontend person sits idle waiting on the backend person, and nobody owns a demo-able feature end to end. Instead, split by **vertical slice**: each person owns their domain's data model + API + UI, top to bottom. That's genuinely equal weightage (each owns ~⅓ of the domain model and a full-stack surface), and each person can demo their own piece independently at any checkpoint — which also means if one person falls behind, it doesn't block the other two.

## 2. The Three Tracks

### Track A — Identity, Cases & Foundation *(the spine everyone depends on)*
**Owns:** `User`, `Case` models · Auth (JWT + bcrypt) · RBAC middleware · Audit logging middleware · Case lifecycle transition engine · Case list/detail UI + lifecycle actions · Admin user management screen

**Why this is equal weight, not "the boring one":** this person builds the middleware everyone else's routes depend on (auth guard, RBAC check, audit logger), so their code ships first and becomes infrastructure. Getting the lifecycle transition matrix airtight (with tests) is also a genuine judging-visible feature — a rigorous, guarded workflow reads as "production-grade" to judges, not a toy CRUD app.

### Track B — Evidence & Verification *(the trust layer)*
**Owns:** `Evidence` model · chain-of-custody tracking · file metadata handling/upload · verification workflow (pending → verified/rejected) · Evidence board UI · search/filter/pagination (built once here, then reused as a pattern by Track C)

**Why this is equal weight:** verification is the credibility mechanic of the entire app — it's what makes the hypothesis engine meaningful instead of decorative. Nailing the upload flow + chain-of-custody UI is also one of the more visually convincing parts of a live demo (uploading a piece of "evidence," watching it move through pending → verified).

### Track C — Relationships, Hypotheses & Intelligence *(the wow factor)*
**Owns:** `EvidenceRelationship` model · `Hypothesis` model · the confidence-score engine (the deterministic algorithm from the build prompt) · relationship graph visualization · hypothesis panel UI · admin statistics dashboard

**Why this is equal weight:** this is objectively the hardest logic (the scoring algorithm) and the most visually striking screen (a live evidence graph where a hypothesis's confidence score visibly moves as you verify or link evidence). It carries more "wow" but also more risk — treat this track's estimate generously and don't let it get starved of time by the others.

**Balance check:** each track = 2 data models (or 1 model + 1 engine), 1 middleware/algorithm-level challenge, and 1–2 UI screens. If anyone finishes early, they pull search/filter/pagination or polish work for another track rather than sitting idle.

## 3. Day 0 — Before Anyone Splits Off (1–2 hours, non-negotiable)

Do this together, in the same room/call, before writing feature code:

1. All three read `AGENT.md` and the build prompt together. Agree out loud on the field names, enums, and status values — don't let anyone start with a private assumption.
2. Set up the shared repo skeleton (folder structure from the build prompt), shared `.env.example`, shared lint/format config, shared test runner.
3. Track A stubs the Mongoose schemas for **all** models (even B's and C's) as bare skeletons with correct field names/types — this is the single shared contract file everyone codes against from minute one, even before the real logic exists behind it.
4. Agree on your API route naming convention and response envelope shape once, in writing (even a one-page `docs/api-conventions.md`), so nobody free-styles it.
5. Pick your demo case story now (see Section 5) — knowing what you're demoing shapes what seed data and what UI polish actually matters.

## 4. Checkpoints (adapt the hours to your actual hackathon length)

- **Checkpoint 1 (~25% of time):** Each track's data model + core API routes work in isolation (tested with Postman/curl, not yet wired to UI). Track A's auth + RBAC + audit middleware is usable by the other two tracks.
- **Checkpoint 2 (~55% of time):** Each track's UI is wired to its own API and demoable standalone. Integrate: Track B's evidence feeds into Track C's hypothesis linking.
- **Checkpoint 3 (~75% of time):** Full integration pass — one person walks the entire demo story end to end, across all three tracks, live in the shared app. Bugs found here are everyone's priority, not just the owning track's.
- **Checkpoint 4 (final stretch):** Feature freeze. No new features. Only: bug fixes, seed data polish, demo rehearsal, README/pitch polish.

Do not skip the freeze. The single biggest way hackathon teams lose is shipping a half-working new feature at minute 55 instead of a rock-solid version of what already works.

## 5. The Actual Win Strategy

Judges generally score on some mix of: **technical execution, innovation, completeness, UX/design, and presentation.** Here's how to hit all five without diluting effort three ways:

- **Innovation angle to pitch:** most hackathon CRUD apps store data. BlackBox *reasons* — it's the only project in the room where evidence you verify live-updates a confidence score and can flip a hypothesis's standing. Lead your pitch with that, not with the tech stack.
- **One scripted demo case, rehearsed cold.** Build one compelling, clearly-fictional case (e.g., a "corporate data leak" or "insurance fraud" scenario) with 5–8 pieces of evidence, 2–3 competing hypotheses, and a script where you: (1) show an unverified hypothesis sitting at a low/ambiguous score, (2) verify a piece of key evidence live in front of the judges, (3) show the score visibly move and the hypothesis status update, (4) show the audit trail proving nothing happened invisibly. That live "watch it update" moment is your single best 20 seconds — protect it, test it repeatedly before you're on stage.
- **Assign a demo lead now, not on the day.** One person presents the narrative, the other two are on standby to answer technical deep-dive questions or to drive a backup laptop if the live demo breaks. Rehearse the handoffs.
- **Have a recorded backup of the live demo.** Wifi and projectors fail. A 60-second screen recording of the exact same flow as a fallback is not cheating, it's professionalism.
- **Polish beats scope, every time, in the last quarter of your clock.** A judge remembers a clean, confident, bug-free walkthrough of 70% of the features far better than a stuttering walkthrough of 100% of them.
- **Say what's not done, confidently, if asked.** Per your own `AGENT.md` rules, don't fake completeness — judges respond well to "here's what we prioritized and why, here's what we'd build next" far better than a vague dodge when a feature breaks under questioning.

## 6. Individual Kickoff Briefs — Send Each Person Their Own

Copy-paste the relevant block below to each teammate so they can start immediately without waiting on a meeting.

---
**To: Track A owner — Identity, Cases & Foundation**
You own the spine everyone else builds on: `User` + `Case` models, JWT auth, RBAC middleware, audit-logging middleware, and the case lifecycle transition engine (with its exact allowed-transitions matrix — see build prompt Section 4). Ship auth + RBAC + audit middleware first; the other two tracks are blocked on it. Then build the Case list/detail UI with lifecycle action buttons gated by role, and the admin user-management screen. Read `AGENT.md` Sections 4 and 5 closely — the transition matrix and audit logging are the two places judges will probe with "what if I try to skip a step" questions.

---
**To: Track B owner — Evidence & Verification**
You own the trust layer: `Evidence` model, chain-of-custody tracking, file metadata upload handling, and the verify/reject workflow. Build the evidence board UI (list + upload + status badges) and the search/filter/pagination pattern — build it clean here since Track C will copy your pattern for hypotheses rather than reinventing it. Coordinate with Track A early on what the auth middleware hands you (req.user shape) so you're not guessing.

---
**To: Track C owner — Relationships, Hypotheses & Intelligence**
You own the hardest and most visible piece: `EvidenceRelationship` + `Hypothesis` models and the confidence-score engine from build prompt Section 5 — implement it exactly, don't approximate, and write the unit tests for it first (all-supporting, all-contradicting, mixed, unverified-excluded, corroboration-boost, conflict-flagging) before wiring up UI, because this is the logic most likely to have a subtle bug that embarrasses you live. Then build the relationship graph view and hypothesis panel — this is your team's single best demo moment, so budget real time for making the "score visibly updates" interaction feel smooth and fast, not just correct.

---

## 7. Ground Rules to Actually Win, Not Just Finish

- No one merges to the shared branch without at least glancing at whether it breaks another track's integration point.
- Keep a shared running doc (even a Slack/Discord pinned message) of "assumptions I made" per `AGENT.md` Section 3 — surprises at integration time are the #1 time-killer.
- If a track is going to miss a checkpoint, say so the moment you know, not at the checkpoint — the other two need time to route around it.
- Nobody touches new features during the feature freeze. That discipline, more than any single feature, is what separates teams that demo well from teams that don't.
