# Sentinel: PRD, SRS and Design System

Status: plan only, nothing built. Version 1.1, 2 October 2026. Confirmed decisions applied: Expo app for employees and intervenants, web for supervisors and platform admin.

Evidence base. Read in full: Prisma schema, shared package, dependency manifests, frontend index.html, parts of backend routes, parts of the CSS and the incident creation flow. Not read in full: most React components, the mobile app, the backend auth middleware. Items marked (verify) must be checked in code before work starts.

Vocabulary used below. Supervisor (code today: ADMINISTRATOR), Employee or Reporter (USER), Intervenant (RESPONSABLE). Target enum names: SUPERVISOR, REPORTER, INTERVENANT.

---

## 1. Audit: inconsistencies to fix

### 1.1 Data model

| # | Finding | Impact | Fix |
|---|---|---|---|
| D1 | `Organization.id` is `@db.Uuid` but every `organizationId` FK column is plain `String`. `User.id` is plain `String` while other FKs to it mix types. | Type mismatch, no DB-level integrity guarantee on some joins | One rule: every PK and FK is `uuid` with `@db.Uuid` |
| D2 | Routes read `getAuth(req).orgId` and `userId` (Clerk IDs such as `org_...`, `user_...`) and compare them to internal columns (`responsable: { userId: a.userId }`, `incident.organizationId`). Internal IDs are UUIDs. (verify) | Queries either never match or only work by accident in tests | Store `clerkOrgId` and `clerkUserId` as unique columns. A middleware resolves them once per request to internal UUIDs and exposes `ctx.orgId`, `ctx.userId`, `ctx.membershipId` |
| D3 | Roles are an array on membership (`UserRole[]`), so one person can be USER, RESPONSABLE and ADMINISTRATOR in the same org | Ambiguous permissions, cannot enforce "reporter belongs to one org" | One role per membership. One row per (org, user) |
| D4 | No rule that a reporter belongs to exactly one organization. Intervenant multi-org is only implicit through `ResponsableProfile` | Business rule not enforced | Partial unique index: one active REPORTER membership per user. Intervenant memberships unlimited |
| D5 | No employee data (code, job title, department, home site, phone). Intervenant has only `isActive` | Cannot run a real B2B directory | Add `EmployeeProfile` and `IntervenantProfile` plus global `Certification` |
| D6 | `Organization` has only name, slug, createdAt | No B2B identity, billing contact, timezone, locale, legal consent | Extend (see 3.2) |
| D7 | `Session` model duplicates what Clerk already manages | Dead weight, token hash never the source of truth | Remove |
| D8 | Child tables copy `organizationId` but nothing guarantees it equals the parent's `organizationId` | Cross-tenant corruption possible | Composite FK `(parentId, organizationId)` referencing a unique `(id, organizationId)` on the parent |
| D9 | `Assignment.assignedById`, `Notification.recipientId`, `AuditEvent.actorId` have no consistent FK. `isActive` and `status` encode the same fact twice | Orphans, contradictory states | FK to membership, replace `isActive` with status, add partial unique index: one live assignment per incident |
| D10 | `Incident.category` is free `String`. `priority` is set by the reporter, but the spec says triage belongs to the supervisor | Dirty category data, triage cannot be audited | `IncidentCategory` table per org. Split `reportedPriority` (reporter) and `priority` (supervisor, set at triage) |
| D11 | Frontend derives `title` from the first 80 characters of the description, while the spec marks title as required | Poor list readability, spec drift | Title field required in the form |
| D12 | No human-readable incident reference | Users cannot quote an incident (UUID prefix is used today) | `reference` such as `INC-2026-00042`, per-org counter |
| D13 | `eventType` on `AuditEvent` and `Notification` is `String` | Typos, no exhaustive handling | Enums |
| D14 | Reporter, assignee and authors point at `User`, not at the org-scoped membership | History loses the org context when a person leaves or switches | Point domain tables at `Membership` |
| D15 | Comments have no visibility | Supervisors and intervenants cannot discuss internally without the reporter reading it | `visibility`: PUBLIC or INTERNAL |
| D16 | No invitation entity, no import job | Required by the new flow | Add `Invitation`, `ImportJob` |
| D17 | Missing timestamps for KPIs (acknowledged, started, resolved, closed) | MTTA and MTTR cannot be computed reliably | Add explicit timestamps on `Incident` and `Assignment` |
| D18 | Three migrations, two naming styles (`202609090001_init`, `20260909_add...`). No production data is mentioned | Messy history | Squash to one baseline migration (assumes no production data, confirm) |

### 1.2 Product and code

| # | Finding | Fix |
|---|---|---|
| P1 | Public sign-up exists today, contradicting the target flow | Disable open sign-up. Only two entry points: B2B organization registration, and invitation acceptance |
| P2 | App title is "Nexus Incidents", product is Sentinel | Single brand name everywhere |
| P3 | Three styling systems coexist: Fluent UI dependency, Tailwind v4, and a large hand-written `index.css` with hard-coded hex values. `packages/shared/theme.ts` carries a Fluent token set (verify usage) | One system: Tailwind v4 with CSS-variable tokens. Remove Fluent UI and the Fluent theme |
| P4 | Accent naming drift (`.fill-teal` is emerald, `.owner-avatar-green` is blue) | Semantic tokens only, no colour names in class names |
| P5 | Attachments are streamed from the API with `readFile`; the spec requires signed URLs | Object storage plus short-lived signed URLs |
| P6 | `zod` 3 in shared, zod 4 in backend and frontend | Align on one major version |
| P7 | `.env` files and compiled `dist/` folders appear in the snapshot (verify whether git-tracked) | Ensure ignored, rotate any real secret |
| P8 | Backend routes carry business logic inline (`assignments.routes.ts`), service files are empty | Move logic to services, routes stay thin |
| P9 | Mobile app is an Expo scaffold: three navigators and `api.ts`. The `screens` and `contexts` folders list no files in the snapshot (verify) | Becomes the primary surface for employees and intervenants. Screens are rebuilt on the new API and shared tokens |

---

## 2. PRD

### 2.1 Problem and product

Organizations with several sites (facilities, campuses, plants, retail networks, property managers) lose time between "someone noticed a problem" and "the right technician fixed it, and someone checked". Sentinel is a multi-tenant incident management platform: employees report, supervisors triage and assign, intervenants (internal technicians or external contractors) resolve, supervisors verify and close, with a complete audit trail.

Buyer: operations or facility manager. Daily users: supervisors (desktop), intervenants (phone, in the field), employees (phone or desktop, occasional).

### 2.2 Goals and non-goals

Goals for v1:
1. An organization can register, configure itself, and invite its people in under 15 minutes without our help.
2. The full loop works per role: report, triage, assign, accept, work, resolve, verify, close.
3. Strict tenant isolation, proven by automated adversarial tests.
4. A product that looks and behaves like enterprise software: dense, fast, predictable.
5. Two surfaces: an Expo app for employees and intervenants, a web console for supervisors and platform admins.

Non-goals for v1: billing and payments, SSO/SAML, SLA engine, automatic assignment, email and SMS notification channels (transactional emails for registration and invitations remain), multi-photo albums, geofencing. Push notifications are a should, not a must. Platform admin access to incident content is excluded by default.

### 2.3 Personas

| Persona | Context | Primary job | Device |
|---|---|---|---|
| Supervisor (org owner or delegate) | Office, many incidents per day | Keep nothing unowned or stale. Know workload | Web console |
| Employee (reporter) | Anywhere on site, 30 seconds to spare | Report fast, see what happened | Expo app |
| Intervenant | On the move, gloves, bad network, may serve several client organizations | Know what is mine today, accept, update, close out with proof | Expo app |
| Platform admin (Sentinel staff) | Internal, cross-organization | Keep organizations healthy, suspend abuse, watch registrations | Web console |

### 2.4 Core journeys

**A. Organization onboarding.** Public B2B form, email verification, first supervisor account created, setup checklist (add a site, review categories, invite people).

**B. People onboarding.** Supervisor creates employees (single or CSV) and invites intervenants. The invitation link opens the Expo app (or a store page if not installed). Nobody can sign up on their own. Employees are bound to this organization only. An intervenant who already exists on the platform gets a join request and must accept it, which creates one more membership.

**C. Incident loop.** Employee reports. Supervisor qualifies (category, priority, context) and assigns. Intervenant accepts or declines with reason. Intervenant posts updates, then resolves with a resolution note and evidence. Supervisor closes or sends back with a reason.

**D. Multi-organization intervenant day.** One login, organization switcher, plus a cross-organization "My work" list limited to their own assignments.

**E. Platform operations.** A platform admin reviews new registrations, sees usage per organization, suspends or reactivates an organization with a reason. No access to incident content.

### 2.5 Feature scope by role

Priorities: M = must for v1, S = should, C = could (later).

**Platform (public)**

| Feature | P |
|---|---|
| B2B registration form with email verification | M |
| Sign in, password reset, invitation acceptance page | M |
| Terms and data-processing acceptance with version stored | M |

**Supervisor console**

| Feature | P |
|---|---|
| Setup checklist and first-run guidance | M |
| Organization settings (profile, timezone, locale, billing contact) | M |
| Sites CRUD with map perimeter, activate and deactivate | M |
| Incident categories CRUD with default priority and linked specialty | M |
| Team directory: employees and intervenants, filters, status | M |
| Add employee, edit, suspend, revoke. CSV bulk import with row-level error report | M |
| Invite intervenant by email, assign specialties and site access, resend, revoke | M |
| Incident inbox: table with search, filters, saved views, bulk select | M |
| Incident detail drawer: overview, timeline, comments (public and internal), evidence | M |
| Triage and assign with eligibility hints (site access, specialty, availability, current load) | M |
| Review resolution: close or send back with reason | M |
| Dashboard: open by status, ageing, MTTA, MTTR, by site, by category, intervenant workload | M |
| Map view of open incidents | M |
| Audit log viewer with export (CSV) | S |
| Notification centre | M |
| Delegate supervisor role, transfer ownership | S |
| Reassignment requests queue | M |

**Platform admin (web, `/platform`)**

| Feature | P |
|---|---|
| Organization list with search, status, plan, member and site counts, last activity | M |
| Organization detail: profile, status history, counts, owner contact | M |
| Suspend and reactivate with mandatory reason | M |
| Registration pipeline: pending, expired, resend verification | M |
| Edit plan and trial end date | S |
| Platform audit log | M |
| Time-boxed support access to an organization, granted by its owner | C |

**Employee (Expo app)**

| Feature | P |
|---|---|
| Report incident in 3 steps (what, where, confirm), photo optional | M |
| My incidents list and detail with status timeline | M |
| Comment on own incident | M |
| In-app notifications on status changes | M |
| Profile (phone, language) | M |
| Offline draft and send queue when the connection drops | M |
| Push notifications | S |

**Intervenant (Expo app)**

| Feature | P |
|---|---|
| My work: assignments grouped by action needed (to accept, in progress, awaiting review) | M |
| Accept, decline or request reassignment with reason | M |
| Structured updates (started, on site, blocked, update) with optional photo | M |
| Resolve with note and evidence | M |
| Organization switcher and cross-organization work list | M |
| Profile: phone, company, certifications with expiry | M |
| Availability toggle (available, busy, off) | S |
| Navigate to site (opens maps app) | S |
| Offline queue for updates and resolution | M |
| Push notifications | S |

### 2.6 Success metrics

| Metric | Target at v1 pilot |
|---|---|
| Time from registration to first incident created | under 20 minutes median |
| Invitation acceptance within 7 days | above 80 percent |
| Median time to acknowledgement (NEW to accepted) | tracked, baseline set in pilot |
| Median time to resolution | tracked, baseline set in pilot |
| Cross-tenant leak tests failing | zero |
| Supervisor weekly active share | above 70 percent of invited supervisors |

### 2.7 Assumptions to validate before heavy investment

1. Buyers will register employees by import or one by one. Evidence that would kill it: pilots refuse to maintain a directory, then a join-code or SSO model is needed.
2. Intervenants are mostly external contractors serving several clients. If they are mostly internal staff, the multi-organization work is over-built for v1.
3. Self-serve registration is acceptable without manual approval. Risk: fake organizations. Mitigation: email verification, rate limits, suspend tool.
4. Organizations will pay per organization or per seat. Model not defined yet: trial fields are reserved, billing deferred.
5. Employees and intervenants will install a native app. Risk: occasional reporters and external contractors resist installing. Kill signal: invitation-to-first-login rate below 60 percent in the pilot. Fallback if it happens: a minimal web report page and web assignment view, built on the same API.
6. Deep links from invitation emails reliably open the app or fall back to a store page (verify Expo universal links and deferred deep link options).

---

## 3. SRS

### 3.1 Actors and permissions

Owner is a flag on a supervisor membership (`isOwner`). One owner minimum per organization.

| Action | Employee | Intervenant | Supervisor | Owner |
|---|---|---|---|---|
| Edit organization profile, transfer ownership | no | no | no | yes |
| Manage sites, categories | no | no | yes | yes |
| Add, edit, suspend employees | no | no | yes | yes |
| Invite, suspend intervenants | no | no | yes | yes |
| Create incident | yes | no | yes (on behalf of an employee) | yes |
| Read incident | own only | assigned only (active and past) | all in org | all |
| Triage, assign, reassign | no | no | yes | yes |
| Accept, decline, request reassignment | no | own assignment | no | no |
| Post progress, resolve | no | own active assignment | no | no |
| Close or send back | no | no | yes | yes |
| Comment public | own incident | assigned | yes | yes |
| Comment internal, read internal | no | assigned | yes | yes |
| Read audit log | no | no | yes | yes |
| View dashboards and map | no | assigned incidents only | yes | yes |

Platform admin is a separate actor, not a member of any organization (table `PlatformAdmin`, MFA mandatory). Platform routes live under `/platform` with their own guard and never accept an organization context. Platform admins can see organization metadata and counts, and suspend or reactivate, but cannot read incidents, comments, attachments or members' personal data by default.

Reporter identity shown to an intervenant: display name and site only. Phone shown only if the supervisor enables it in settings (default off).

### 3.2 Target domain model

All keys uuid. Every tenant-scoped table carries `organizationId`. Composite FKs enforce same-tenant parents (invariant I1).

**Identity and tenancy**

| Entity | Key fields |
|---|---|
| Organization | id, clerkOrgId (unique), slug (unique), legalName, displayName, registrationNumber, taxId (optional), industry (enum), sizeBand (enum), country, addressLine, city, postalCode, timezone, defaultLocale, website, billingEmail, status (PENDING_VERIFICATION, ACTIVE, SUSPENDED, CLOSED), plan (TRIAL, STARTER, BUSINESS), trialEndsAt, termsVersion, termsAcceptedAt, termsAcceptedByUserId, createdAt |
| User (global person) | id, clerkUserId (unique), email (unique), firstName, lastName, phone, locale, status, lastLoginAt |
| Membership | id, organizationId, userId, role (SUPERVISOR, REPORTER, INTERVENANT), isOwner, status (INVITED, ACTIVE, SUSPENDED, REVOKED), invitedByMembershipId, joinedAt. Unique (organizationId, userId). Partial unique: one REPORTER membership in status INVITED or ACTIVE per user (raw SQL in migration, Prisma has no native partial index) |
| EmployeeProfile (1:1 membership, role REPORTER) | employeeCode (unique per org), jobTitle, department, homeSiteId, workPhone |
| IntervenantProfile (1:1 membership, role INTERVENANT) | internalRef, availability (AVAILABLE, BUSY, OFF), coverageNotes |
| IntervenantIdentity (1:1 user, global) | companyName, tradeSummary |
| Certification (global, belongs to user) | name, issuer, number, issuedAt, expiresAt, documentRef. Visible to an organization only while the person has a membership there |
| Specialty (per org), IntervenantSpecialty | membershipId, specialtyId |
| SiteAccess | membershipId, siteId, status (ACTIVE, REVOKED) |
| Invitation | id, organizationId, email, role, tokenHash, profilePayload (json), invitedByMembershipId, expiresAt, acceptedAt, revokedAt |
| ImportJob | id, organizationId, kind (EMPLOYEES), fileRef, status, totalRows, createdRows, errorReportRef, createdByMembershipId |
| PlatformAdmin | userId (unique), createdAt. Seeded by CLI, never created through the UI |
| PlatformAuditEvent | id, platformAdminUserId, organizationId (nullable), eventType (enum), reason, payload, createdAt. Append-only |
| DeviceToken | id, userId, platform (IOS, ANDROID), pushToken (unique), appVersion, locale, lastSeenAt, revokedAt |

**Operations**

| Entity | Key fields |
|---|---|
| Site | id, organizationId, code (unique per org), name, address, latitude, longitude, boundaryType, radiusMeters, boundaryGeoJson, timezone, contactName, contactPhone, isActive |
| IncidentCategory | id, organizationId, name, defaultPriority, specialtyId (optional), isActive. Seeded from an industry template at registration |
| Incident | id, organizationId, reference (unique per org), siteId, reporterMembershipId, title, description, categoryId, reportedPriority, priority (null until triage), status, location fields (lat, lng, source, accuracy, distanceFromSite), resolutionText, version, createdAt, triagedAt, firstAssignedAt, startedAt, resolvedAt, closedAt, updatedAt |
| Assignment | id, organizationId, incidentId, intervenantMembershipId, assignedByMembershipId, status (PENDING_ACCEPTANCE, ACCEPTED, DECLINED, REASSIGNMENT_REQUESTED, SUPERSEDED, COMPLETED), declineReason, reassignReason, assignedAt, respondedAt, endedAt, version |
| ProgressUpdate | id, organizationId, incidentId, assignmentId, authorMembershipId, type, note, createdAt |
| Comment | id, organizationId, incidentId, authorMembershipId, visibility (PUBLIC, INTERNAL), body, createdAt |
| Attachment | id, organizationId, incidentId, progressUpdateId (optional), uploadedByMembershipId, kind (REPORT_PHOTO, EVIDENCE), originalName, mimeType, sizeBytes, storageKey, createdAt |
| AuditEvent | id, organizationId, incidentId (nullable), actorMembershipId (nullable for system), actorUserId, eventType (enum), payload, createdAt. Append-only |
| Notification | id, organizationId, recipientMembershipId, eventType (enum), incidentId, title, body, readAt, createdAt |
| OrganizationCounter | organizationId, name, value. Used for incident references, incremented in the same transaction as the incident insert |

Removed: `Session`, `ResponsableProfile`, `ResponsableSpecialty`, `ResponsableSite`, free-text `Incident.category`, `Assignment.isActive`.

### 3.3 Invariants (enforced in DB where possible)

| ID | Rule |
|---|---|
| I1 | A child row and its parent share the same `organizationId` (composite FK) |
| I2 | A user has at most one active REPORTER membership in the whole platform |
| I3 | One membership per (organization, user). Role is single-valued |
| I4 | At most one live assignment per incident (partial unique index on status in PENDING_ACCEPTANCE, ACCEPTED, REASSIGNMENT_REQUESTED) |
| I5 | Incident original fields (title, description, category at report, location, reporter, createdAt) are immutable after submission. Triage writes `priority` and `categoryId` through audited events |
| I6 | The last active owner cannot be suspended, revoked or demoted |
| I7 | AuditEvent rows cannot be updated or deleted (DB privilege plus trigger) |
| I8 | An incident in CLOSED is read-only |
| I9 | Server sets all timestamps, never the client |
| I10 | An intervenant can only be assigned if their membership is ACTIVE and has ACTIVE access to the incident's site |
| I11 | Revoking a membership keeps all historical rows. Authorship stays attributable |
| I12 | Platform routes are reachable only by a PlatformAdmin with MFA. Every platform action writes a PlatformAuditEvent. Platform guards and tenant guards are mutually exclusive |
| I13 | A suspended organization rejects every tenant request, including from already issued tokens, on the next request |

### 3.4 State machines

**Incident:** NEW, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED. Sends back RESOLVED to IN_PROGRESS with mandatory reason. No skipped states. Decline or reassignment request keeps the incident in its current state and ends the assignment, so a new assignment is created. When the live assignment ends in ASSIGNED, the incident returns to NEW.

**Assignment:** PENDING_ACCEPTANCE to ACCEPTED, DECLINED, SUPERSEDED. ACCEPTED to REASSIGNMENT_REQUESTED, COMPLETED, SUPERSEDED. Accepting moves incident ASSIGNED to IN_PROGRESS atomically (already how the code behaves) and sets `startedAt`.

**Membership:** INVITED to ACTIVE, REVOKED. ACTIVE to SUSPENDED, REVOKED. SUSPENDED to ACTIVE, REVOKED.

**Organization:** PENDING_VERIFICATION to ACTIVE. ACTIVE to SUSPENDED, CLOSED.

### 3.5 Functional requirements

**Registration and identity (FR-REG)**
- FR-REG-01 Public endpoint accepts the B2B form (legal name, display name, registration number, industry, size band, country, address, timezone, website, primary contact first and last name, email, phone, password, terms acceptance). Rate limited per IP and per email.
- FR-REG-02 Organization created as PENDING_VERIFICATION. Verification email with single-use link, 24 hour expiry. On verification: organization ACTIVE, owner membership ACTIVE, default categories seeded.
- FR-REG-03 No other public sign-up route exists. Self-service account creation is disabled at the identity provider (verify provider setting and plan limits for Organizations in Clerk docs before committing).
- FR-REG-04 Invitation links are universal links. Employees and intervenants: opens the Expo app on the acceptance screen, or a web landing page with store links that preserves the token. Supervisor delegates: opens the web console. The acceptance screen validates the token, shows organization name and role, collects a password if the person is new, or asks sign-in if the email already exists.
- FR-REG-05 Duplicate protection: normalized email unique, registration number checked per country with a soft warning.

**People (FR-PPL)**
- FR-PPL-01 Supervisor creates an employee with email, name, employee code, job title, department, home site, phone. An invitation is sent. The account is unusable until accepted.
- FR-PPL-02 CSV import: template download, dry-run validation, row-level error file, commit only valid rows, idempotent by employee code.
- FR-PPL-03 An email that already holds an active REPORTER membership elsewhere is rejected with a clear error (I2).
- FR-PPL-04 Supervisor invites an intervenant by email with specialties and site access. Existing user: join request, accepted in app or by email link. New user: invitation link.
- FR-PPL-05 Suspend, reactivate, revoke. Revocation takes effect on the next request (membership checked server-side every request, not only at login).
- FR-PPL-06 Intervenant manages own profile and certifications. Supervisor sees certification status and expiry for members only.

**Incidents (FR-INC)**
- FR-INC-01 Create: title, description, category, site (active, in org), location, optional photo, confirmation step. Reporter priority is a suggestion.
- FR-INC-02 Reference generated server-side per organization.
- FR-INC-03 Triage: supervisor sets category and priority, adds context. Original text untouched.
- FR-INC-04 List: role-scoped, search on reference, title, description, filters (status, priority, category, site, assignee, date), sort, pagination, saved views for supervisors.
- FR-INC-05 Detail visibility follows 3.1. Internal comments hidden from employees at API level, not only UI.

**Assignment and workflow (FR-WF)**
- FR-WF-01 Supervisor assigns. Suggestions ranked by site access, specialty match, availability, open load. Ineligible members are not selectable (I10).
- FR-WF-02 Intervenant accepts or declines (reason required, 5 to 500 characters).
- FR-WF-03 Reassignment request creates a queue item for supervisors. Supervisor resolves by reassigning or rejecting the request with a note.
- FR-WF-04 Progress updates and resolution by the live assignee only. Resolution note required.
- FR-WF-05 Close or send back by supervisor. Send back requires a reason and notifies the assignee.
- FR-WF-06 Concurrent mutations use optimistic version checks and return CONFLICT_CONCURRENT_UPDATE.

**Notifications (FR-NTF)**
- FR-NTF-01 In-app notifications for: assigned, accepted, declined, reassignment requested, progress, resolved, sent back, closed, invitation accepted, certification expiring (30 days).
- FR-NTF-02 No duplicates (unique key on event plus recipient plus incident plus version).

**Platform (FR-PLT)**
- FR-PLT-01 List and search organizations with status, plan, creation date, member and site counts, last activity date.
- FR-PLT-02 Suspend and reactivate an organization with a mandatory reason. Suspension takes effect on the next request (I13) and emails the owner.
- FR-PLT-03 Registration pipeline: pending and expired verifications, resend verification email. Expired pending registrations purged after 7 days.
- FR-PLT-04 Usage figures per organization are counts only (members, sites, incidents per month). No incident content is exposed.
- FR-PLT-05 Platform admins are created by seed or CLI. MFA required. Every action is written to PlatformAuditEvent.
- FR-PLT-06 Edit plan and trial end date.

**Mobile (FR-MOB)**
- FR-MOB-01 Sign-in through the identity provider's Expo SDK, tokens in secure storage (verify the SDK choice against the current Clerk Expo support). Biometric unlock is a should.
- FR-MOB-02 Offline queue for incident creation, progress updates, resolution and comments. Each queued action carries an idempotency key. The UI shows pending, sent and failed with retry. Photos are resized client side (long edge 1920 px) to stay under 5 MB.
- FR-MOB-03 On launch the app calls `app-config`. Below the minimum supported version it shows a blocking update screen.
- FR-MOB-04 Push notifications mirror in-app events, per-user opt-out, payload limited to reference and event type.
- FR-MOB-05 Location permission is requested only at the Where step or the On site update, with manual pin as fallback when denied.
- FR-MOB-06 Intervenants get an organization switcher. Employees never see one.
- FR-MOB-07 Fonts are bundled. Language follows the user locale.

**Reporting (FR-RPT)**
- FR-RPT-01 Dashboard metrics scoped to organization: counts by status, by priority, ageing buckets, MTTA, MTTR, by site, by category, intervenant workload, 30 day trend.
- FR-RPT-02 Map of open incidents, role-scoped.
- FR-RPT-03 Audit log filter by incident, actor, event type, date. CSV export.

**Evidence (FR-ATT)**
- FR-ATT-01 JPEG, PNG, WebP up to 5 MB. Magic-byte check (exists today). Stored in object storage, delivered by signed URL valid 5 minutes, issued only after the same scope check as the incident.

### 3.6 API surface (REST, versioned `/v1`, all tenant routes derive org from session)

| Group | Endpoints |
|---|---|
| Public | `POST /public/organizations`, `POST /public/organizations/verify`, `GET /public/invitations/:token`, `POST /public/invitations/:token/accept` |
| Me | `GET /me` (memberships, active org), `POST /me/active-organization`, `PATCH /me/profile`, certifications CRUD |
| Organization | `GET/PATCH /organization`, sites, categories, specialties CRUD |
| People | `GET/POST /members`, `PATCH /members/:id`, `POST /members/:id/suspend`, `.../revoke`, `POST /members/import` (dry-run and commit), `GET /invitations`, `POST /invitations/:id/resend`, `.../revoke` |
| Incidents | `GET/POST /incidents`, `GET /incidents/:id`, `POST /incidents/:id/triage`, `/assign`, `/close`, `/send-back`, comments, attachments, timeline |
| Assignments | `GET /assignments` (mine, cross-org option), `POST /assignments/:id/accept`, `/decline`, `/request-reassignment`, `/progress`, `/resolve` |
| Reporting | `GET /dashboard`, `GET /map`, `GET /audit` |
| Notifications | `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all` |
| Platform (platform admins only) | `GET /platform/organizations`, `GET /platform/organizations/:id`, `POST /platform/organizations/:id/suspend`, `.../reactivate`, `PATCH /platform/organizations/:id/plan`, `GET /platform/registrations`, `POST /platform/registrations/:id/resend`, `GET /platform/audit` |
| App | `GET /v1/app-config` (minimum app version, feature flags), `POST /me/devices`, `DELETE /me/devices/:id` |

Conventions: cursor pagination, uniform error body `{code, message, details, requestId}`, idempotency key on create and state-changing POSTs.

### 3.7 Non-functional requirements

| Area | Requirement |
|---|---|
| Tenant isolation | Every query scoped by `ctx.orgId`. Automated adversarial suite: for each endpoint, a user from org B must get 404 on org A resources. Platform routes must return 403 for every token that is not a platform admin with MFA. CI blocks on failure |
| Security | Rate limits on public routes, security headers, CSRF-safe token handling, input validation with shared zod schemas, secrets only in environment, signed URLs, audit of every state change, password policy delegated to identity provider |
| Performance | p95 list and detail under 300 ms at 10 000 incidents per organization. Dashboard under 800 ms. Indexes defined for every filter used in lists |
| Availability and data | Daily backups, tested restore, health endpoint, structured logs with request id |
| Privacy | Terms and processing agreement versioned. Data export and organization deletion procedure documented. Retention policy for attachments |
| Accessibility | WCAG 2.2 AA. Keyboard-complete, visible focus, no information by colour alone |
| i18n | French and English, user-level locale, organization default. Dates in organization timezone |
| Browsers | Last two versions of Chrome, Edge, Safari, Firefox, for the web console |
| Mobile | iOS and Android versions supported by the chosen Expo SDK (verify minimums). Cold start under 3 s on a mid-range device. Dynamic type respected up to 130 percent. Pilot distribution through EAS internal builds, then store release |
| Testing | Unit for services and state machines. Integration for every route with role matrix. E2E for journeys A to D. Concurrency test for double assignment |

### 3.8 Migration plan

1. Confirm no production data (assumption D18). If true: one baseline migration, reseed.
2. If data exists: write a data migration mapping ResponsableProfile to Membership plus IntervenantProfile, USER to REPORTER, ADMINISTRATOR to SUPERVISOR with owner flag on the first one, then backfill categories from distinct strings.
3. Introduce the context resolver (D2) before touching routes, so every route moves to internal IDs in one pass.

---

## 4. UX architecture

### 4.1 Routes and shells

| Area | Route | Shell | Primary navigation |
|---|---|---|---|
| Public | `/register`, `/login`, `/verify`, `/invite/:token`, `/reset` | Minimal centered page | none |
| Supervisor | `/app/...` | Left rail plus top bar, desktop first | Dashboard, Incidents, Map, Team, Sites, Categories, Audit, Settings |
| Employee (Expo app) | tab stack | Bottom tabs, single column | Report, My incidents, Notifications, Profile |
| Intervenant (Expo app) | tab stack | Bottom tabs, organization switcher in header | My work, History, Notifications, Profile |
| Platform admin (web) | `/platform/...` | Same shell as the supervisor console, with a persistent "Platform mode" banner | Organizations, Registrations, Audit |

Web sign-in: supervisors land on `/app`, platform admins on `/platform`. A web sign-in with only employee or intervenant memberships shows a "Use the Sentinel app" page with store links. The app lists only employee and intervenant memberships, the web console only supervisor memberships, so a person who supervises one organization and works as an intervenant for another uses each surface for its role.

### 4.2 Key screens

**Registration (B2B form).** Three steps, because it is a real sequence: Company, Primary contact, Review and accept. Single column 560 px on canvas. Inline validation, one field group per step, progress shown as step labels with the current step in ink and completed steps with a check. No marketing panel. Footer: link to sign in. Success: "Check your email" with resend and wrong-email correction.

**Setup checklist (first login).** Persistent panel on the dashboard until complete: Add your first site, Review categories, Invite your team. Each item states what it does and links to the page.

**Team.** One table, tabs Employees and Intervenants and Invitations. Columns for employees: name, code, job title, department, home site, status. For intervenants: name, company, specialties, sites, availability, certification status. Actions: Add employee, Import CSV, Invite intervenant. Import wizard: upload, review validation, confirm.

**Incident inbox.** Table with filter bar (status, priority, site, category, assignee), saved views, density toggle. Row click opens the drawer; the drawer has Overview, Timeline, Evidence tabs and a sticky action bar that shows only actions valid for the current state and role.

**Assign dialog.** Candidate list with fit indicators: site access, specialty match, availability, open assignments count. Ineligible people are listed disabled with the reason.

**Dashboard.** Top: four figures (open, unassigned, awaiting review, median time to resolution). Below: status breakdown, ageing, workload by intervenant, trend. Tables before charts where the user needs to act. Charts have no decoration.

**Employee report flow.** Step 1 What happened (title, description, photo). Step 2 Where (site, pin on map, GPS suggestion). Step 3 Confirm. Success shows the reference and expected next step.

**Intervenant My work.** Three groups ordered by urgency: Needs response, In progress, Awaiting review. Card shows reference, title, site, priority, organization name when the person has several. Assignment detail has one primary action fixed at the bottom of the screen (Accept, then Post update, then Resolve). Resolve form: note, photo, confirm.

**Platform admin screens.** Organizations table (name, status, plan, members, sites, last activity, created). Organization detail: profile, owner contact, counts, status history, Suspend and Reactivate with a reason dialog. Registrations: pending and expired with resend. Audit log. No incident content anywhere.

**Mobile navigation.** Employee: four tabs, with Report as the prominent action on the first tab. Intervenant: My work, History, Notifications, Profile, with the organization switcher in the header. Primary actions sit in a fixed bottom bar, forms use full-screen sheets, lists use 56 pt rows. Pending offline actions show as a count badge in the header with a detail sheet.

### 4.3 Empty, error and loading states

Empty states state the action: "No incidents yet. Employees can report from their phone, or you can create one." Errors say what failed and what to do. Loading uses skeletons that match layout. Offline: banner with queued drafts for report and updates (S).

---

## 5. Design system

Design direction. Subject: operational software for facility and site teams. Voice: calm, exact, dense where experts work, spacious where occasional users act. The product should feel like infrastructure, not a brand campaign. The single memorable element is the incident drawer: a compact case file with a continuous timeline.

What is explicitly avoided: cream and terracotta palettes, near-black with acid accent, identical rounded cards with soft shadows, gradient washes, all-caps eyebrow labels, numbered decorative markers, monospace labels, arrow suffixes on buttons, entrance animations on every section.

### 5.1 Colour tokens (light theme, dark theme deferred but tokenized)

```css
:root {
  /* surfaces */
  --canvas: #F3F5F7;
  --surface: #FFFFFF;
  --surface-sunken: #EBEEF2;
  --border: #D5DBE2;
  --border-strong: #B7C0CB;

  /* text */
  --ink: #121C26;       /* 16.9:1 on surface */
  --ink-2: #3D4A58;     /* 9.6:1 */
  --ink-3: #5E6B79;     /* 5.4:1, minimum for secondary text */
  --ink-disabled: #8C97A3;

  /* brand and action */
  --brand: #0B4F8A;
  --brand-hover: #093F70;
  --brand-pressed: #073256;
  --brand-tint: #E6EFF8;
  --focus: #1A73C9;

  /* semantic */
  --critical: #B3261E;  --critical-tint: #FCEBEA;
  --high: #B85400;      --high-tint: #FDF0E3;
  --medium: #8A6A00;    --medium-tint: #FBF4DA;
  --low: #4B5F72;       --low-tint: #EAEFF4;
  --success: #12724A;   --success-tint: #E4F4EC;
}
```

Usage rules. Brand colour is reserved for primary actions, links, selection and the active nav item. Everything else is neutral. Priority and status are never colour only: each carries a text label and a distinct glyph (critical: filled triangle, high: filled square, medium: filled circle, low: outlined circle; status uses the same shape-plus-label approach). Charts use brand for the main series, `--ink-3` for comparison, semantic colours only when the value is a status. No gradients.

Incident status presentation: New (neutral fill), Assigned (brand outline), In progress (brand fill), Resolved (success outline), Closed (muted fill).

### 5.2 Typography

Family: IBM Plex Sans for all UI (French accent coverage, weights 400, 500, 600). One family only. Numerals: use tabular figures in tables and metrics (`font-variant-numeric: tabular-nums`). Fallback stack: `"IBM Plex Sans", "Segoe UI", system-ui, sans-serif`. Self-host the font files to avoid third-party requests.

| Token | Size / line | Weight | Use |
|---|---|---|---|
| text-xs | 12 / 16 | 400, 600 for table headers | Metadata, table headers, badges |
| text-sm | 13 / 20 | 400, 500 | Table cells, dense lists |
| text-base | 14 / 20 | 400, 500 | Default body and form fields |
| text-md | 16 / 24 | 500 | Mobile body, drawer titles |
| text-lg | 20 / 28 | 600 | Page titles |
| text-xl | 24 / 32 | 600 | Section headers on public pages, key metric values |
| text-2xl | 32 / 40 | 600 | Registration and sign-in titles only |

Rules: sentence case everywhere, including column headers and buttons. Letter spacing 0, except -0.01em at 24 and above. Maximum line length 72 characters for prose. No uppercase labels. Mobile minimum body size 16 to prevent iOS zoom on inputs.

### 5.3 Spacing, layout, shape

| Token | Value |
|---|---|
| Spacing scale | 4, 8, 12, 16, 24, 32, 48, 64 (4 px base) |
| Page gutter | 24 desktop, 16 mobile |
| Panel padding | 16 (dense), 24 (forms) |
| Content max width | 1440 for tables, 720 for forms, 560 for public forms |
| Left rail | 224 expanded, 56 collapsed. Top bar 48 |
| Drawer | 520 desktop, full screen mobile |
| Breakpoints | 640, 1024, 1440 |
| Table row | 40 default, 32 compact, 56 on mobile lists |
| Minimum tap target | 44 x 44 on field roles |

Radius by role, not one value everywhere: 2 for badges, 4 for inputs and buttons, 6 for panels and menus, 8 for modals and drawers, full only for avatars. Panels are defined by a 1 px `--border`, with no shadow. Elevation exists only for floating layers: popover `0 4px 12px rgba(18,28,38,.12)`, modal and drawer `0 12px 32px rgba(18,28,38,.18)`.

### 5.4 Components

| Group | Components and notes |
|---|---|
| Actions | Button (primary, secondary, ghost, danger; heights 28, 32, 40), icon button, link. One primary per view. Labels are verbs: Assign, Save changes, Send back |
| Inputs | Text, textarea with counter, select, combobox with search, date, phone, file drop, checkbox, radio, switch. Label above, help below, error replaces help in `--critical` with icon. Required marked in label text, not by asterisk only |
| Data | Data table (sticky header, sort, column visibility, row selection, density), filter bar with removable chips, pagination, saved views, key-value list, timeline, stat figure (number plus label plus optional delta, no card chrome) |
| Feedback | Toast (4 s, action allowed), inline banner (info, warning, critical), empty state, skeleton, spinner for under 400 ms actions only |
| Overlays | Drawer, modal (confirm and form), popover, menu. Focus trapped and restored |
| Navigation | Left rail, top bar, organization switcher, tabs, breadcrumb, stepper (registration and CSV import only, because they are true sequences), bottom tab bar (mobile) |
| Domain | StatusBadge, PriorityBadge, IncidentRow, AssignmentCard, CandidateRow (fit indicators), CertificationBadge (valid, expiring, expired), MapPanel with status markers, AuditEntry |

### 5.5 Interaction and motion

Motion only answers user action: drawer slide 160 ms, menu fade 120 ms, toast 160 ms, using ease-out. No entrance animation on page load, no hover lift. Row hover is a background change. `prefers-reduced-motion` disables all transitions except opacity. Focus ring: 2 px `--focus` with 2 px offset, always visible on keyboard focus. Destructive actions need a confirm dialog that names the object and the consequence.

### 5.6 Content rules

Plain verbs, sentence case, no filler. Same noun for the same thing everywhere (Employee, Intervenant, Supervisor, Site, Incident; never "user" in the UI). Button and resulting toast share a verb: "Assign" then "Assigned to Karim B." Errors never apologize and always give the next step: "Employee code already used by another member. Change the code or edit the existing member." Dates in organization timezone, relative time under 24 hours with the absolute value in a tooltip.

### 5.7 Technical implementation of the system

- Tailwind v4 with tokens declared in `@theme` from the variables above. Delete hard-coded hex values and colour-named classes.
- Remove `@fluentui/react-components` and the Fluent theme from `packages/shared` after verifying no import remains.
- Headless accessible primitives (Radix UI or React Aria) for dialog, popover, menu, combobox, tabs. Styled by our tokens.
- TanStack Table for data tables, TanStack Query for server state, React Hook Form with shared zod schemas for forms. Keep Zustand only for session and UI state.
- Folder layout: `features/{auth,registration,organization,team,incidents,assignments,dashboard,map,notifications}`, `components/ui` for primitives, `routes/{public,supervisor,employee,intervenant}`.
- Keep Leaflet for the web map. Use a low-saturation tile style and our status markers.
- Tokens become `packages/shared/tokens.ts` (colour, spacing, radius, type scale), replacing the Fluent theme. Tailwind theme on web and a small themed primitive layer on Expo (Button, Input, Badge, Sheet, ListRow, StatusBadge, PriorityBadge) consume the same names and values.
- Expo app: fonts through `expo-font`, safe areas, 44 pt targets, native navigation and sheet conventions per platform, shared visual language. Pick one map library and verify Expo SDK compatibility (none is in the current dependencies). The app is rebuilt on the shared API client and zod schemas.
- i18n: keep the existing FR and EN locale files, move to per-feature namespaces.
- A `/design` internal route renders every component and state for review.

---

## 6. Delivery plan

| Phase | Content | Exit criteria |
|---|---|---|
| 0 Foundation | Baseline migration with the new schema, context resolver (D2), role rename, composite FKs, partial indexes, seed, adversarial tenant test harness | All existing tests green on new model, harness covers every route |
| 1 Identity and onboarding | B2B registration, email verification, closed sign-up, invitation acceptance, sign-in redirects, organization switcher | Journey A and B (single add) pass E2E. No self sign-up path exists |
| 2 Supervisor console | Design system and shell, settings, sites, categories, team (add, import CSV, invite), incident inbox and drawer, triage, assign, close, notifications | Supervisor can run the loop end to end |
| 3 Employee app (Expo) | Invitation deep link, sign-in, report flow with offline queue, my incidents, notifications, profile, `app-config` gate, EAS internal build | Journey C reporter side passes on a physical iOS and Android device |
| 4 Intervenant app (Expo) | My work, accept, decline, updates, resolve with offline queue, profile and certifications, organization switcher, cross-organization list | Journeys C and D pass on physical devices |
| 5 Platform admin and reporting | Platform console (organizations, registrations, suspend, audit), supervisor dashboard, map, audit viewer and export | Journey E passes, platform guard tests green |
| 6 Hardening | Signed URLs, rate limits, accessibility audit, performance pass, push notifications, backup and restore test, store submission prep, docs | Acceptance checklist below |

Acceptance checklist: every FR above passes; zero cross-tenant failures; keyboard-only run of each web journey; mobile journeys run on a physical iOS and Android device, including offline then reconnect; Lighthouse accessibility 95 or higher on core pages; p95 targets met on a seeded 10 000 incident dataset; restore test documented.

## 7. Decisions pending (defaults applied in this document)

| # | Decision | Status |
|---|---|---|
| 1 | Intervenant identity | Confirmed: global account, joins each organization by accepting an invitation |
| 2 | Organization approval | Confirmed: self-serve with email verification, no manual review |
| 3 | Mobile | Confirmed: Expo app for employees and intervenants. Web for supervisors and platform admin |
| 4 | Billing | Deferred. Trial fields reserved on Organization |
| 5 | Existing data | No production data, baseline migration |
| 6 | Platform admin | Added: web console under `/platform`, separate guard and API namespace, MFA required, no access to incident content |
