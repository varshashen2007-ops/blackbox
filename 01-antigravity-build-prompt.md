# BlackBox — Digital Evidence Investigation Platform
### Master Build Prompt for Antigravity

Paste this entire document as the initial task/spec to Antigravity. It assumes `AGENT.md` (the companion file) is placed at the project root and loaded as the agent's standing operating rules before any code is written.

---

## 1. Mission

Build **BlackBox**, a production-grade digital evidence investigation platform where investigators collect, verify, and connect evidence to construct and evaluate competing hypotheses about a case. Evidence verification state and evidence-to-evidence/evidence-to-hypothesis relationships must **dynamically drive** hypothesis confidence — this is not a static CRUD app, it's a reasoning-support tool. Cases follow a strict, role-gated lifecycle. Every state-changing action is audited. Administrators get a monitoring surface over users, cases, and system-wide statistics.

## 2. Non-Negotiable Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | **Svelte** via **SvelteKit** | SvelteKit is the standard app framework for Svelte — use it for routing, layouts, and SSR-capable pages. Do **not** substitute React, Vue, Next.js, or any other frontend framework. |
| Backend | **Express.js** (Node.js) | REST API. Do not substitute Nest.js, Fastify, Koa, or GraphQL unless explicitly asked later. |
| Database | **MongoDB** via **Mongoose** | Use Mongoose schemas for validation/modeling. Do not substitute Postgres, MySQL, Prisma+SQL, or Firebase. |
| Auth | JWT (access + refresh token pattern), bcrypt for password hashing | No third-party auth providers unless asked. |
| State/Styling | Svelte stores for client state; plain CSS or a lightweight utility approach (your choice, document it) | No Tailwind config invention without saying so in the README. |
| Testing | Vitest (or Jest, pick one and be consistent) for backend; Vitest + @testing-library/svelte for frontend | |

If any requirement below seems to require a different tool, **stop and ask** rather than substituting silently (see `AGENT.md`, Section 3).

## 3. Roles & Access Control

Three roles, enforced server-side on every protected route (never trust a client-side role check alone):

1. **Investigator** — creates cases they own, adds/edits evidence on assigned cases, proposes hypotheses, links evidence, requests verification.
2. **Supervisor** — everything an Investigator can do on cases they're assigned/overseeing, plus: approves/rejects evidence verification, approves case lifecycle transitions (e.g., Active → Under Review → Closed), reassigns cases.
3. **Admin** — full system access: user management (create/suspend/change role), view all cases, global statistics dashboard, full audit log access, no case-content editing rights unless also assigned as investigator/supervisor on that case.

Every list/detail endpoint must filter by what the requester's role is entitled to see. Do not implement a "trust the frontend" authorization model.

## 4. Core Domain Model (implement exactly this — do not invent extra fields silently)

### User
`id, name, email (unique), passwordHash, role [investigator|supervisor|admin], status [active|suspended], createdAt, lastLoginAt`

### Case
`id, title, description, status [draft|active|under_review|closed|archived], priority [low|medium|high|critical], createdBy (User), assignedInvestigators[User], assignedSupervisor (User), createdAt, updatedAt, closedAt`

**Lifecycle transition matrix (enforce server-side, reject anything not listed):**
- `draft → active` — Investigator or Supervisor
- `active → under_review` — Investigator (requests review) or Supervisor
- `under_review → active` — Supervisor only (sends back for more work, must include a reason)
- `under_review → closed` — Supervisor only
- `closed → archived` — Admin or Supervisor
- `closed → active` — Supervisor only, requires a reason (case reopened), logged distinctly in audit trail
- No other transitions are valid. Reject with a clear 409/422 error.

### Evidence
`id, caseId, title, description, type [document|image|testimony|digital_log|physical|other], source, collectedBy (User), collectedAt, verificationStatus [unverified|pending|verified|rejected], verifiedBy (User, nullable), verifiedAt (nullable), rejectionReason (nullable), chainOfCustody[{actorId, action, timestamp, note}], tags[string], fileRefs[string] (metadata references only — see Section 6 on file handling), createdAt, updatedAt`

### EvidenceRelationship
`id, caseId, sourceEvidenceId, targetEvidenceId, relationshipType [supports|contradicts|corroborates|references|derived_from], weight (0.0–1.0, default 0.5, editable only by the creator or a supervisor), notes, createdBy, createdAt`

### Hypothesis
`id, caseId, title, description, status [proposed|under_investigation|supported|refuted|inconclusive], linkedEvidence[{evidenceId, stance: supports|contradicts}], confidenceScore (0–100, **computed, never manually set**), createdBy, createdAt, updatedAt`

### AuditLog
`id, actorId, action, entityType, entityId, caseId (nullable), timestamp, metadata (object), ipAddress`
Every create/update/delete/status-change/verify/reject/login/role-change **must** write an AuditLog entry. This is not optional and not batched — write it synchronously as part of the same transaction/request where feasible.

## 5. Hypothesis Confidence Algorithm (implement exactly — this is the core "dynamic" mechanic, do not approximate it)

For a given hypothesis H with linked evidence set E:

1. Only evidence with `verificationStatus = verified` contributes. `unverified`, `pending`, and `rejected` evidence contribute **zero** weight but remain visible in the UI as "not yet counted."
2. For each verified evidence item `e` linked to H with stance `supports`, add `+e.relationshipWeightToH` (default 0.5 if no explicit relationship record exists between the evidence and hypothesis beyond the direct link).
3. For each verified evidence item `e` linked with stance `contradicts`, subtract the same weighted value.
4. If evidence items are also connected to each other via `EvidenceRelationship` records of type `corroborates`, apply a small positive multiplier (define as `+10%` per corroborating verified link, capped at `+30%` total) to that evidence's contribution. If connected via `contradicts` to another piece of evidence supporting the same hypothesis, flag both as "conflicting" in the UI (do not silently cancel them — surface the conflict).
5. Normalize the raw score into 0–100 using a sigmoid or clamped-linear function — pick one, document the formula in the README and in code comments, and keep it deterministic (same inputs always produce the same score).
6. Recompute the score on every relevant mutation: evidence verification change, relationship change, or evidence link/unlink from the hypothesis. Do not compute it lazily-and-cache-forever — recompute on read or invalidate the cache on write, your choice, but document it.
7. `status` is investigator/supervisor-set (their judgment call), `confidenceScore` is system-computed — never let a human overwrite the number directly.

## 6. Evidence & File Handling

- Store file **metadata** (filename, mimetype, size, storage path/key, uploadedBy, uploadedAt) in MongoDB.
- For actual file bytes, use local disk storage under a configurable path for this build (document how to swap in S3-compatible storage later — but do not implement cloud storage unless asked).
- Never fabricate a working "cloud URL" — if a feature needs real external storage credentials, say so explicitly in the README's "Not Implemented / Requires Configuration" section rather than faking it.

## 7. Search, Filter, Pagination (apply consistently across Cases, Evidence, Hypotheses, Users, Audit Log)

- Cursor or offset pagination (pick one, be consistent) — `page`, `limit`, response includes `total`, `totalPages`.
- Case list: filter by status, priority, assigned investigator, date range; search by title/description (text index).
- Evidence list: filter by type, verificationStatus, tags, case; search by title/description/source.
- Audit log: filter by actor, action, entityType, date range.
- All filter/search/pagination params validated server-side; reject malformed queries with 400, don't silently ignore them.

## 8. Admin Dashboard

- User management: list/search/filter users, suspend/reactivate, change role (with an audit entry).
- Case oversight: list all cases across the system with filters, drill into any case read-only unless also assigned.
- Statistics: total cases by status, total evidence by verification status, average time-to-closure, most active investigators, hypothesis outcome distribution (supported/refuted/inconclusive counts). Compute these from real aggregated data — do not hardcode placeholder numbers anywhere, including in early scaffolding (see `AGENT.md`).

## 9. Investigation History / Case Timeline

Each case detail view shows a chronological, human-readable timeline built from AuditLog + lifecycle transitions + evidence additions + hypothesis changes — not a separate hand-maintained log. Derive it; don't duplicate data entry.

## 10. Non-Functional Requirements

- **Validation**: Mongoose schema validation + a request-body validation layer (e.g., Zod or Joi — pick one) on every route. No unvalidated `req.body` writes to the DB.
- **Error handling**: centralized Express error-handling middleware, consistent error response shape (`{ error: { code, message } }`), no leaking stack traces in production mode.
- **Security**: helmet, rate limiting on auth routes, input sanitization against NoSQL injection, bcrypt cost factor ≥ 10, JWT secrets from environment variables only (never hardcoded), CORS locked to configured origins.
- **Testing**: unit tests for the confidence-score algorithm (this is the highest-risk logic — test it thoroughly with multiple scenarios including conflicting evidence), integration tests for auth and lifecycle-transition guards, at least smoke tests for each major API resource.
- **Documentation**: root `README.md` with setup instructions, `.env.example`, architecture overview, and an explicit "Known Limitations / Not Implemented" section. API documented (OpenAPI/Swagger comment blocks or a `docs/api.md` — pick one).
- **Environment config**: all secrets/config via `.env`, never committed; provide `.env.example` with placeholder (non-functional) values clearly marked as such.

## 11. Suggested Project Structure

```
blackbox/
├── AGENT.md
├── README.md
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── models/          # Mongoose schemas: User, Case, Evidence, EvidenceRelationship, Hypothesis, AuditLog
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/        # confidence-score engine lives here as its own testable module
│   │   ├── middleware/       # auth, rbac, error handler, audit logger, validation
│   │   ├── utils/
│   │   └── app.js
│   ├── tests/
│   └── package.json
├── client/                   # SvelteKit app
│   ├── src/
│   │   ├── routes/
│   │   ├── lib/
│   │   │   ├── components/
│   │   │   ├── stores/
│   │   │   └── api/
│   │   └── app.html
│   ├── tests/
│   └── package.json
└── docs/
    └── api.md
```

## 12. Delivery Approach

Work in this order, and pause for confirmation between phases rather than generating the entire app in one uninterrupted pass:

1. **Phase 1** — Data models + auth + RBAC middleware + audit logging middleware (the foundation everything else depends on).
2. **Phase 2** — Case CRUD + lifecycle transition engine + tests for the transition matrix.
3. **Phase 3** — Evidence CRUD + verification workflow + chain of custody + file metadata handling.
4. **Phase 4** — Evidence relationships + hypothesis CRUD + the confidence-score engine, with its own dedicated test suite.
5. **Phase 5** — Search/filter/pagination across resources.
6. **Phase 6** — Admin dashboard (users, case oversight, statistics) + audit log viewer.
7. **Phase 7** — SvelteKit frontend: auth flows, case workspace, evidence board, relationship graph view, hypothesis panel, admin panel.
8. **Phase 8** — Polish: error states, loading states, empty states, responsive layout, final README + API docs.

At the end of each phase, summarize what was built, what was **not** built (deferred/out of scope), and any assumption made that wasn't explicitly specified in this document.

## 13. Explicitly Out of Scope Unless Asked Later

Real-time collaboration (websockets), mobile apps, cloud file storage integration, ML-based evidence analysis, external forensic tool integrations, multi-tenancy. If any of these seem tempting to add "for completeness," don't — flag them as a suggestion in the README instead.
