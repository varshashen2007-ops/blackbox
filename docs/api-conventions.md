# BlackBox API Conventions & Shared Contract

This document specifies the shared API conventions, envelope formats, and HTTP status codes used across all backend endpoints in BlackBox. All tracks (A, B, C) must strictly adhere to these conventions.

---

## 1. Base URL & Routing Conventions

- All REST endpoints are prefixed with `/api/v1`.
- Resource names are pluralized nouns in kebab-case or lower-case:
  - `/api/v1/auth` (authentication actions: register, login, refresh, logout, me)
  - `/api/v1/cases` (case CRUD, lifecycle actions, timeline)
  - `/api/v1/cases/:caseId/evidence` (evidence associated with a case)
  - `/api/v1/cases/:caseId/hypotheses` (hypotheses associated with a case)
  - `/api/v1/cases/:caseId/relationships` (evidence relationships)
  - `/api/v1/admin/users` (admin user management)
  - `/api/v1/admin/stats` (admin global metrics)
  - `/api/v1/admin/audit-logs` (audit log queries)

---

## 2. Authentication & Authorization Headers

- Protected endpoints require the `Authorization` header with a Bearer JWT:
  ```http
  Authorization: Bearer <access_token>
  ```
- Unauthenticated requests to protected endpoints return `401 Unauthorized`.
- Authenticated requests that lack sufficient role permissions return `403 Forbidden`.

---

## 3. Standard Response Envelopes

### Success Response (Single Resource / Mutation)
```json
{
  "success": true,
  "data": {
    "id": "60d0fe4f5311236168a109ca",
    "title": "Corporate Data Leak Investigation",
    "status": "active"
  }
}
```

### Success Response (Paginated Collection)
```json
{
  "success": true,
  "data": [
    { "id": "...", "title": "..." }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### Standard Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "details": [
      {
        "field": "priority",
        "message": "Invalid enum value. Expected 'low' | 'medium' | 'high' | 'critical'"
      }
    ]
  }
}
```

---

## 4. Standard HTTP Status Codes

| Code | Meaning | Usage |
|---|---|---|
| `200 OK` | Request succeeded | Standard GET, PUT, PATCH responses |
| `201 Created` | Resource created | POST requests resulting in new DB entities |
| `204 No Content` | No response body | Successful DELETE operations |
| `400 Bad Request` | Client validation failure | Malformed JSON, missing required fields, invalid query params |
| `401 Unauthorized` | Unauthenticated | Missing or expired JWT access token |
| `403 Forbidden` | Insufficient permissions | Role-based permission denied (e.g. investigator attempting supervisor action) |
| `404 Not Found` | Resource not found | Entity ID does not exist or requester not permitted to know existence |
| `409 Conflict` | Lifecycle/State conflict | Disallowed state transitions per lifecycle transition matrix |
| `422 Unprocessable Entity` | Semantic validation failure | Valid schema but violates domain invariants |
| `429 Too Many Requests` | Rate limit exceeded | Auth route rate limiting triggered |
| `500 Internal Server Error`| Server crash/unhandled exception | Uncaught server exception (sanitized in production) |

---

## 5. Standard Error Codes

- `UNAUTHENTICATED`: Missing, malformed, or expired JWT.
- `FORBIDDEN`: User lacks role permissions for the resource.
- `VALIDATION_ERROR`: Zod validation failed on request body, query, or params.
- `NOT_FOUND`: Requested resource was not found.
- `INVALID_TRANSITION`: Requested lifecycle transition violates the state matrix.
- `CONFLICT`: Resource conflict (e.g., duplicate unique email).
- `INTERNAL_ERROR`: Unexpected internal server failure.
