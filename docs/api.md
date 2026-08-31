# BlackBox API Specification

This document details the REST API endpoints provided by the BlackBox backend.

---

## 1. Authentication Endpoints (`/api/v1/auth`)

- `POST /api/v1/auth/register`: Create a new investigator account (or admin invitation).
- `POST /api/v1/auth/login`: Authenticate with email and password, returns access token + refresh token.
- `POST /api/v1/auth/refresh`: Exchange a valid refresh token for a new access token.
- `POST /api/v1/auth/logout`: Invalidate session/tokens.
- `GET /api/v1/auth/me`: Retrieve current authenticated user profile.

---

## 2. Cases Endpoints (`/api/v1/cases`)

- `GET /api/v1/cases`: List accessible cases with filters (`status`, `priority`, `assigned`, `search`) and pagination (`page`, `limit`).
- `POST /api/v1/cases`: Create a new case (Starts in `draft` status).
- `GET /api/v1/cases/:id`: Get case details (including populated investigators and supervisor).
- `PATCH /api/v1/cases/:id`: Update case title, description, priority.
- `POST /api/v1/cases/:id/transition`: Request or execute a case lifecycle transition per matrix.
- `GET /api/v1/cases/:id/timeline`: Get computed case timeline from audit logs and events.

---

## 3. Evidence Endpoints (`/api/v1/cases/:caseId/evidence`)

- `GET /api/v1/cases/:caseId/evidence`: List evidence items for a case with filtering and search.
- `POST /api/v1/cases/:caseId/evidence`: Add new evidence item (defaults to `unverified`).
- `GET /api/v1/cases/:caseId/evidence/:evidenceId`: Get specific evidence details with chain of custody.
- `PATCH /api/v1/cases/:caseId/evidence/:evidenceId`: Update evidence metadata.
- `POST /api/v1/cases/:caseId/evidence/:evidenceId/verify`: Verify evidence (Supervisor only).
- `POST /api/v1/cases/:caseId/evidence/:evidenceId/reject`: Reject evidence with reason (Supervisor only).
- `POST /api/v1/cases/:caseId/evidence/:evidenceId/custody`: Append chain of custody action.

---

## 4. Evidence Relationships (`/api/v1/cases/:caseId/relationships`)

- `GET /api/v1/cases/:caseId/relationships`: List all evidence-to-evidence relationships for the case graph.
- `POST /api/v1/cases/:caseId/relationships`: Create a relationship (`supports`, `contradicts`, `corroborates`, `references`, `derived_from`) with weight (0.0–1.0).
- `DELETE /api/v1/cases/:caseId/relationships/:id`: Remove relationship (Creator or Supervisor).

---

## 5. Hypotheses Endpoints (`/api/v1/cases/:caseId/hypotheses`)

- `GET /api/v1/cases/:caseId/hypotheses`: List hypotheses with real-time computed confidence scores.
- `POST /api/v1/cases/:caseId/hypotheses`: Create a new proposed hypothesis.
- `GET /api/v1/cases/:caseId/hypotheses/:id`: Get hypothesis details, linked evidence, and confidence score breakdown.
- `PATCH /api/v1/cases/:caseId/hypotheses/:id`: Update hypothesis title, description, or investigator status judgment.
- `POST /api/v1/cases/:caseId/hypotheses/:id/link-evidence`: Link or unlink evidence with stance (`supports` | `contradicts`).

---

## 6. Admin Endpoints (`/api/v1/admin`)

- `GET /api/v1/admin/users`: List/search users with roles and status.
- `PATCH /api/v1/admin/users/:id/role`: Change user role (`investigator`, `supervisor`, `admin`).
- `PATCH /api/v1/admin/users/:id/status`: Suspend or activate user.
- `GET /api/v1/admin/stats`: Get system-wide computed statistics (cases by status, evidence verification rates, hypothesis outcome distribution).
- `GET /api/v1/admin/audit-logs`: Query and filter full audit log trail.
