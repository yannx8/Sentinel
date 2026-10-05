# Application Architecture

> **GIT-9** — Sprint 0B: Technical Foundation & Quality
>
> This document is the approved architecture reference for the
> **Incident Reporting & Tracking Platform**.
> It governs all subsequent implementation issues.

---

## 1. Stack

```
React + TypeScript (frontend)
        ↓  HTTP / REST
Node.js + Express (API server)
        ↓  Prisma ORM
PostgreSQL (relational database)
```

**Structure:** Modular monolith — one deployable process, logically separated modules. No microservices.

**API style:** REST with consistent conventions (see [`api-conventions.md`](./api-conventions.md)).

---

## 2. Module Boundaries

The backend is organised into the following modules. Each module owns its router, service layer, and data-access queries. Cross-module access is through service interfaces — never via direct cross-module database queries.

| Module | Responsibility |
|---|---|
| **auth** | Session/JWT verification, token lifecycle, identity resolution |
| **organizations** | Organization management, tenant context resolution |
| **sites** | Site management within an organization |
| **incidents** | Incident submission, operational record, state machine |
| **assignments** | Assignment lifecycle and history |
| **comments** | Progress notes and incident history |
| **attachments** | File metadata, object-storage integration |
| **notifications** | User notification dispatch |
| **admin** | Privileged administrative operations (organization-scoped) |

### Structural rule

```
apps/api/src/
  modules/
    auth/
      auth.router.ts
      auth.service.ts
    incidents/
      incidents.router.ts
      incidents.service.ts
    ...
  middleware/
    authenticate.ts   ← sets req.user from verified token
    authorize.ts      ← checks role/permission
```

Modules expose named service functions. Routers call services. Services call Prisma. No module imports another module's Prisma queries directly.

---

## 3. Identity & Authorization

### 3.1 Roles (all organization-scoped)

| Role | Description |
|---|---|
| **User** | Can submit incidents within their organization |
| **Responsable** | Can manage incidents they are assigned to, within authorized Sites |
| **Administrator** | Can manage all incidents and assignments within their own organization |

Key constraints:
- All roles are **organization-scoped** — a user holds a role within a specific organization.
- A user may hold both **User** and **Responsable** simultaneously within the same organization.
- **Administrator authority is restricted to exactly one organization** — no cross-organization privilege escalation.
- There is no global super-admin role in the product model.
- Do not invent additional roles.

### 3.2 Authentication vs Authorization

**Authentication** answers: *Who are you?*
- Verified server-side on every request (JWT or session).
- Establishes `req.user` containing `userId`, `organizationId`, and `roles`.
- The `organizationId` in `req.user` is the single source of truth for tenant scope.

**Authorization** answers: *Are you allowed to do this?*
- Enforced server-side at the service layer.
- Frontend role checks are **UX convenience only** — the backend enforces all access rules.
- Client-supplied organization IDs are **never trusted** for scoping decisions.

### 3.3 Responsable authorization

A Responsable may only access:
1. Incidents explicitly assigned to them.
2. Incidents belonging to Sites they are authorized for.

Authorization is evaluated server-side on every request. There is no list of "Responsable-visible incidents" cached anywhere.

### 3.4 Administrator authorization

- Administrators can perform privileged operations (assignment, closure) only within their own organization.
- An Administrator cannot act on resources belonging to another organization under any circumstance.

---

## 4. Organization Scoping

Every service function and every Prisma query for a tenant-owned resource must follow these rules:

1. **`organizationId` comes from `req.user.organizationId`** — the verified session. It is never read from request body, path parameters, or query strings for scoping decisions.
2. Every Prisma query for a tenant-owned resource includes `where: { organizationId: req.user.organizationId }`.
3. Service functions accept `organizationId` as an explicit parameter (not a global) so the scope is visible at each call site.
4. Resources resolved without the organization scope must be treated as a security defect.

Example pattern (not implementation):

```typescript
// CORRECT
async function getIncident(id: string, organizationId: string) {
  return prisma.incident.findFirst({
    where: { id, organizationId },   // ← scope always included
  });
}

// INCORRECT — never do this
async function getIncident(id: string) {
  return prisma.incident.findUnique({ where: { id } }); // ← missing scope
}
```

---

## 5. Incident Domain

### 5.1 Two records per incident

An incident is represented by two distinct, separate records:

| Record | Nature | Mutability |
|---|---|---|
| **Original Submitted Report** | What was reported, by whom, when | **Immutable** — never modified after submission |
| **Operational Record** | Triage, assignment, state, progress, resolution | Mutable — evolves through the incident lifecycle |

The original report is the auditable historical truth. Any discrepancy between the operational record and the original report must be traceable.

### 5.2 Incident state machine

```
NEW
 │
 ▼
ASSIGNED       ← Administrator assigns a Responsable
 │
 ▼
IN_PROGRESS    ← Responsable acknowledges
 │
 ▼
RESOLVED       ← Responsable marks work complete
 │
 ▼
CLOSED         ← Administrator confirms closure
```

Rules:
- State transitions are enforced server-side only.
- Only valid transitions listed above are permitted; all others return `409 INVALID_STATE_TRANSITION`.
- The state machine is not implemented in this issue — document only.

---

## 6. Assignment Domain

Assignment is a **first-class domain entity**, not a field on the incident.

| Property | Decision |
|---|---|
| History | Always preserved — no destructive updates to assignment records |
| Automatic assignment | Explicitly excluded from the MVP |
| ML/AI assignment | Explicitly excluded |

**Assignment process:**
1. Filter Responsables by eligibility (Site authorization, role).
2. Apply simple, explainable ranking (criteria defined in a future issue).
3. Present ranked recommendation to the Administrator.
4. Administrator makes the final assignment decision.

---

## 7. Attachments

- **Binary files** are stored in object storage (S3-compatible bucket).
- **Database stores metadata only**: filename, MIME type, file size, storage key, uploader reference, upload timestamp.
- Presigned URLs are the preferred upload mechanism (to be detailed in the attachments sprint).
- The database record and the storage object must be kept consistent — orphaned objects are a defect.

---

## 8. Security Invariants

These are mandatory. They must never be bypassed in any implementation.

1. **Organization ID from session only** — `organizationId` for scoping always comes from the verified token/session, never from client input.
2. **Tenant scope on every query** — every Prisma query for a tenant resource includes `organizationId` from the session.
3. **Server-side authorization** — all access control is enforced in the backend service layer.
4. **Frontend checks are UX only** — hiding a button based on role does not constitute authorization.
5. **Responsable scope** — Responsable access is limited to their assigned incidents and authorized Sites.
6. **Administrator boundary** — Administrator actions cannot cross organization boundaries.
7. **Immutable original report** — the original submitted report must never be updated or deleted.

---

## 9. Environment Configuration

Configuration is managed via environment variables. The `.env.example` file documents all required variables with safe placeholder values. Never commit a real `.env` file or any secret.

| Variable | Purpose | Required |
|---|---|---|
| `PORT` | Backend HTTP port | Yes (default: 3000) |
| `NODE_ENV` | Runtime environment (`development` / `production` / `test`) | Yes |
| `DATABASE_URL` | PostgreSQL connection string (Prisma) | Yes |
| `JWT_SECRET` | Token signing key (auth sprint) | Future |
| `OBJECT_STORAGE_URL` | Object storage endpoint (attachments sprint) | Future |

No secret-management platform (Vault, AWS Secrets Manager, etc.) is required for the MVP. This may be revisited for production deployment.

---

## 10. Intentional Exclusions

The following are **explicitly excluded** from the MVP architecture. They will not be introduced without a concrete, proven requirement documented in a Linear issue.

| Technology | Decision |
|---|---|
| Redis / caching layer | Excluded |
| Message queues (BullMQ, RabbitMQ) | Excluded |
| Event bus / event-driven messaging | Excluded |
| Kafka / streaming infrastructure | Excluded |
| Microservices | Excluded — modular monolith only |
| Kubernetes / container orchestration | Excluded from MVP scope |

---

## 11. Deferred (Future Issues)

The following are documented here for context but are not implemented until their respective Linear issues:

- Prisma schema and database migrations
- JWT/session implementation
- All business domain APIs (incidents, assignments, organizations, sites)
- Responsable matching algorithm
- Notification dispatch
- Attachment upload flow
- Frontend business UI
