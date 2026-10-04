# Sentinel rebuild: plan and handoff

## Status (2026-10-04)

| Phase | State |
|---|---|
| WIP snapshot (`b0baecf`) | Done |
| 0 Stabilize and clean (`55c8ccb`) | Done, one check left: `docker compose up` was not re-verified after the migration BOM fix |
| 1 Data model v2 | Next |
| 2 to 6 | Not started |

Phase 0 results:
- `pnpm typecheck`, `pnpm test` (16 legacy unit tests) and `pnpm build` are green.
- Both Docker images build.
- The API container crashed on `prisma migrate deploy` because `0_baseline/migration.sql` started with a UTF-8 BOM. The BOM is stripped in `55c8ccb`, but the stack has not been re-run since.

Known state:
- Auth is intentionally absent: `contextResolver` is a stub and every tenant or platform route answers 401 until Phase 2.
- `apps/web` still contains Clerk code (`main.tsx`, `LoginPage`) and is rebuilt in Phase 3. Its tsconfig pins React 18 types with `paths` because mobile hoists `@types/react` 19.
- MinIO was dropped from compose: its community images are no longer published. Choose and verify an S3-compatible replacement in Phase 2.
- Local dev machine: Avast HTTPS scanning intercepts TLS. `.certs/*.pem` (gitignored) feeds the Docker build stages. `docker compose build` (bake) still fails there, so use `docker build -f Dockerfile.api -t sentinel-api:local .` and the same for web, then `docker compose up -d --no-build`.

## Working rules (see AGENTS.md)

- Explicit user approval before every commit, merge and push.
- No em dashes anywhere.
- Conventional commits.
- Vitest against Postgres always uses `--no-file-parallelism`.
- Phase branches are named `feature/P<n>-<slug>`. P0 is stacked on `feature/sentinel-mobile-role-split`, because `main` lacks the schema v2 work. Merge both together.

---

# Sentinel: audit and production refactor plan

## Context

Sentinel is a multi-tenant B2B incident platform:
- employees report incidents
- supervisors triage and assign them
- intervenants (internal or external technicians, possibly serving several organizations) resolve them
- supervisors verify and close them
- platform admins manage tenant organizations

Surfaces: Expo app for employees and intervenants, React web console for supervisors (`/app`) and platform admins (`/platform`).

The repo is mid-refactor. It is uncommitted on `feature/sentinel-mobile-role-split`: 118 changed files, auth moved from custom JWT to Clerk, and a new baseline migration. The refactor stopped halfway: the schema was upgraded but the backend, web and mobile were not. Nothing runs end to end today.

Goal: a production-ready B2B SaaS, delivered in phases with checkpoints. `Downloads/Documents/Sentinel_PRD_SRS_DesignSystem.md` is used as product inspiration, not as a literal spec.

### Decisions confirmed
| Topic | Decision |
|---|---|
| Identity | Self-hosted auth, replacing Clerk. Clerk is removed everywhere |
| Layout | `apps/api`, `apps/web`, `apps/mobile` + `packages/shared` |
| Uncommitted work | Commit it as a WIP baseline on the current branch first (I'll show the message and ask before running the commit) |
| Cadence | Phase by phase: after each phase I show results and tests, then wait for approval to commit and continue |

---

## 1. Audit: what actually exists

### Real layout
- **Real code:**
  - `packages/backend`: Express + Prisma + Postgres + Clerk
  - `packages/frontend`: Vite + React 18 + Tailwind v4 + Clerk
  - `apps/mobile`: Expo 57, RN 0.86, React Navigation 7
  - `packages/shared`: API client and tokens
- **`apps/api` and `apps/web` are empty folders.**
- **Docs that describe things that don't exist:** the walkthrough `.md` files and `implementation_plan.md` claim Fluent UI, DataGrid, a JWT mobile login, migrations and CHECK constraints. None of these exist.

### Works (keep)
- **Prisma schema design** (`packages/backend/prisma/schema.prisma`):
  - uuid keys everywhere
  - composite tenant FKs `(id, organizationId)`
  - single role per membership
  - category table, incident `reference`/`version`, MTTA/MTTR timestamps
- **`0_baseline/migration.sql`** matches the schema and adds partial unique indexes: one active REPORTER membership per user, one live assignment per incident.
- **Clerk to internal UUID resolution** (`middleware/contextResolver.ts`).
- **Pieces worth keeping:**
  - the incident transition table `incident-lifecycle.ts`
  - the upload magic-byte check
  - security headers
  - the zod 4 version, already aligned across packages
- **Expo shell:** the tab sets per role match the PRD.

### Broken (blocks everything)

**Backend**
| Where | Defect |
|---|---|
| `backend/src/app.ts:93` | Stray French sentence, so `tsc` fails and the backend cannot start |
| `incidents.service.ts:9`, `shared/authorization.ts` | `incidentScope` reads `ctx.roles` but `ctx.role` is set: every incident, map and attachment call returns 500 |
| `shared/audit.ts` | It writes event types ('TRIAGE', 'RESOLUTION'…) that are not in the `AuditEventType` enum: every workflow transaction rolls back |
| `createIncident` | Rejects REPORTER, writes `category`/`priority` fields that don't exist, never sets `reference` |
| `verifyIncident` | Writes a `verifiedAt` column that doesn't exist |
| `addProgress` | Missing required `assignmentId` |
| `addComment` | Missing required `visibility` |
| `acceptAssignment` | Bypasses the state machine and can re-open RESOLVED incidents |
| Rest of the API | Logic sits inside route files with `any` everywhere, which hides all of the above from `tsc` |

**Clients**
| Where | Defect |
|---|---|
| Web and mobile auth calls | They call the deleted `/auth/*` routes. Mobile has no Clerk SDK at all |
| Role mapping | Web and mobile map Clerk `org:admin`/`org:member` roles, while the DB uses SUPERVISOR/REPORTER/INTERVENANT. Every user is routed wrongly or gets 403 |
| Web response shapes | Team page, assignee display and attachment URLs don't match backend responses |
| Mobile report form | Fails backend validation |

**Infra and tests**
| Where | Defect |
|---|---|
| Docker and CI | Pass the old JWT vars; `CLERK_WEBHOOK_SECRET` is required, so the API exits on boot. The Dockerfile skips `packages/shared` in the install stage |
| Tests | They exercise copies of the code (`incident-scope.test.ts`) or nonexistent routes (`tenant_isolation.test.ts`). They give false confidence |

### Security holes
- **`GET /organizations` is public** (`app.ts:64`) and lists every tenant.
- **Calls with no org context leak data across tenants.** A missing org leaves `organizationId` undefined, so `where: { organizationId: undefined }` applies no filter:
  - `GET /notifications` and `PATCH /notifications/:id/read`
  - `GET /sites`
- **The context resolver ignores `Membership.status`, `User.status` and `Organization.status`.** Revoked members and suspended organizations keep access.
- **A supervisor can demote the owner or other supervisors** (`responsables.routes.ts`).
- **DTOs leak `clerkUserId`.**
- **`docs-agent.yml` pipes the full diff to an external CLI** installed with `curl | bash`, and `contents: write` is enabled.
- **`.npmrc` has `strict-ssl=false`.**

### Missing (PRD v1 must-haves)
- **Onboarding:** B2B registration and verification, invitations and acceptance, CSV import. No Organization or Membership is ever created outside the seed.
- **Supervisor setup and workflow:**
  - category, specialty and site-access management
  - triage/assign/verify UI, eligibility hints
  - comments and timeline UI, audit log viewer
  - decline, reassignment queue, supersede, send-back
- **Platform admin:** no MFA check, no platform audit writes, no web pages.
- **Infrastructure:** object storage with signed URLs, email, push, `/v1` versioning, uniform error contract, idempotency keys, optimistic locking on every mutation.
- **Mobile:**
  - Clerk sign-in, deep links (no `scheme` or bundle ids), org switcher
  - offline queue, camera/location/maps, notifications
  - intervenant actions: decline, progress, resolve
- **Web UI:** four styling systems coexist (tokens, raw Tailwind colours, inline hex, a 4,900-line `index.css`), three different blues, and "NEXUS" branding. `@sentinel/shared` is not used by web or backend.

### Hygiene
These files should be deleted:
- `packages/backend/scratch_refactor.mjs` and `updateSchema.cjs` (re-running either would corrupt the schema)
- the 8 `walkthrough_*.md` files, `implementation_plan.md` and `task.md` at the root
- stale `dist/` folders
- the duplicate `postman/` and `.postman/` folders

Also fix the mobile package name `sentinel`, which collides with the root package name.

---

## 2. Target architecture

```
apps/api      Express 5 + Prisma 6 + Postgres 16   (moved from packages/backend)
apps/web      Vite + React 18 + React Router 7 data router (moved from packages/frontend)
apps/mobile   Expo SDK 57 + React Navigation 7
packages/shared  zod schemas (request/response DTOs), enums, typed API client, design tokens, i18n keys
```

- **Identity: Better Auth**, self-hosted, TypeScript, Prisma adapter on our Postgres.
  - **Library features used:**
    - email + password with email verification and password reset
    - `twoFactor` plugin (TOTP, mandatory for platform admins, optional for supervisors)
    - `bearer` plugin plus `@better-auth/expo` for mobile
  - **Our own code and data:**
    - Better Auth's organization plugin is NOT used; our `Organization`/`Membership` tables stay the source of truth for tenancy and roles.
    - `generateId` is set to uuid so `User.id` stays `@db.Uuid`.
    - Public `signUp` is disabled at the server level. Users are created only by our registration and invitation-accept services, which call the auth API internally.
  - **Web:** httpOnly, Secure, SameSite=Lax session cookie, same origin through nginx `/api`. Better Auth's trusted-origins check covers CSRF.
  - **Mobile:** session token in `expo-secure-store`, sent as Bearer.
  - **Security controls:**
    - rate limits on sign-in, reset and verify
    - account lockout after repeated failures
    - session revocation on membership revoke and on password change
    - an "active sessions" list in the profile
  - **Verification gate (first task of Phase 2):** check the current Better Auth version, its Prisma 6 adapter, the Expo plugin's support for SDK 57, and the uuid `generateId` hook. If a blocker shows up, fall back to a small in-house module: argon2id hashes, opaque session tokens hashed in a `Session` table, same API surface.
- **API conventions:**
  - `/v1` prefix and thin routes; services hold the logic.
  - shared zod schemas validate every input.
  - typed `req.ctx`, no `any`.
  - error body `{code, message, details, requestId}`.
  - pino structured logs with request id.
  - cursor pagination.
  - `Idempotency-Key` on creates and transitions.
  - `version` checks on every mutation (error `CONFLICT_CONCURRENT_UPDATE`).
- **Tenant guard:**
  - Rejects with 401/403 if the user, membership or organization is not ACTIVE. Checked on every request.
  - `ctx.orgId` is always defined on tenant routes.
  - `/platform` routes use a separate guard (PlatformAdmin row + session verified with Better Auth TOTP), and the two guards are mutually exclusive.
- **Storage:** S3-compatible object storage (MinIO in dev, any S3 in prod), presigned PUT for uploads, 5-minute presigned GET after a scope check.
- **Email:** Nodemailer SMTP (Mailpit in dev) for verification, invitations and suspension notices.
- **Push:** `expo-notifications` plus `DeviceToken`, sent after commit.
- **Web UI:**
  - Tailwind v4 `@theme` generated from `packages/shared/src/tokens.ts`
  - Radix primitives, TanStack Query and Table, React Hook Form + shared zod
  - IBM Plex Sans self-hosted
  - the 4,900-line `index.css` deleted
  - the PRD section 5 design system: semantic tokens, shape+label badges, 1px panels with no shadows
- **Mobile:**
  - TanStack Query
  - offline action queue persisted in `expo-sqlite` (or MMKV), each action carrying an idempotency key
  - `expo-image-picker` + `expo-image-manipulator`, `expo-location`, `react-native-maps`
  - `scheme: sentinel` plus universal links for invitations
  - an `app-config` version gate

### Schema adjustments (on top of the good baseline; regenerate one clean baseline, since there is no production data)
- **Auth swap:**
  - drop `Organization.clerkOrgId` and `User.clerkUserId`
  - add the Better Auth tables `Session`, `Account` (password hash lives here), `Verification` and `TwoFactor`, all uuid and FK'd to `User`
  - add `User.emailVerified`
  - delete the Clerk webhook module, `svix`, and every `@clerk/*` dependency
- **Add missing FKs:**
  - `PlatformAdmin.userId`, `PlatformAuditEvent` (admin, org)
  - `Invitation.invitedByMembershipId`, `ImportJob.createdByMembershipId`
  - `AuditEvent.actorUserId`, `Organization.termsAcceptedByUserId`
- **Expand `AuditEventType`** to the real workflow vocabulary:
  - INCIDENT_CREATED, TRIAGED
  - ASSIGNED, ASSIGNMENT_ACCEPTED, ASSIGNMENT_DECLINED, REASSIGNMENT_REQUESTED, REASSIGNMENT_RESOLVED
  - PROGRESS_POSTED, RESOLVED, SENT_BACK, CLOSED
  - COMMENT_ADDED, ATTACHMENT_ADDED
  - MEMBER_INVITED, MEMBER_JOINED, MEMBER_SUSPENDED, MEMBER_REVOKED
  - SITE_*, CATEGORY_*, ORG_UPDATED
- **Expand `PlatformEventType`** to match.
- **New tables:**
  - `OrganizationRegistration` (pending registration and verification token hash, expiry)
  - `IdempotencyKey` (key, membership, route, response hash, expiresAt)
  - `SavedView` (supervisor saved filters)
- **Notifications:** dedupe unique key `(recipientMembershipId, eventType, incidentId, incidentVersion)`.
- **Assignments:** `reassignResolution`/`resolvedByMembershipId` fields for the reassignment queue.
- **Enums instead of strings:** `Organization.industry`, `sizeBand`. Drop the redundant `@@unique([id])`.
- **Indexes for every list filter:**
  - Notification (recipient, readAt)
  - Assignment (intervenantMembershipId, status)
  - AuditEvent (organizationId, incidentId, createdAt)
  - Incident (organizationId, siteId), (organizationId, categoryId), (organizationId, createdAt)
  - a trigram or tsvector index for incident search
- **Raw SQL in the baseline:**
  - both partial unique indexes
  - an append-only trigger on `AuditEvent` and `PlatformAuditEvent`
  - CHECK constraints (decline reason length, radius > 0)
  - documented in `prisma/README.md`, plus a `db:check-drift` script so `migrate dev` never silently drops them
- **Seed:** one realistic demo tenant (owner, 2 supervisors, 6 employees, 4 intervenants with one multi-org, 3 sites, categories, ~40 incidents across all states) and one platform admin with TOTP enrolled.
  - Every account has a known dev password, created through the auth API so the hashes are real.
  - The script refuses to run when `NODE_ENV=production`.
  - A `pnpm --filter api platform-admin:create` CLI creates platform admins in production.

---

## 3. Delivery phases

Each phase runs on its own `feature/<ticket>-<slug>` branch off up-to-date `main`. Every commit, merge and push waits for explicit approval (AGENTS.md). No em dashes anywhere. Tests run with `--no-file-parallelism`.

**Phase 0: Stabilize and clean**
- Snapshot the current WIP (per your decision).
- Move to the `apps/api`, `apps/web`, `apps/mobile` layout.
- Delete the scratch, walkthrough and dist artifacts.
- Fix the `app.ts` syntax error and remove the public `/organizations` route.
- Rename the mobile package name to fix the collision.
- Remove the Clerk packages and the webhook module.
- `.env.example` per app (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`, S3, SMTP).
- `docker-compose`: postgres, minio, mailpit, api, web.
- Fix the Dockerfiles to include shared, and pin pnpm.
- CI: install, typecheck all, lint, test with a Postgres service, `prisma migrate deploy`.
- Remove or harden `docs-agent.yml`.
- *Exit:* `pnpm -r typecheck` is green; `docker compose up` boots api and web.

**Phase 1: Data model v2**
- Schema adjustments above, regenerated baseline, raw SQL constraints, drift check, seed.
- *Exit:* `migrate reset` + seed is clean; constraint tests prove I1 (same-tenant parents), I2 (one active reporter membership), I4 (one live assignment) and I7 (append-only audit) at the DB level.

**Phase 2: API core**
- Run the Better Auth verification gate. Mount the auth handler at `/v1/auth/*`.
- Rewrite `contextResolver`: session → User → active Membership (header `X-Org-Id`, defaulting to the user's only or last-used org). Reject inactive user, membership or org (statuses checked on every request).
- Shared zod DTOs and typed client in `packages/shared`.
- Rewrite every module as routes → controller → service:
  - `public` (registration, verify, invitation lookup and accept)
  - `me` (memberships, active org, profile, certifications, devices)
  - `organization`, `sites`, `categories`, `specialties`
  - `members` (CRUD, suspend, revoke, CSV import dry-run and commit), `invitations`
  - `incidents` (create, list with filters/search, detail, triage, assign with eligibility ranking, close, send-back, comments with visibility, attachments via presigned URLs, timeline)
  - `assignments` (mine across orgs, accept, decline, request reassignment, progress, resolve)
  - `reassignments` queue, `notifications`, `dashboard` (MTTA/MTTR, ageing, workload, trend), `map`, `audit` (+ CSV)
  - `platform` (orgs list/detail, suspend/reactivate with reason, plan edit, registrations, platform audit)
  - `app-config`
- Auth tests: sign-in, lockout, reset, verify, 2FA on `/platform`, session revoked on membership revoke.
- Notifications and push dispatched after commit.
- Reuse `incident-lifecycle.ts` and extend it with the assignment state machine.
- *Exit:* integration tests on a real DB for every route × role matrix; an adversarial suite (org B gets 404 on every org A resource; non-platform tokens get 403 on `/platform`); a concurrency test for double assignment. All green.

**Phase 3: Web console**
- Design system: tokens, primitives, and a `/design` route.
- Public pages: register (3 steps), verify, login, reset, invite acceptance, and "use the app" for non-supervisors.
- `/app` pages:
  - setup checklist, dashboard
  - incident inbox (TanStack Table, filters, saved views, bulk select), incident drawer (overview, timeline, comments with internal visibility, evidence, state-aware action bar), assign dialog with fit indicators
  - reassignment queue, map (real coordinates only)
  - team (employees, intervenants, invitations, CSV import wizard)
  - sites with perimeter editor, categories and specialties
  - audit log, settings, notifications
- `/platform` pages: organizations, detail, suspend/reactivate, registrations, audit.
- FR/EN i18n by namespace.
- *Exit:* journeys A, B, C (supervisor side) and E pass in Playwright; a keyboard-only run; Lighthouse accessibility ≥ 95.

**Phase 4: Mobile, employee**
- Sign-in through the Better Auth Expo client (token in SecureStore), invitation deep link and acceptance, `app-config` gate.
- Shared primitive layer from the tokens.
- Report in 3 steps: what (title, description, photo), where (site, GPS or manual pin), confirm. Success screen shows the reference.
- My incidents with timeline and comments, notifications, profile.
- Offline queue with pending, sent and failed states.
- *Exit:* journey C reporter side works on an Android emulator and a physical device via EAS internal build, including offline then reconnect.

**Phase 5: Mobile, intervenant**
- My work grouped by Needs response, In progress and Awaiting review; the cross-org list.
- Org switcher.
- Accept, decline or request reassignment with reason.
- Structured updates with photo; resolve with note and evidence.
- History, profile with certifications, availability toggle, navigate to site.
- Push notifications.
- *Exit:* journeys C and D on device.

**Phase 6: Hardening and production readiness**
- Rate limits on public and auth routes, a strict CSP (no third-party auth origins), a session and cookie security review.
- Performance: a seeded 10k-incident dataset, p95 under 300 ms on list and detail, `EXPLAIN` on hot queries.
- Backup and restore runbook, health and readiness checks.
- README and deployment docs.
- EAS build profiles, store prep checklist.
- *Exit:* the PRD acceptance checklist.

---

## 4. Verification (every phase)
- `pnpm -r typecheck` and `pnpm -r lint`.
- `pnpm --filter api test -- --no-file-parallelism` against the docker Postgres.
- `docker compose up` and a manual smoke test of the phase's journey in the browser (Claude in Chrome) and on an Expo device or emulator.
- Each phase ends with a review pass (`/code-review`) and a security pass on new endpoints, before asking you to approve commit and merge.
