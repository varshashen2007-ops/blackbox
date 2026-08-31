# BlackBox — Digital Evidence Investigation Platform

BlackBox is a production-grade digital evidence investigation platform designed for investigative teams to collect, verify, and connect digital and physical evidence to construct and evaluate competing hypotheses. 

Evidence verification state and evidence-to-evidence / evidence-to-hypothesis relationships dynamically drive deterministic hypothesis confidence scores. Cases follow a strict, server-enforced, role-gated lifecycle with a complete audit trail for every mutating action.

---

## 1. Non-Negotiable Tech Stack

- **Frontend**: Svelte (via SvelteKit), reactive stores, clean responsive styling.
- **Backend**: Express.js (Node.js REST API).
- **Database**: MongoDB via Mongoose.
- **Auth**: JWT (Access + Refresh tokens) & bcrypt password hashing.
- **Request Validation**: Zod.
- **Testing**: Vitest for backend and frontend.
- **Security**: Helmet, Express Rate Limiting, CORS origin controls, strict NoSQL injection guards.

---

## 2. Monorepo Architecture

```
blackbox/
├── AGENT.md                       # Project operating rules and non-negotiables
├── TASK_SPLIT.md                  # Vertical-slice track ownership and win strategy
├── 01-antigravity-build-prompt.md # Canonical project specification
├── README.md                      # Setup, decisions, and system documentation
├── .github/workflows/ci.yml       # Automated PR checks (Lint & Vitest)
├── docs/
│   ├── api-conventions.md         # Request/response envelope and status codes
│   └── api.md                     # Endpoint documentation
├── server/                        # Express.js REST API
│   ├── src/
│   │   ├── config/                # DB and environment configuration
│   │   ├── models/                # Mongoose models (User, Case, Evidence, etc.)
│   │   ├── middleware/            # Auth, RBAC, Audit, Validate, Error handler
│   │   ├── routes/                # Express route controllers
│   │   ├── services/              # Confidence-score engine & business logic
│   │   ├── app.js                 # App configuration
│   │   └── server.js              # HTTP server entrypoint
│   ├── tests/                     # Vitest test suite
│   ├── .env.example
│   └── package.json
└── client/                        # SvelteKit Frontend
    ├── src/
    │   ├── lib/
    │   │   ├── api/               # Shared API client wrapper
    │   │   ├── stores/            # Reactive Svelte stores (Auth, etc.)
    │   │   └── components/        # Reusable UI components
    │   ├── routes/                # SvelteKit page routes
    │   └── app.html
    ├── tests/
    ├── .env.example
    └── package.json
```

---

## 3. Local Development Setup

### Prerequisites
- **Node.js**: `v20.x` or `v22.x`+
- **MongoDB**: Local instance running at `mongodb://localhost:27017` or MongoDB Atlas URI

### Server Setup
```bash
cd server
cp .env.example .env
# Edit .env with your local MongoDB URI and JWT secrets
npm install
npm run dev
# Server will start on http://localhost:5000 (Health check: http://localhost:5000/api/v1/health)
```

### Client Setup
```bash
cd client
cp .env.example .env
npm install
npm run dev
# Client will start on http://localhost:5173
```

### Running Tests
```bash
# Server tests (Vitest)
cd server
npm test

# Client tests
cd client
npm test
```

---

## 4. Implementation Decisions

Per **AGENT.md Section 3**, the following architectural and implementation decisions have been made:

1. **Request Validation (Zod)**: Zod is used for declarative, compile-time and runtime type-safe validation of request bodies, route parameters, and query parameters across all Express endpoints.
2. **Pagination Strategy**: Standard offset pagination (`page`, `limit`) returning `{ success: true, data: [...], pagination: { page, limit, total, totalPages } }` for consistency across all lists (cases, evidence, hypotheses, users, audit logs).
3. **Confidence Scoring Normalization**: Clamped linear normalization $(0 - 100)$ with baseline $50.0$, $+e.weight$ for supporting verified evidence, $-e.weight$ for contradicting verified evidence, $+10\%$ per corroborating link up to $+30\%$, and explicit UI conflict-flagging when contradictory evidence co-exists.
4. **Synchronous Audit Logging**: Every mutating action writes directly to the `AuditLog` collection before returning the API response, ensuring audit trail integrity without silent background drops.

---

## 5. Known Limitations

Per **AGENT.md Section 8**, the following limitations apply to the current version:
- **File Storage**: Uploaded evidence files are stored on the local filesystem under the configured upload directory (`server/uploads/`). S3/Cloud bucket storage can be integrated via the storage service abstraction.
- **Single-Tenant Deployment**: Multi-tenancy isolation is scoped to case-level role access rather than database-level partitioning.
- **WebSocket Streaming**: Live push updates use client polling / reactive refetches rather than persistent WebSocket connections.
