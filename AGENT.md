# AGENT.md — Operating Rules for This Project

These rules govern every action taken in this repository. They apply to code generation, file edits, dependency choices, documentation, and any explanation given to the user. They override generic habits or defaults — if a general instinct conflicts with a rule below, the rule below wins.

## 1. Tech Stack Lock

- Frontend: **Svelte (SvelteKit)** only.
- Backend: **Express.js** only.
- Database: **MongoDB** (via Mongoose) only.
- Do not introduce React, Vue, Angular, Next.js, Nest.js, GraphQL, Prisma, Postgres, MySQL, Firebase, Supabase, or any other framework/database — even as a "lighter alternative," even for a single small feature — without stopping and explicitly asking first.
- Do not add a dependency that isn't necessary to satisfy a stated requirement. Before adding any package, state in the response why it's needed. If a requirement can be met with what's already installed, don't add a new library "just in case."

## 2. No Fabricated Data, Ever

- Never write hardcoded fake statistics, fake user counts, fake case counts, or placeholder numbers into any component, route, or seed value that could be mistaken for real computed output. If a dashboard needs numbers before real data exists, either (a) compute them from an empty/seeded dev database honestly (so they show `0`), or (b) clearly label the UI state as "No data yet," never a made-up number like "1,204 cases processed."
- Seed scripts are allowed for local development but must be clearly named (`seed.dev.js` or similar), must never run against a non-development environment, and must be described in the README as synthetic test data, not real output.
- Never invent an API response shape, a third-party library's function signature, or a MongoDB/Mongoose method that doesn't exist. If unsure whether a method or option exists, say so and verify against documentation rather than guessing and presenting it as fact.
- Never claim a test passed, a build succeeded, or a feature was verified working unless it was actually run and the output is shown. If something wasn't run, say "not yet run" — don't imply it was.

## 3. When Requirements Are Ambiguous or Underspecified

- Do not silently invent business rules that aren't in the spec (e.g., don't decide on your own that "under_review" cases auto-expire after 7 days — that wasn't asked for).
- If a genuine ambiguity blocks correct implementation (not just a minor styling choice), stop and ask a specific question rather than guessing and moving forward. Minor implementation details (variable naming, folder layout within reason, exact HTTP status code for an edge case) can be decided and documented — don't ask about those.
- When a decision is made without an explicit instruction (e.g., choosing Zod over Joi, choosing offset over cursor pagination), write it down in the README under "Implementation Decisions" so the user can see what was decided and why.

## 4. Data Model & Business Logic Fidelity

- Implement the domain model (User, Case, Evidence, EvidenceRelationship, Hypothesis, AuditLog) exactly as specified in the build prompt — same fields, same enums, same relationships. Do not rename fields, drop fields, or add extra fields that weren't requested without flagging it.
- The case lifecycle transition matrix and the hypothesis confidence-score algorithm are the two pieces of logic most likely to get silently approximated under time pressure. Do not approximate them. If the exact algorithm as specified seems to produce an edge case you're unsure how to handle (e.g., a hypothesis with zero linked evidence), state the edge case explicitly and propose a specific, documented resolution rather than quietly picking something.
- Role-based access control must be enforced server-side on every protected route. A frontend that merely hides a button is not access control — do not present it as if it were.

## 5. Audit Trail Discipline

- Every mutating action (create, update, delete, status transition, verification decision, role change, login) must produce a real AuditLog entry written to the database, not a console log or a comment saying "would log here."
- Do not stub out audit logging "for now" and present the feature as done. If audit logging for a specific action is genuinely deferred, say so explicitly rather than leaving it silently unimplemented.

## 6. Testing & Verification

- The confidence-score algorithm must have dedicated unit tests covering: all-verified-supporting, all-verified-contradicting, mixed evidence, unverified evidence (should not count), corroborating relationships (should boost), conflicting evidence (should flag, not silently cancel).
- Lifecycle transitions must have tests confirming both allowed transitions succeed and disallowed transitions are rejected.
- Before reporting a phase as "complete," run the tests for that phase and show the actual output. If tests fail, report the failure honestly and either fix it or flag it as a known issue — do not report completion while a test is failing.

## 7. Incremental, Reviewable Delivery

- Follow the phased delivery order given in the build prompt. Do not generate the entire application in one giant pass and present it as finished — build in phases, and after each phase summarize: what was built, what was explicitly deferred, and any assumptions made.
- Keep commits/changes scoped to the phase in progress so the user can review incrementally rather than facing one enormous diff.

## 8. Communication Standards

- When describing what was built, be precise about what actually exists versus what is planned. Don't describe a planned feature in the same tense as a completed one.
- If a limitation exists (e.g., "file storage is local disk only, not cloud-backed in this build"), state it plainly in the README's "Known Limitations" section — don't bury it or omit it.
- Do not claim security guarantees that weren't actually implemented (e.g., don't say "fully production-hardened" unless rate limiting, input sanitization, secret management, and HTTPS-readiness were all actually done and can be pointed to in the code).

## 9. Environment & Secrets

- Never hardcode a JWT secret, database URI, or any credential into source code. Always source from environment variables with a `.env.example` showing the required keys with placeholder (non-functional) values.
- Never commit a real `.env` file.

## 10. When In Doubt

Prefer under-claiming and asking over over-claiming and guessing. A feature that is honestly reported as "not yet implemented" is far more useful to the user than a feature that is silently faked and presented as working.
