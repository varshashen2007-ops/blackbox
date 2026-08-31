# 🛡️ BlackBox — Digital Forensics & AI-Supervised Investigation Platform

[![Backend Vitest](https://img.shields.io/badge/Tests-67%2F67%20Passed-brightgreen.svg)](https://github.com/varshashen2007-ops/blackbox)
[![Frontend](https://img.shields.io/badge/Frontend-SvelteKit%20%2B%20Vite-orange.svg)](https://svelte.dev)
[![Backend](https://img.shields.io/badge/Backend-Express.js-blue.svg)](https://expressjs.com)
[![Database](https://img.shields.io/badge/Database-MongoDB%20%2F%20Mongoose-green.svg)](https://mongoosejs.com)
[![AI Engine](https://img.shields.io/badge/AI%20Engine-Groq%20Llama%203.3%2070B-purple.svg)](https://groq.com)
[![Security](https://img.shields.io/badge/Security-Zero--Trust%20%2B%20TOTP%20MFA-red.svg)](#-security--zero-trust-enforcement)

**BlackBox** is an enterprise-grade digital forensics and investigation platform designed for analytical teams to collect, verify, and correlate evidence, construct competing hypotheses, and automate investigative oversight.

Featuring an **Automated AI Supervisor Engine** powered by **Groq AI (Llama 3.3 70B)** and a **Deterministic Mathematical Confidence Scoring Model**, BlackBox guarantees non-repudiation, tamper detection, and zero-trust security across the entire case lifecycle.

---

## 📑 Table of Contents

- [Core Features & Highlights](#-core-features--highlights)
- [System Architecture & Tech Stack](#-system-architecture--tech-stack)
- [Automated AI Supervisor Engine](#-automated-ai-supervisor-engine)
- [Deterministic Hypothesis Confidence Model](#-deterministic-hypothesis-confidence-model)
- [Security & Zero-Trust Enforcement](#-security--zero-trust-enforcement)
- [Project Directory Structure](#-project-directory-structure)
- [API Reference](#-api-reference)
- [Local Installation & Setup](#-local-installation--setup)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Default Seed Accounts](#-default-seed-accounts)

---

## 🌟 Core Features & Highlights

- 🤖 **Automated AI Supervisor**: Eliminates human reviewer bottlenecks. Evaluates case evidence, computes timeline consistency, identifies evidence contradictions, re-evaluates hypothesis validity, and renders automated case closure readiness verdicts (`READY_FOR_CLOSURE`, `REQUIRES_ATTENTION`, `REVIEW_BLOCKED`).
- 🔐 **Cryptographic Evidence Integrity**: Computes SHA-256 hashes on upload to detect file tampering. Includes immutable chain-of-custody logging.
- 📐 **Deterministic Confidence Scoring**: Math-driven hypothesis scores ($0 - 100$) that dynamically adapt based on supporting/refuting verified evidence weights and corroboration graph connections.
- 🔑 **Zero-Trust Identity & MFA**: RFC 6238 TOTP Multi-Factor Authentication with QR setup, secure token rotation, and Google OAuth 2.0 identity verification with strict privilege escalation prevention.
- 📜 **Synchronous Audit Trail**: Every mutating action is logged synchronously to an immutable audit ledger with user ID, IP address, user-agent, previous state, and diff.
- 🔍 **Cross-Case Security & Isolated Search**: Scoped multi-entity search and AI conversational analysis preventing unauthorized data access across case boundaries.
- ⚡ **AI Investigator Chat & Briefs**: Context-aware conversational assistant grounded strictly within the assigned case evidence and hypotheses.

---

## 🛠️ System Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│                 SvelteKit Forensic Frontend                 │
│              (Svelte 5, Tailwind CSS, Lucide)               │
└──────────────────────────────┬──────────────────────────────┘
                               │  REST APIs + JWT Auth
┌──────────────────────────────▼──────────────────────────────┐
│                  Express.js API Gateway                     │
├─────────────────────────────────────────────────────────────┤
│  Middleware: NoSQL Sanitizer • RBAC • CaseAccess • Audit    │
├──────────────┬──────────────┬──────────────┬────────────────┤
│    Cases     │   Evidence   │  Hypotheses  │ AI Supervisor  │
│  Controller  │  Controller  │    Engine    │   Controller   │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────┘
       │              │              │                │
       │              │              │       ┌────────▼───────┐
       │              │              │       │ Groq Llama 3.3 │
       │              │              │       │ 70B (JSON Mode)│
       │              │              │       └────────┬───────┘
       │              │              │   Failover ────┤
       │              │              │       ┌────────▼───────┐
       │              │              │       │ Deterministic  │
       │              │              │       │  Rule Engine   │
       │              │              │       └────────┬───────┘
       │              │              │                │
       ▼              ▼              ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                 MongoDB Database / Mongoose                 │
│        (Cases, Evidence, Hypotheses, AiReviews, Audit)      │
└─────────────────────────────────────────────────────────────┘
```

### Technology Matrix

| Layer | Technologies | Purpose |
|---|---|---|
| **Frontend** | **SvelteKit**, **Svelte 5**, **Vite**, **Tailwind CSS** | Reactive, fast, cyber-forensics dark theme user interface |
| **Backend** | **Express.js**, **Node.js (>=18)** | RESTful API backend with modular middleware architecture |
| **Database** | **MongoDB**, **Mongoose ODM** | Scalable document store with strict schema definitions and indexing |
| **AI / LLM** | **Groq Cloud API** (`llama-3.3-70b-versatile`) | High-speed structured JSON reasoning and case evaluation |
| **Validation** | **Zod** | Runtime schema parsing and compile-time type safety for inputs & AI outputs |
| **Security** | **Helmet**, **CORS**, **bcryptjs**, **otplib**, **qrcode** | Zero-trust protection, rate limiting, and RFC 6238 TOTP MFA |
| **Testing** | **Vitest**, **Supertest**, **mongodb-memory-server** | Unit, integration, security, and lifecycle test suite (67 tests) |

---

## 🤖 Automated AI Supervisor Engine

BlackBox replaces traditional manual supervisor bottlenecks with an automated, explainable AI supervision lifecycle:

1. **Case Submission**: Investigator advances case state to `under_review` and triggers AI Review (`POST /api/v1/cases/:caseId/ai/review`).
2. **Audit Initiation**: Emits `AI_REVIEW_STARTED` audit log with actor ID.
3. **Cryptographic SHA-256 Verification**: Verifies every piece of evidence against its recorded hash (`verified`, `tampered`, or `unhashed`).
4. **Deterministic Conflict & Corroboration Detection**: Scans evidence links and hypothesis stances to detect direct contradictions and corroborations.
5. **Groq LLM Structured JSON Analysis**: Groq (`llama-3.3-70b-versatile`) evaluates evidence credibility, identifies missing links, and provides case closure recommendations.
6. **Zod Strict Schema Validation**: Output is validated against `aiSupervisorReviewSchema`. If Groq is unavailable, the **offline deterministic engine** generates reliable metrics safely.
7. **Automated Evidence State Updates**: Automatically updates evidence verification status to `ai_reviewed` or `flagged`.
8. **Hypothesis Confidence Recalculation**: Recomputes deterministic confidence scores for all hypotheses based on updated evidence weights.
9. **Closure Readiness Decision**: Renders verdict:
   - **`READY_FOR_CLOSURE`**: Completeness $\ge 75\%$, leading hypothesis confidence $\ge 70\%$, zero tampering, zero critical contradictions.
   - **`REQUIRES_ATTENTION`**: Plausible leading hypothesis with minor gaps, pending evidence items, or secondary corroboration needs.
   - **`REVIEW_BLOCKED`**: File tampering detected, severe evidence contradictions, or missing core investigative elements.
10. **Persistence**: Saves full review in `AiReview` collection and logs `AI_REVIEW_COMPLETED`.

---

## 📐 Deterministic Hypothesis Confidence Model

Hypothesis scores are computed mathematically rather than guessed by LLMs, ensuring 100% reproducibility and transparency.

$$C(H) = \text{clamp}\left( 50.0 + \sum_{e \in E_{\text{sup}}} W(e) - \sum_{e \in E_{\text{ref}}} W(e) + B_{\text{corrob}}, \; 0.0, \; 100.0 \right)$$

### Scoring Rules:
1. **Baseline**: Any hypothesis starts with a neutral score of **$50.0\%$**.
2. **Verified Evidence ($W(e)$)**:
   - Only evidence with `verificationStatus = 'verified'` or `'ai_reviewed'` and `integrityStatus != 'tampered'` contributes weight.
   - Weight is scaled by evidence quality and reliability ($1 - 100$ scale).
3. **Corroboration Boost ($B_{\text{corrob}}$)**:
   - $+10\%$ per corroborating evidence link up to a maximum boost cap of $+30\%$.
4. **Contradiction Penalty & Flagging**:
   - If opposing verified evidence exists, score reflects the net difference and flags an explicit **Conflict Warning** in the UI.
5. **Unverified / Flagged Evidence**:
   - Items with `pending`, `rejected`, or `tampered` statuses contribute **$0.0$** weight to prevent speculative bias.

---

## 🔒 Security & Zero-Trust Enforcement

- **NoSQL Injection Defense**: Custom middleware inspects all request parameters, query strings, and body payloads to strip malicious MongoDB operator keys (e.g., `$ne`, `$gt`, `$where`, `$regex`).
- **Role Escalation Prevention**: Public registration and Google OAuth logins strictly assign the base `investigator` role (`clearanceLevel: 1`). Supervisor promotions require explicit administrative review and approval.
- **Data Leak Sanitization**: Sensitive authentication artifacts (`passwordHash`, `mfaSecret`, session tokens) are strictly excluded from Mongoose query projections and JSON responses.
- **Case-Level Access Authorization**: Investigators can only query and interact with cases to which they are explicitly assigned. Cross-case data extraction via search or AI chat is blocked at the database level.
- **Two-Factor Authentication (MFA)**: Built-in RFC 6238 time-based one-time password (TOTP) engine with QR code setup and emergency recovery backup codes.

---

## 📁 Project Directory Structure

```
blackbox/
├── client/                               # SvelteKit 5 + Vite Frontend
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api/client.js             # Authenticated API client
│   │   │   ├── components/               # UI components (Sidebar, Drawer, Modals)
│   │   │   └── stores/auth.js            # Reactive authentication store
│   │   ├── routes/
│   │   │   ├── (auth)/login/             # Login & MFA Challenge UI
│   │   │   ├── (auth)/register/          # Secure Registration
│   │   │   ├── verify-identity/          # Google OAuth Identity UI
│   │   │   ├── cases/                    # Case management & Workspace
│   │   │   │   └── [id]/                 # Case Workspace & AI Supervisor Tab
│   │   │   ├── ai-supervisor/            # Global AI Supervision Dashboard
│   │   │   └── admin/                    # Admin Center & Audit Logs
│   │   └── app.html
│   └── package.json
│
├── server/                               # Express.js REST API Backend
│   ├── src/
│   │   ├── config/                       # DB, env, and rate limiter configuration
│   │   ├── controllers/                  # Route handlers (auth, case, evidence, AI)
│   │   ├── middleware/                   # RBAC, caseAccess, audit, nosqlSanitizer
│   │   ├── models/                       # Mongoose Schemas (Case, Evidence, AiReview)
│   │   ├── routes/                       # Express route declarations
│   │   ├── services/                     # Business logic & AI Supervisor Engine
│   │   ├── validators/                   # Zod request & AI response schemas
│   │   ├── app.js                        # Express app setup
│   │   └── server.js                     # HTTP server entrypoint
│   ├── tests/                            # Vitest automated test suites
│   ├── .env.example
│   └── package.json
│
└── docs/                                 # API specifications and conventions
```

---

## 📡 API Reference

### Authentication & Identity
- `POST /api/v1/auth/register` — Register new investigator account (strictly level 1)
- `POST /api/v1/auth/login` — Authenticate credentials (triggers MFA challenge if active)
- `POST /api/v1/auth/mfa/setup` — Generate TOTP secret & QR code
- `POST /api/v1/auth/mfa/verify` — Confirm TOTP and activate MFA
- `POST /api/v1/auth/mfa/challenge` — Verify TOTP code during login
- `POST /api/v1/auth/google/verify` — Authenticate via Google ID Token
- `GET /api/v1/auth/me` — Retrieve current authenticated user profile

### Cases & Lifecycle
- `GET /api/v1/cases` — List accessible cases with pagination and filters
- `POST /api/v1/cases` — Create new investigation case
- `GET /api/v1/cases/:id` — Retrieve case details and overview
- `PATCH /api/v1/cases/:id/status` — Advance case lifecycle state (`draft`, `active`, `under_review`, `closed`, `archived`)

### Evidence & Integrity
- `POST /api/v1/cases/:id/evidence` — Add evidence with SHA-256 hash and custody chain
- `PATCH /api/v1/cases/:id/evidence/:evidenceId/verify` — Verify or reject evidence
- `POST /api/v1/cases/:id/evidence/relationships` — Create corroboration or contradiction link

### Hypotheses & Confidence
- `POST /api/v1/cases/:id/hypotheses` — Propose new investigative hypothesis
- `POST /api/v1/cases/:id/hypotheses/:hypId/link-evidence` — Link evidence (`supports` / `refutes`)
- `GET /api/v1/cases/:id/hypotheses/:hypId/score` — Get deterministic confidence score breakdown

### AI Supervisor & Intelligence
- `POST /api/v1/cases/:id/ai/review` — Trigger automated AI Supervisor case review
- `GET /api/v1/cases/:id/ai/review` — Fetch latest AI review record
- `GET /api/v1/ai-supervisor/dashboard` — Global supervision intelligence metrics
- `GET /api/v1/cases/:id/ai/brief` — Generate executive case brief
- `POST /api/v1/cases/:id/ai/chat` — Contextual AI Investigator Q&A

---

## 💻 Local Installation & Setup

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **MongoDB**: Local instance running on port `27017` or MongoDB Atlas URI
- **Groq API Key** (Optional for live LLM, system includes offline fallback): [Get API Key](https://console.groq.com)

### 1. Clone Repository
```bash
git clone https://github.com/varshashen2007-ops/blackbox.git
cd blackbox
```

### 2. Backend Server Setup
```bash
cd server
cp .env.example .env

# Configure environment variables in server/.env
# PORT=5000
# MONGODB_URI=mongodb://localhost:27017/blackbox
# JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters
# JWT_REFRESH_SECRET=your_super_secret_refresh_key_32_chars
# GROQ_API_KEY=gsk_your_groq_api_key

npm install
npm run seed:dev    # Seeds default accounts (Admin, Supervisor, Investigator)
npm run dev         # Starts server on http://localhost:5000
```

### 3. Frontend Client Setup
```bash
cd ../client
cp .env.example .env

npm install
npm run dev         # Starts client on http://localhost:5173
```

---

## 🧪 Testing & Quality Assurance

BlackBox includes comprehensive automated tests covering authentication, RBAC, NoSQL injection resistance, SHA-256 integrity, hypothesis confidence calculations, and AI supervision:

```bash
cd server
npm test
```

### Test Suite Summary:
```
 Test Files  13 passed (13)
      Tests  67 passed (67)
   Coverage  Auth, RBAC, AI Supervisor, Hypotheses, Case Lifecycle, Security Hardening
```

---

## 👥 Default Seed Accounts

When initializing with `npm run seed:dev`, the following development accounts are available:

| Role | Email | Password | Clearance Level |
|---|---|---|---|
| **Admin** | `admin@blackbox.internal` | `AdminPass123!` | Level 3 (Global Admin) |
| **Supervisor** | `supervisor@blackbox.internal` | `SuperPass123!` | Level 2 (Supervisor) |
| **Investigator** | `investigator@blackbox.internal` | `InvestPass123!` | Level 1 (Investigator) |

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
