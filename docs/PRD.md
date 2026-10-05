# Sentinel: product requirements (PRD v2.0)

| | |
|---|---|
| Version | 2.0, 5 October 2026 |
| Status | Draft for approval. Replaces PRD v1.1 (audit of the legacy code) |
| Scope | Greenfield rebuild of web console, mobile app, API and database |
| Companion docs | `docs/DESIGN_SYSTEM.md` (visual language, tokens, components, screens), `docs/design-system/specimen.html` (live preview of the tokens) |
| Superseded | `docs/architecture.md` and `docs/api-conventions.md` (written for the legacy Responsable model, page-based pagination and JWT). Section 7 replaces them. `docs/database-domain-model.md` and `docs/CAHIER_DES_CHARGES.md` stay as background only |

How to read this document: sections 1 to 3 say what we build and for whom. Sections 4 to 6 are the rules (features, permissions, logic) and are the contract for tests. Section 7 is the architecture. Sections 8 and 9 are the frontend requirements. Section 10 is the delivery plan. Priorities use M (must for v1), S (should), C (could, later).

---

## 1. Product

### 1.1 Problem

Organizations that run several sites (facilities, campuses, plants, retail networks, property managers) lose time between "someone noticed a problem" and "the right technician fixed it and someone checked". Reports travel by phone, chat and spreadsheets. Nobody can say who owns an issue, how long it has been open, or what was done.

### 1.2 Product

Sentinel is a multi-tenant B2B incident platform. One loop, tracked end to end with a full audit trail:

1. An **employee** reports an incident from their phone.
2. A **supervisor** triages it (category, priority) and assigns it from the web console.
3. An **intervenant** (internal technician or external contractor, possibly serving several client organizations) accepts, works and resolves it, with evidence.
4. The supervisor verifies and closes it, or sends it back.
5. **Platform admins** (Sentinel staff) manage tenant organizations without ever seeing incident content.

Buyer: the operations or facility manager. Daily users: supervisors (desktop), intervenants (phone, in the field, often on poor networks), employees (phone, occasional).

### 1.3 Goals and non-goals for v1

Goals:
1. An organization registers, configures itself and invites its people in under 15 minutes without our help.
2. The full loop works for every role: report, triage, assign, accept, work, resolve, verify, close.
3. Strict tenant isolation, proven by automated adversarial tests that block CI.
4. Software that feels fast and calm: no full-page reloads in the console, instant feedback, live updates, and field screens usable with gloves in daylight.
5. Two surfaces only: a web console (supervisors, platform admins) and an Expo app (employees, intervenants).

Non-goals for v1: billing and payments, SSO/SAML, an SLA engine, automatic assignment, SMS or email notification channels (transactional email for registration, invitations and suspension stays), photo albums, geofencing, supervisors scoped to a subset of sites, reopening closed incidents, duplicate merging, public API and webhooks.

### 1.4 Success metrics (pilot)

| Metric | Target |
|---|---|
| Registration to first incident created | median under 20 minutes |
| Invitation accepted within 7 days | above 80 percent |
| Invitation to first app sign-in | above 60 percent (kill signal for the native-app assumption) |
| Time to acknowledgement (incident created to first acceptance) | tracked, baseline set in pilot |
| Time to resolution (created to resolved) | tracked, baseline set in pilot |
| Cross-tenant leak tests failing | zero, always |
| Weekly active supervisors / invited supervisors | above 70 percent |
| Incidents reported offline that sync without duplicates | 100 percent |

### 1.5 Product principles

1. **The next action is always obvious.** Every screen shows what needs this person now, and only the actions valid for the current state and role.
2. **One incident, one source of truth.** The case file (header, state, Thread of events, evidence) is the same object for every role, filtered by permission.
3. **Trust is visible.** Who did what and when is never hidden from the people allowed to see it. Original reports are never edited.
4. **Fast beats feature-rich.** Optimistic updates, no spinners over 400 ms, no reloads. If a flow takes more than three steps for an occasional user, cut it.
5. **Built for the field.** Large targets, high contrast, offline tolerant, one-handed.
6. **Boring technology.** One database, one deployable API, no queues or caches until a measured need exists.

### 1.6 Assumptions and risks

| # | Assumption or risk | Mitigation or kill signal |
|---|---|---|
| A1 | Buyers will maintain an employee directory (CSV or one by one) | If pilots refuse, add join codes or SSO |
| A2 | Intervenants are mostly external contractors serving several clients | If mostly internal, the multi-organization work is over-built; keep it but do not extend it |
| A3 | Self-serve registration is acceptable without manual approval | Email verification, rate limits and the suspend tool mitigate fake organizations |
| A4 | Employees and intervenants will install a native app | Kill signal: invitation-to-first-sign-in under 60 percent. Fallback: a minimal web report page and web assignment view on the same API |
| A5 | Deep links from invitation emails open the app or a store page reliably | Verify Expo universal links and deferred deep links in R3. Fallback: invitation code typed in the app |
| A6 | Better Auth supports our needs (uuid ids, Prisma 6, Expo, TOTP, closed sign-up) | Verification gate in R1. Fallback: small in-house module, same API surface |
| A7 | Pricing model unknown | Trial fields reserved, billing deferred, trial end is informational only in v1 |

---

## 2. Users and surfaces

### 2.1 Personas

| Persona | Context | Primary job | Surface |
|---|---|---|---|
| Supervisor (the owner is a supervisor with an ownership flag) | Office, tens of incidents a day | Keep nothing unowned or stale, know the workload, close the loop | Web console `/app` |
| Employee (reporter) | Anywhere on site, 30 seconds to spare | Report fast, see what happened | Expo app |
| Intervenant | On the move, gloves, bad network, possibly several client organizations | Know what is mine today, accept, update, resolve with proof | Expo app |
| Platform admin (Sentinel staff) | Internal, cross-organization | Keep organizations healthy, handle abuse, watch registrations | Web console `/platform` |

### 2.2 Which surface for which membership

- The web console serves **supervisor** memberships and platform admins. A person with only employee or intervenant memberships who signs in on the web sees a "Use the Sentinel app" page with store links.
- The app serves **employee** and **intervenant** memberships. It never shows supervisor screens.
- Someone who supervises organization A and works as an intervenant for organization B uses the web console for A and the app for B, with one login.

### 2.3 Vocabulary (used in the UI, API docs and code)

| Term | Meaning | Code enum |
|---|---|---|
| Organization | A tenant (client company) | `Organization` |
| Supervisor | Manages incidents, people, setup. One or more per organization | `SUPERVISOR` |
| Owner | A supervisor with `isOwner`. At least one active owner per organization | flag |
| Employee | Reports incidents. Belongs to one organization on the platform | `REPORTER` |
| Intervenant | Resolves incidents. One global account, one membership per organization served | `INTERVENANT` |
| Membership | A person's role in one organization | `Membership` |
| Site | A physical location with a perimeter | `Site` |
| Incident | A reported problem, with reference such as INC-2026-00042 | `Incident` |
| Assignment | One intervenant's responsibility for one incident, with history | `Assignment` |
| Case file | The incident detail view: header, state, Thread, evidence | UI term |
| Thread | The chronological record of everything that happened on an incident | UI term |

The UI never says "user". Never "responsable" or "administrator" anywhere.

---

## 3. User journeys

Each journey lists the real sequence. Unhappy paths follow the happy path. Screens are named as in section 8.

### J1. Organization onboarding (supervisor, web)

1. Opens `/register`. Step 1 Company (legal name, display name, registration number, industry, size, country, address, timezone, website). Step 2 Primary contact (first and last name, email, phone, password). Step 3 Review and accept terms.
2. Submits. Sees "Check your email" with resend and a fix-my-email option. Nothing is created in tenant tables yet; the form data waits in `OrganizationRegistration`.
3. Opens the verification link within 24 hours. The organization becomes ACTIVE on a 30 day TRIAL, the owner membership is created, default categories for the chosen industry are seeded, the person is signed in.
4. Lands on the dashboard with the **setup checklist**: add a site, review categories, invite your team. Each item states what it does and links to it.
5. Adds the first site by searching an address, placing the pin and drawing the perimeter.

Unhappy paths: link expired (offer resend), link already used (go to sign in), email already registered (point to sign in or reset), registration number already known in this country (soft warning, can continue).

### J2. People onboarding

**Employee.**
1. Supervisor opens Team, Add employee (or Import CSV). Enters email, name, employee code, job title, department, home site, phone.
2. System sends an invitation email. The membership is INVITED and unusable.
3. Employee opens the link on a phone. It opens the app on the acceptance screen, or a web landing page with store links that keeps the token.
4. Acceptance screen shows organization name and role. New person sets a password. Membership becomes ACTIVE, supervisor gets a notification.

**Intervenant, new to the platform.** Supervisor invites by email with specialties and site access. Same acceptance path, plus company name and phone.

**Intervenant, already on the platform.** The invitation becomes a join request. They accept in the app or from the email link after signing in. One more membership appears and the organization switcher shows it.

Unhappy paths: email already has an active employee membership elsewhere (rejected with a clear message at invite time and re-checked at accept), invitation expired (7 days, supervisor can resend, which invalidates the old link), revoked before accept (link shows "no longer valid").

### J3. Incident loop (core)

1. **Report.** Employee opens the app, taps Report, step 1 What happened (title, description, optional photo), step 2 Where (site, GPS suggestion, manual pin fallback), step 3 Confirm. Sees reference INC-2026-00042 and "A supervisor will review it".
2. **Triage and assign.** The incident appears at the top of the supervisor inbox, live. Supervisor opens it in the case file, confirms category and priority (prefilled from the report), picks an intervenant from the ranked candidate list, assigns. Incident becomes ASSIGNED.
3. **Accept.** Intervenant gets a push and an in-app notification. Opens My work, reads the case file, taps Accept. Incident becomes IN_PROGRESS.
4. **Work.** Intervenant posts structured updates (started, on site, blocked, update), optionally with a photo.
5. **Resolve.** Intervenant resolves with a note and optional evidence photo. Incident becomes RESOLVED and moves to "Awaiting review" for the supervisor.
6. **Verify.** Supervisor reads the resolution and evidence, then closes (CLOSED) or sends back with a reason (back to IN_PROGRESS, assignee notified).
7. The employee sees the Thread update at each milestone and receives a notification on assignment, start of work, resolution and closure.

### J4. Decline and reassignment

- **Decline.** The intervenant declines a pending assignment with a reason of 5 to 500 characters. The incident returns to NEW and shows a "Declined" marker in the inbox with the reason. Supervisor reassigns.
- **Request reassignment.** After accepting, the intervenant requests reassignment with a reason (cannot access, wrong specialty, unavailable). They stay responsible and can keep posting updates until the supervisor decides. The request lands in the **Reassignment queue**. The supervisor either reassigns (old assignment superseded, new one pending) or rejects the request with a note (assignment returns to ACCEPTED and the intervenant is told).
- **Supervisor-initiated change.** Supervisor reassigns at any time while the incident is ASSIGNED or IN_PROGRESS, or unassigns it back to NEW. The previous assignment is superseded, never deleted.

### J5. Multi-organization intervenant day

1. Opens the app. **My work** lists their assignments across all organizations, grouped Needs response, In progress, Awaiting review, each card tagged with the organization name.
2. Taps an assignment. The app switches the active organization automatically for that case file.
3. Uses the organization switcher in the header to browse one organization's history, profile and certifications.
4. Revoked from one organization: its assignments and data vanish from their lists on the next request, the others are untouched.

### J6. Offline report and update

1. Employee loses signal in a basement and reports an incident. The report is saved on the device as a queued action with an idempotency key. The header shows "1 waiting to send".
2. Signal returns. The queue sends the action. The reference appears and the item flips from Waiting to Sent. A failure shows Failed with Retry and the reason.
3. Same mechanism for intervenant progress updates, resolutions and comments. Photos are resized on device (long edge 1920 px, under 5 MB) before queuing.

### J7. Supervisor daily triage

1. Opens the console on the **Triage desk** (the inbox). Default saved view "Needs attention": NEW, declined and reassignment-requested incidents first, then awaiting review.
2. Works the list with the keyboard (arrows move, Enter opens the case file in the docked pane, A assigns, C closes).
3. Uses the command palette (Ctrl or Cmd + K) to jump to an incident by reference, a person, or a page.
4. Checks the dashboard for ageing incidents, workload per intervenant and the awaiting-review count.

### J8. Platform operations

1. Platform admin signs in at `/platform`, completes TOTP.
2. Reviews the registration pipeline (pending, expired), resends verification, or sees abuse.
3. Opens an organization: profile, owner contact, counts (members, sites, incidents per month), status history. No incident content anywhere.
4. Suspends an organization with a mandatory reason. The owner is emailed. The next request from any member of that organization is rejected with `ORG_SUSPENDED`. Reactivation reverses it. Both are written to the platform audit log.

---

## 4. Feature catalog

IDs are stable and referenced by tests and tickets. R-numbers are delivery milestones (section 10).

### 4.1 Accounts and access (ACC)

| ID | Feature | P | R |
|---|---|---|---|
| F-ACC-01 | Email and password sign-in, web (httpOnly cookie) and mobile (bearer in secure storage) | M | R1 |
| F-ACC-02 | Email verification and password reset, single-use links | M | R3 |
| F-ACC-03 | No public sign-up route anywhere. Accounts exist only through organization registration or invitation acceptance | M | R1 |
| F-ACC-04 | Sign-in rate limits and temporary lockout after repeated failures | M | R1 |
| F-ACC-05 | Active sessions list with revoke, in profile. All sessions revoked on password change and on membership revoke for that organization context | S | R4 |
| F-ACC-06 | TOTP two-factor: mandatory for platform admins, optional for supervisors | M | R5 |
| F-ACC-07 | Language preference (FR or EN) per person, organization default | M | R4 |

### 4.2 Organization setup (ORG)

| ID | Feature | P | R |
|---|---|---|---|
| F-ORG-01 | B2B registration with email verification and versioned terms acceptance | M | R3 |
| F-ORG-02 | Setup checklist and first-run guidance | M | R3 |
| F-ORG-03 | Organization settings: profile, timezone, default locale, billing contact, require photo on resolve (default off), show reporter phone to intervenants (default off) | M | R3 |
| F-ORG-04 | Sites: create, edit, activate or deactivate, address search, map pin, perimeter (circle or polygon) | M | R3 |
| F-ORG-05 | Incident categories: name, default priority, linked specialty, active flag. Seeded from an industry template | M | R3 |
| F-ORG-06 | Specialties list | M | R3 |
| F-ORG-07 | Transfer ownership, delegate supervisor role | S | R4 |

### 4.3 People (PPL)

| ID | Feature | P | R |
|---|---|---|---|
| F-PPL-01 | Add employee (single) with invitation email | M | R3 |
| F-PPL-02 | CSV import: template, dry-run, row-level error file, commit valid rows, idempotent by employee code, max 2,000 rows | M | R3 |
| F-PPL-03 | Invite intervenant with specialties and site access. Existing account gets a join request | M | R3 |
| F-PPL-04 | Invitations: list, resend (invalidates old link), revoke | M | R3 |
| F-PPL-05 | Team directory with filters and status. Edit, suspend, reactivate, revoke. Last active owner cannot be suspended, revoked or demoted | M | R3 |
| F-PPL-06 | Revoke or suspend takes effect on the next request (membership checked every request) | M | R1 |
| F-PPL-07 | Intervenant self-service: phone, company, certifications with expiry, availability (available, busy, off) | M | R6 |
| F-PPL-08 | Certification expiry notice 30 days ahead | S | R6 |

### 4.4 Incidents (INC)

| ID | Feature | P | R |
|---|---|---|---|
| F-INC-01 | Create: title, description, category, site, location, optional photo, confirmation step. Reporter priority is a suggestion | M | R2 |
| F-INC-02 | Server-generated reference per organization and year (`INC-2026-00042`) | M | R2 |
| F-INC-03 | Triage: supervisor confirms or changes category and priority, adds context. Original fields never change | M | R2 |
| F-INC-04 | Inbox list: role-scoped, search (reference, title, description), filters (status, priority, category, site, assignee, date), sort, cursor pagination | M | R2 |
| F-INC-05 | Saved views (supervisor) and URL-encoded filters | M | R4 |
| F-INC-06 | Bulk select with bulk priority change and bulk assign | S | R4 |
| F-INC-07 | Dismiss from NEW with a reason (duplicate, not an incident, no action needed) | S | R4 |
| F-INC-08 | Supervisor creates an incident on behalf of an employee | S | R4 |
| F-INC-09 | Reopen closed incident, merge duplicates | C | later |

### 4.5 Assignment workflow (WF)

| ID | Feature | P | R |
|---|---|---|---|
| F-WF-01 | Assign with ranked candidates and fit indicators. Ineligible members are shown disabled with the reason | M | R2 |
| F-WF-02 | Accept, or decline with a reason | M | R2 |
| F-WF-03 | Request reassignment with a reason. Supervisor queue with reassign or reject-with-note | M | R4 |
| F-WF-04 | Structured progress updates (started, on site, blocked, update) with optional photo | M | R2 |
| F-WF-05 | Resolve with a note (required) and evidence photo (optional, required if the organization says so) | M | R2 |
| F-WF-06 | Close, or send back with a reason | M | R2 |
| F-WF-07 | Reassign or unassign by supervisor while open | M | R2 |
| F-WF-08 | Optimistic concurrency on every mutation (`CONFLICT_CONCURRENT_UPDATE`) and idempotency keys | M | R2 |

### 4.6 Collaboration (COL)

| ID | Feature | P | R |
|---|---|---|---|
| F-COL-01 | Comments with visibility: public (employee sees) or internal (hidden from the employee at API level) | M | R2 |
| F-COL-02 | Attachments: JPEG, PNG, WebP up to 5 MB, magic-byte checked, short-lived signed URLs after a scope check | M | R2 |
| F-COL-03 | Timeline (Thread) combining state changes, assignments, progress, comments, attachments, filtered by what the viewer may see | M | R2 |

### 4.7 Notifications (NTF)

| ID | Feature | P | R |
|---|---|---|---|
| F-NTF-01 | In-app notification centre, unread count, mark read and read all, deep link to the case file | M | R2 |
| F-NTF-02 | No duplicates (unique on recipient, event, incident, incident version) | M | R2 |
| F-NTF-03 | Push notifications mirroring in-app events, per-person opt-out, payload limited to reference and event type | S | R6 |
| F-NTF-04 | Transactional email: verification, reset, invitation, suspension notice | M | R3 |
| F-NTF-05 | Live updates in the console (server-sent events) with polling fallback | S | R4 |

### 4.8 Reporting and audit (RPT)

| ID | Feature | P | R |
|---|---|---|---|
| F-RPT-01 | Dashboard: open by status and priority, unassigned, awaiting review, ageing, time to acknowledgement, time to resolution, by site, by category, intervenant workload, 30 day trend | M | R4 |
| F-RPT-02 | Map of open incidents (real coordinates only), role-scoped | M | R4 |
| F-RPT-03 | Audit log viewer with filters (incident, actor, event type, date) and CSV export | S | R4 |

### 4.9 Platform (PLT)

| ID | Feature | P | R |
|---|---|---|---|
| F-PLT-01 | Organizations list and detail: status, plan, counts, last activity, owner contact. Counts only, no incident content | M | R5 |
| F-PLT-02 | Suspend and reactivate with a mandatory reason, owner emailed, effective on the next request | M | R5 |
| F-PLT-03 | Registration pipeline: pending and expired, resend verification, expired purged after 7 days | M | R5 |
| F-PLT-04 | Edit plan and trial end date | S | R5 |
| F-PLT-05 | Platform audit log. Platform admins are created by CLI, never through the UI | M | R5 |
| F-PLT-06 | Time-boxed support access granted by the owner | C | later |

### 4.10 Mobile (MOB)

| ID | Feature | P | R |
|---|---|---|---|
| F-MOB-01 | Role-based tab sets, sign-in, invitation deep link | M | R2, R3 |
| F-MOB-02 | Employee: report in 3 steps, my incidents, comments, notifications, profile | M | R2 |
| F-MOB-03 | Intervenant: My work grouped by action, accept, decline, update, resolve | M | R2 |
| F-MOB-04 | Organization switcher and cross-organization My work | M | R6 |
| F-MOB-05 | Offline queue with Waiting, Sent, Failed states and retry | M | R6 |
| F-MOB-06 | `app-config` check at launch with blocking update screen below the minimum version | M | R6 |
| F-MOB-07 | Location permission asked only at the Where step or the On site update, manual pin if denied | M | R2 |
| F-MOB-08 | Navigate to site (opens the maps app), biometric unlock | S | R6 |

### 4.11 Web productivity (WEB)

| ID | Feature | P | R |
|---|---|---|---|
| F-WEB-01 | Docked case file beside the inbox (no navigation), URL reflects the selected incident | M | R2 |
| F-WEB-02 | Command palette (Ctrl or Cmd + K): jump to incident, person, page, action | S | R4 |
| F-WEB-03 | Keyboard shortcuts for inbox triage with a help overlay | S | R4 |
| F-WEB-04 | Density toggle (compact, default, comfortable), column visibility | S | R4 |
| F-WEB-05 | Dark theme | S | R7 |

---

## 5. Permissions

### 5.1 Actors

- **Employee, Intervenant, Supervisor, Owner**: roles inside one organization, resolved from the membership.
- **Platform admin**: a separate actor, not a member of any organization. Own guard, own API namespace, TOTP required. A route accepts either a tenant context or a platform context, never both (I12).

### 5.2 Action matrix (tenant)

| Action | Employee | Intervenant | Supervisor | Owner |
|---|---|---|---|---|
| Edit organization profile and settings | no | no | no | yes |
| Transfer ownership | no | no | no | yes |
| Manage sites, categories, specialties | no | no | yes | yes |
| Add, edit, suspend, revoke employees | no | no | yes | yes |
| Invite, edit, suspend, revoke intervenants | no | no | yes | yes |
| Invite or demote other supervisors | no | no | no | yes |
| Create incident | yes (as self) | no | yes (on behalf of an employee) | yes |
| Read incident | own only | only those they hold or held an assignment on | all in the organization | all |
| Triage, assign, reassign, unassign | no | no | yes | yes |
| Accept, decline, request reassignment | no | own pending or accepted assignment | no | no |
| Post progress, resolve | no | own live assignment | no | no |
| Close, send back, dismiss | no | no | yes | yes |
| Comment public | own incident | assigned | yes | yes |
| Comment internal, read internal | no | assigned (while the assignment is live) | yes | yes |
| Add attachments | at creation of own incident | on own live assignment | yes | yes |
| Read audit log, export | no | no | yes | yes |
| View dashboard and map | no | own assigned incidents on the map only | yes | yes |
| Read member directory | no | no | yes | yes |
| Edit own profile, certifications, availability | profile only | yes | profile only | profile only |

### 5.3 Data visibility rules

- **Reporter identity to intervenants:** display name and site only. Phone is shown only if the organization enabled it.
- **Past assignees** keep read-only access to incidents they worked, limited to events up to the end of their assignment. They lose internal comments from that moment.
- **Employees** see the incident header, public comments, and milestone events of the Thread (assigned, work started, resolved, closed). They do not see progress notes, internal comments, assignment reasons, or who declined.
- **Certifications** belong to the person globally but are visible to an organization only while the person holds a membership there.
- **Revoked members:** all historical rows remain and authorship stays attributable (I11). Their access ends on the next request.
- **Closed incidents** are read-only for everyone (I8).

### 5.4 Platform admin boundary

Can see: organization profile, owner contact, status history, plan, counts, registration pipeline, platform audit log. Cannot see: incidents, comments, attachments, member personal data beyond the owner contact. Every platform action writes a `PlatformAuditEvent`.

### 5.5 Where permissions are enforced (defense in depth)

1. **Guard layer.** Every request resolves `ctx` (user, membership, organization) and checks that user, membership and organization are all ACTIVE, on every request (I13). Tenant routes use `requireTenant`, platform routes use `requirePlatformAdmin`.
2. **Policy layer.** Each module has a policy that maps `ctx.role` to an allowed scope and a Prisma `where` fragment (for example intervenants: `assignments.some(...)`). Services never build scope ad hoc.
3. **Query layer.** A Prisma client extension rejects any query on a tenant model that lacks `organizationId` in its `where`. A test iterates every tenant model to prove it.
4. **Schema layer.** Composite foreign keys keep child rows in the parent's organization (I1).
5. **Optional hardening (R7):** Postgres row-level security keyed on a per-transaction setting.

Frontend checks hide controls for usability only and never count as authorization. Cross-tenant access returns **404**, not 403, so existence is not leaked.

---

## 6. Business logic

### 6.1 Core entities (summary)

All keys are uuid. Every tenant table carries `organizationId`. Details live in `apps/api/prisma/schema.prisma` once written in R1.

| Group | Entities |
|---|---|
| Identity | User (global person), Session, Account, Verification, TwoFactor (identity library tables) |
| Tenancy | Organization, Membership (one role each), EmployeeProfile, IntervenantProfile, IntervenantIdentity, Certification, Specialty, IntervenantSpecialty, SiteAccess, Invitation, ImportJob, OrganizationRegistration |
| Operations | Site, IncidentCategory, Incident, Assignment, ProgressUpdate, Comment, Attachment, SavedView, OrganizationCounter |
| Cross-cutting | AuditEvent, Notification, DeviceToken, IdempotencyKey, OutboxEvent |
| Platform | PlatformAdmin, PlatformAuditEvent |

### 6.2 State machines

**Principle (I14): while an incident is open, its status mirrors its live assignment.** No live assignment means NEW. A pending assignment means ASSIGNED. An accepted assignment (including a pending reassignment request) means IN_PROGRESS. This removes ambiguous in-between states.

**Incident**

| From | To | Trigger | Actor | Notes |
|---|---|---|---|---|
| NEW | ASSIGNED | assign | supervisor | Requires triage fields (priority set). Triage and assign can be one dialog |
| ASSIGNED | IN_PROGRESS | accept | intervenant | Sets `startedAt` if empty |
| ASSIGNED | NEW | decline, unassign, assignee revoked | intervenant, supervisor, system | Assignment ends DECLINED or SUPERSEDED |
| ASSIGNED | ASSIGNED | reassign | supervisor | Old assignment SUPERSEDED, new PENDING_ACCEPTANCE |
| IN_PROGRESS | ASSIGNED | reassign | supervisor | Same, `startedAt` is kept |
| IN_PROGRESS | NEW | unassign, assignee revoked | supervisor, system | |
| IN_PROGRESS | RESOLVED | resolve | intervenant | Note required. Sets `resolvedAt` |
| RESOLVED | CLOSED | close | supervisor | Sets `closedAt`. Assignment becomes COMPLETED |
| RESOLVED | IN_PROGRESS | send back | supervisor | Reason required. Same assignment stays ACCEPTED |
| NEW | CLOSED | dismiss | supervisor | Reason code required. Not a normal path, audited |

Everything else returns `409 INVALID_STATE_TRANSITION`. CLOSED is terminal.

**Assignment**

| From | To | Trigger |
|---|---|---|
| PENDING_ACCEPTANCE | ACCEPTED | intervenant accepts |
| PENDING_ACCEPTANCE | DECLINED | intervenant declines (reason 5 to 500 chars) |
| PENDING_ACCEPTANCE, ACCEPTED, REASSIGNMENT_REQUESTED | SUPERSEDED | supervisor reassigns or unassigns, or assignee revoked |
| ACCEPTED | REASSIGNMENT_REQUESTED | intervenant requests (reason required) |
| REASSIGNMENT_REQUESTED | ACCEPTED | supervisor rejects the request with a note |
| ACCEPTED | COMPLETED | incident is closed |

Live statuses are PENDING_ACCEPTANCE, ACCEPTED and REASSIGNMENT_REQUESTED. At most one live assignment per incident (I4).

**Membership:** INVITED to ACTIVE or REVOKED. ACTIVE to SUSPENDED or REVOKED. SUSPENDED to ACTIVE or REVOKED.
**Organization:** ACTIVE to SUSPENDED or CLOSED. SUSPENDED to ACTIVE or CLOSED. (Pending registrations live in `OrganizationRegistration` until verified.)
**Invitation:** pending to accepted, expired (7 days) or revoked. Resend revokes the old token and issues a new one.
**Registration:** pending to verified or expired (24 hours). Expired rows are purged after 7 days.

### 6.3 Rules

**Reporting.** Reporter priority (`reportedPriority`) is a suggestion. The reference is generated from `OrganizationCounter` (`incident:<year>`) in the same transaction as the insert. All timestamps are set by the server (I9). Original fields (title, description, original category, location, reporter, `createdAt`) never change after submission (I5). Triage writes `priority` and `categoryId` through audited events.

**Triage.** The supervisor confirms or overrides category and priority and may add an internal comment. `triagedAt` is set once. Assignment requires a priority.

**Eligibility and ranking (assign dialog).** Candidates are ACTIVE intervenant memberships of this organization.
- *Not selectable:* membership not ACTIVE, or no ACTIVE `SiteAccess` for the incident's site (I10). Shown disabled with the reason.
- *Selectable with a warning:* availability OFF (the supervisor knows better than the toggle).
- *Ranking, in order:* (1) specialty matches the category's specialty, (2) availability AVAILABLE before BUSY before OFF, (3) fewer live assignments, (4) oldest last assignment (spreads work). The list shows these as chips so the ranking is explainable. Automatic assignment is out of scope.

**Resolution.** Resolve needs a note (10 to 4,000 characters). A photo is optional unless the organization setting requires it. After RESOLVED the assignee cannot post progress. A supervisor may send back with a reason (10 to 500 characters).

**Closure.** Close needs no text. It marks the assignment COMPLETED, stamps `closedAt`, makes the incident read-only, and notifies the reporter and assignee.

**Dismiss.** From NEW only, with a reason code: DUPLICATE, NOT_AN_INCIDENT, NO_ACTION_NEEDED, plus an optional note.

**Comments.** PUBLIC or INTERNAL, chosen explicitly (default PUBLIC for employees and intervenants, INTERNAL for supervisors in the internal tab). Cannot be edited after posting in v1. Locked when the incident is CLOSED.

**Attachments.** JPEG, PNG, WebP, max 5 MB. Upload is a presigned PUT, then a confirm call that re-reads the object header (magic bytes) and records the row. Download is a 5 minute signed GET issued only after the same scope check as the incident. Orphaned objects are deleted by a daily sweep.

**Members.**
- One REPORTER membership in INVITED or ACTIVE status per person on the platform (I2). Intervenant memberships are unlimited.
- The last active owner cannot be suspended, revoked or demoted (I6).
- Revoking or suspending an intervenant with live assignments requires a choice: reassign them first, or return them to the inbox (incident goes to NEW, assignments SUPERSEDED with reason "member revoked").
- Deactivating a site with open incidents is allowed. The incidents stay, new reports for that site are blocked.

**Organization suspension.** Every tenant request is rejected with `403 ORG_SUSPENDED` from the next request on. Clients show a blocking screen with the owner contact. Data is untouched.

### 6.4 Edge cases to cover in tests

| Case | Expected |
|---|---|
| Two supervisors assign the same NEW incident at once | One succeeds, the other gets `CONFLICT_CONCURRENT_UPDATE` with the current state |
| Intervenant accepts after the supervisor reassigned | `INVALID_STATE_TRANSITION`, UI explains it was reassigned |
| Offline queue replays a create twice | Second call returns the first response (idempotency key), one incident |
| Employee suspended while offline with queued reports | Queue fails with `MEMBERSHIP_INACTIVE`, UI shows Failed with the reason |
| Reporter's site is deactivated before submit | `422` with a message to choose another site |
| Supervisor tries to demote the last owner | `409` with an explanation |
| Platform admin token on a tenant route, tenant token on a platform route | `403`, always |
| Org B user requests an Org A incident id | `404`, identical body to a missing id |
| Intervenant revoked from org A while holding a live assignment in org B | Org B assignment untouched |
| Two intervenant memberships, `X-Org-Id` of an organization they do not belong to | `404` |
| Image with a `.jpg` extension but a different magic number | `415 UPLOAD_REJECTED` |

### 6.5 Notification matrix

Notifications are created in the same transaction as the event (through the outbox, see 7.9). Push and email are sent from the outbox after commit.

| Event | Recipients | In-app | Push |
|---|---|---|---|
| Incident created | all active supervisors | yes | opt-in |
| Assigned | the assignee | yes | yes |
| Assigned (milestone) | the reporter | yes | yes |
| Accepted | supervisors, reporter ("work started") | yes | yes for reporter |
| Declined | supervisors | yes | yes |
| Reassignment requested | supervisors | yes | yes |
| Reassignment rejected, reassigned away | the intervenant | yes | yes |
| Progress posted | supervisors | yes | no |
| Resolved | supervisors, reporter | yes | yes for supervisors |
| Sent back | the assignee | yes | yes |
| Closed | reporter, assignee | yes | no |
| Comment added (public) | the other parties on the incident | yes | no |
| Invitation accepted | the inviter | yes | no |
| Certification expiring in 30 days | the intervenant, supervisors of their organizations | yes | no |

### 6.6 Audit

Append-only (I7, enforced by trigger and privileges). One row for every state change and sensitive action, with actor membership and user, event type, incident, and a JSON payload (before and after for field changes). Vocabulary: INCIDENT_CREATED, TRIAGED, ASSIGNED, ASSIGNMENT_ACCEPTED, ASSIGNMENT_DECLINED, REASSIGNMENT_REQUESTED, REASSIGNMENT_RESOLVED, PROGRESS_POSTED, RESOLVED, SENT_BACK, CLOSED, DISMISSED, COMMENT_ADDED, ATTACHMENT_ADDED, MEMBER_INVITED, MEMBER_JOINED, MEMBER_SUSPENDED, MEMBER_REACTIVATED, MEMBER_REVOKED, SITE_CREATED, SITE_UPDATED, CATEGORY_CHANGED, ORG_UPDATED. Platform events: ORG_SUSPENDED, ORG_REACTIVATED, PLAN_CHANGED, REGISTRATION_RESENT.

### 6.7 Metric definitions

| Metric | Definition |
|---|---|
| Time to assign | `firstAssignedAt - createdAt` |
| Time to acknowledgement | `startedAt - createdAt` (first acceptance) |
| Time to resolution | `resolvedAt - createdAt` (first resolution) |
| Time to close | `closedAt - createdAt` |
| Ageing | now minus `createdAt` for open incidents, bucketed: under 4 h, 4 to 24 h, 1 to 3 days, over 3 days |
| Workload | live assignments per intervenant, with age of the oldest |
| Headline figures | medians, with the mean as secondary. Computed in the organization timezone for "per day" groupings |

### 6.8 Concurrency and idempotency

- Every mutating request on an incident or assignment carries `expectedVersion`. A mismatch returns `409 CONFLICT_CONCURRENT_UPDATE` with the current resource, and the UI shows who changed it.
- Creates and state transitions accept an `Idempotency-Key` header (required from the mobile client). The server stores the response for 24 hours per (membership, route, key). Same key with a different body returns `422 IDEMPOTENCY_KEY_REUSED`.

### 6.9 Invariants (enforced in the database wherever possible)

| ID | Rule |
|---|---|
| I1 | A child row and its parent share the same `organizationId` (composite FK) |
| I2 | A person has at most one INVITED or ACTIVE REPORTER membership on the platform (partial unique index, raw SQL) |
| I3 | One membership per (organization, person). One role per membership |
| I4 | At most one live assignment per incident (partial unique index, raw SQL) |
| I5 | Original incident fields are immutable after submission |
| I6 | The last active owner cannot be suspended, revoked or demoted |
| I7 | Audit rows cannot be updated or deleted (trigger plus privileges) |
| I8 | A CLOSED incident is read-only |
| I9 | The server sets all timestamps |
| I10 | An intervenant can only be assigned with an ACTIVE membership and ACTIVE access to the incident's site |
| I11 | Revoking keeps all historical rows. Authorship stays attributable |
| I12 | Platform guards and tenant guards are mutually exclusive. Every platform action writes a platform audit event |
| I13 | A suspended organization, suspended or revoked membership, or suspended user is rejected on the next request |
| I14 | While an incident is open, its status mirrors its live assignment |

---

## 7. Architecture

### 7.1 System context

```
 Employees, Intervenants                  Supervisors, Platform admins
        (Expo app)                               (React web console)
            |  HTTPS, bearer token                     |  HTTPS, session cookie
            +-------------------+----------------------+
                                |
                        nginx (TLS, /api proxy, static web)
                                |
                     Sentinel API (Node 22, Express 5)
                     modular monolith, one process
                     |        |            |             |
                 PostgreSQL  S3-compatible  SMTP         Expo push
                 16 (data,   object store   (Mailpit     service
                 outbox,     (photos)       in dev)
                 sessions)
```

No Redis, no queue broker, no microservices. The outbox lives in Postgres.

### 7.2 Stack and rationale

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript strict everywhere | One contract across API, web, mobile |
| API | Express 5, zod, pino | Known, boring, already in the repo |
| ORM and DB | Prisma 6, PostgreSQL 16 | Relational integrity is the product (composite FKs, partial indexes, triggers) |
| Identity | Better Auth, self-hosted, Prisma adapter | Email and password, verification, reset, TOTP, bearer, Expo client. Subject to the R1 verification gate. Fallback: in-house argon2id and opaque session tokens behind the same interface |
| Web | Vite, React 19, TanStack Router (typed search params for filters), TanStack Query, TanStack Table, React Hook Form, Radix primitives, Tailwind v4 with `@theme` tokens | Typed URL state is what saved views and shareable filters need. React 19 matches mobile and removes the React 18 type hack |
| Mobile | Expo SDK 57, React Navigation 7, TanStack Query, expo-secure-store, expo-sqlite, expo-image-picker and image-manipulator, expo-location, expo-notifications | Same data layer as web |
| Shared | `packages/shared`: zod DTOs, enums, state machines, typed API client, design tokens, i18n strings | The state machine and DTOs are written once |
| Storage | S3 API. Dev adapter chosen and verified in R2 (MinIO community images are gone; evaluate Garage or SeaweedFS, fallback local disk adapter) | Presigned URLs work with any S3 |
| Email | Nodemailer over SMTP, Mailpit in dev | No vendor lock-in |
| Maps | MapLibre GL (web) with a vector tile provider whose licence allows commercial use. Do not use the public OpenStreetMap tile servers in production. Mobile: react-native-maps (needs a dev client, not Expo Go) | Decision confirmed in R2 |
| Tests | Vitest, Supertest on a real Postgres, Testing Library, Playwright with axe-core | Always `--no-file-parallelism` for DB suites |

### 7.3 Repository layout

```
apps/api         Express API, Prisma schema, migrations, seed
apps/web         React console
apps/mobile      Expo app
packages/shared  contracts, state machines, client, tokens, i18n
docs/            PRD, design system, runbooks
```

Inside `apps/api/src`: `auth/`, `http/` (error contract, request id, idempotency, pagination, guards), `modules/<name>/{routes,service,policy}.ts`, `jobs/` (outbox worker), `lib/` (storage, files, mail, push). Routes parse and call. Services hold rules and transactions. No `any`.

### 7.4 API conventions

- Base `/v1`. Resource names plural kebab-case. JSON bodies, envelope `{ "data": ... }`.
- **Tenant context:** the active organization is named only by the `X-Org-Id` header and is accepted only if the caller holds an ACTIVE membership there, otherwise `404`. If the caller has exactly one membership for the surface, the header may be omitted. Bodies and URLs never carry a tenant id for scoping.
- **Pagination:** cursor based. `?limit=` (default 25, max 100) and `?cursor=`. Response `{ "data": [], "page": { "nextCursor": "...", "hasMore": true } }`.
- **Errors:** `{ "error": { "code", "message", "details", "requestId" } }`. Codes: `VALIDATION_FAILED` 422, `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `MFA_REQUIRED` 403, `MEMBERSHIP_INACTIVE` 403, `ORG_SUSPENDED` 403, `NOT_FOUND` 404, `CONFLICT_CONCURRENT_UPDATE` 409, `INVALID_STATE_TRANSITION` 409, `IDEMPOTENCY_KEY_REUSED` 422, `UPLOAD_REJECTED` 413 or 415, `RATE_LIMITED` 429.
- **Headers:** `X-Request-Id` returned on every response. `Idempotency-Key` on creates and transitions.

| Group | Endpoints |
|---|---|
| Auth | `/v1/auth/*` handled by the identity library |
| Public | `POST /public/organizations`, `POST /public/organizations/verify`, `GET /public/invitations/:token`, `POST /public/invitations/:token/accept`, `GET /app-config` |
| Me | `GET /me`, `PATCH /me/profile`, `GET /me/assignments` (cross-organization), certifications CRUD, `POST /me/devices`, `DELETE /me/devices/:id`, sessions list and revoke |
| Organization | `GET/PATCH /organization`, `/sites`, `/categories`, `/specialties` CRUD |
| People | `GET/POST /members`, `PATCH /members/:id`, `POST /members/:id/suspend`, `/reactivate`, `/revoke`, `POST /members/import` (`?dryRun=true`), `/invitations` list, `POST /invitations/:id/resend`, `/revoke` |
| Incidents | `GET/POST /incidents`, `GET /incidents/:id`, `POST /incidents/:id/triage`, `/assign`, `/unassign`, `/close`, `/send-back`, `/dismiss`, `GET/POST /incidents/:id/comments`, `POST /incidents/:id/attachments/presign`, `POST /incidents/:id/attachments`, `GET /attachments/:id/url`, `GET /incidents/:id/timeline` |
| Assignments | `POST /assignments/:id/accept`, `/decline`, `/request-reassignment`, `/progress`, `/resolve`, `GET /reassignments`, `POST /reassignments/:id/resolve` |
| Reporting | `GET /dashboard`, `GET /map`, `GET /audit` (and `.csv`), `GET/POST /saved-views` |
| Notifications | `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all`, `GET /events` (server-sent events) |
| Platform | `GET /platform/organizations`, `GET /platform/organizations/:id`, `POST .../suspend`, `.../reactivate`, `PATCH .../plan`, `GET /platform/registrations`, `POST /platform/registrations/:id/resend`, `GET /platform/audit` |

### 7.5 Identity and sessions

- Better Auth with Prisma adapter and uuid ids so `User.id` stays `@db.Uuid`. Better Auth's own organization plugin is **not** used: our `Organization` and `Membership` tables are the source of truth for tenancy.
- Public sign-up is disabled at the server. Users are created only by our registration and invitation-accept services, which call the auth API internally.
- **Web:** httpOnly, Secure, SameSite=Lax cookie, same origin through nginx `/api`, trusted-origin check for CSRF. **Mobile:** session token in `expo-secure-store`, sent as bearer.
- Rate limits on sign-in, reset and verify. Lockout after repeated failures. Sessions revoked on password change and when a membership is revoked.
- Platform admins: TOTP mandatory, enforced by the platform guard, not just at sign-in.
- **Verification gate (first task of R1):** confirm current version, Prisma 6 adapter, uuid generation, closed sign-up, TOTP and bearer plugins, and the Expo client on SDK 57. Any blocker triggers the in-house fallback.

### 7.6 Tenancy design

`ctx` is built once per request: session, then User, then Membership (from `X-Org-Id`), then Organization, with all three statuses checked. Tenant services take `ctx` as their first argument, so `ctx.orgId` is always defined on tenant routes. See 5.5 for the layers.

### 7.7 Data model changes versus the legacy schema

- Drop `Organization.clerkOrgId` and `User.clerkUserId`. Add the identity tables, `User.emailVerified`.
- Add missing foreign keys: `PlatformAdmin.userId`, `PlatformAuditEvent` (admin, organization), `Invitation.invitedByMembershipId`, `ImportJob.createdByMembershipId`, `AuditEvent.actorUserId`, `Organization.termsAcceptedByUserId`.
- Expand the audit, platform event and notification enums (6.5, 6.6). Enums for `industry` and `sizeBand`. Add `Incident.closureReason`, `Incident.resolutionText` stays, reassignment resolution fields on `Assignment`.
- New tables: `OrganizationRegistration`, `IdempotencyKey`, `SavedView`, `OutboxEvent`.
- Notification unique key `(recipientMembershipId, eventType, incidentId, incidentVersion)`.
- Indexes for every list filter: incident `(organizationId, status, priority)`, `(organizationId, siteId)`, `(organizationId, categoryId)`, `(organizationId, createdAt)`, assignment `(intervenantMembershipId, status)`, notification `(recipientMembershipId, readAt)`, audit `(organizationId, incidentId, createdAt)`, plus a trigram and tsvector index for search (French and English configs).
- Raw SQL kept in `prisma/sql` and applied by the baseline: partial unique indexes (I2, I4), append-only trigger (I7), CHECK constraints (decline reason length, radius over zero). A `db:check-drift` script guards against `migrate dev` silently dropping them.
- One clean baseline migration (no production data exists).

### 7.8 Files

Photos go to object storage through presigned PUT. The database holds metadata only. A record and its object must stay consistent: the confirm call verifies the object, and a daily sweep deletes orphans.

### 7.9 Async work, outbox and live updates

- **Transactional outbox.** Anything that must happen after a state change (notification rows, push, email) is written to `OutboxEvent` in the same transaction. An in-process worker polls with `FOR UPDATE SKIP LOCKED`, sends, and marks done with retries and backoff. This gives at-least-once delivery without a broker.
- **Live updates (S).** `GET /events` is a server-sent events stream scoped to the caller's organization and role. Events are fanned out through Postgres `LISTEN/NOTIFY`, so a second API instance works without Redis. The console falls back to refetch on window focus and a 30 second interval when the stream is unavailable. Mobile uses push plus refetch on foreground.

### 7.10 Observability

Structured pino logs with request id, user and organization ids (no personal content). `/health` (process alive) and `/ready` (database reachable). Per-route request counts, error rates and latency (RED) exposed as metrics (S). Audit log is the business trace.

### 7.11 Security baseline

Security headers and a strict CSP (no third-party origins for auth), CORS limited to the web origin, zod validation on every input, secrets only in environment, rate limits on public and auth routes, magic-byte upload checks, signed URLs, no `clerkUserId`-style identity leaks in DTOs, supervisors cannot demote the owner, dependency audit in CI, no `curl | bash` or write-scoped automation in CI.

### 7.12 Environments and deployment

Local: Postgres and Mailpit in Docker, API and web with `pnpm dev`, mobile with Expo. CI: install with frozen lockfile, typecheck, lint, migrate deploy on a Postgres service, tests, build. Production: container images for API and web, Postgres 16 with daily backups and a tested restore, S3 bucket, SMTP provider, EAS for mobile builds. Single region, single API instance to start.

### 7.13 Non-functional requirements

| Area | Requirement |
|---|---|
| Tenant isolation | Adversarial suite: for every endpoint, an org B caller gets 404 on org A resources. Every non-platform token gets 403 on `/platform`. CI blocks on failure |
| Performance | p95 under 300 ms for list and detail at 10,000 incidents per organization. Dashboard under 800 ms. Console route change under 100 ms after data is cached |
| Availability and data | Daily backups, documented and tested restore, health and readiness endpoints |
| Privacy | Versioned terms and data-processing acceptance. Documented data export and organization deletion procedure. Attachment retention policy documented before launch |
| Accessibility | WCAG 2.2 AA, keyboard-complete, visible focus, no information by colour alone |
| i18n | French and English. Person-level locale, organization default. Dates in the organization timezone |
| Browsers | Last two versions of Chrome, Edge, Safari, Firefox |
| Mobile | iOS and Android versions supported by Expo SDK 57. Cold start under 3 s on a mid-range device. Dynamic type respected up to 130 percent |
| Testing | Unit for services and state machines, integration for every route with a role matrix, concurrency test for double assignment, Playwright for journeys J1 to J4, J7, J8, device runs for J3 to J6 |

---

## 8. Frontend requirements

### 8.1 Web console

**Shells and routes**

| Area | Route | Shell | Navigation |
|---|---|---|---|
| Public | `/login`, `/register`, `/verify`, `/reset`, `/invite/:token` | Centered single column, 560 px max | none |
| Supervisor | `/app/...` | Left rail, top bar, content | Triage desk, Dashboard, Map, Reassignments, Team, Sites, Categories, Audit, Settings |
| Platform | `/platform/...` | Same shell, persistent "Platform mode" banner | Organizations, Registrations, Audit |
| Non-supervisor on web | `/use-the-app` | Centered | store links |

Left rail 232 px expanded, 64 px collapsed. Top bar 52 px holds the organization name, a search and command trigger, notifications, and the person menu. The console remembers rail state, density and column choices per person.

**Screen requirements**

| Screen | Requirements |
|---|---|
| Triage desk (inbox) | Split view: list on the left, docked case file on the right (min list 420 px, case file 520 to 640 px, resizable). Below 1280 px the case file becomes a slide-over. Filter bar with removable chips, saved views, search, density toggle, sticky header, row selection, virtualized past 200 rows. The selected incident is in the URL (`?incident=INC-2026-00042`) |
| Case file | Header (reference, title, priority, status, site, reporter), state-aware action bar, tabs Overview, Thread, Evidence. Thread merges events, assignments, progress, comments and attachments with the internal toggle for supervisors. Actions shown only when valid for state and role, with the reason when disabled. Conflict banner on version mismatch |
| Assign dialog | Ranked candidate list with fit chips (site access, specialty, availability, load), disabled rows with reason, confirm with optional internal note, triage fields inline |
| Reassignment queue | Table of requests with reason, age, current assignee, quick reassign or reject-with-note |
| Dashboard | Figures first (open, unassigned, awaiting review, median time to resolution), then ageing, workload, status and category breakdowns, 30 day trend. Tables before charts where action is needed. Every figure links to the filtered inbox |
| Map | Open incidents on a quiet basemap, priority glyph markers, click opens the case file |
| Team | Tabs Employees, Intervenants, Invitations. Add employee, Import CSV (stepper: upload, review errors, confirm), Invite intervenant. Row actions suspend, reactivate, revoke with a consequence dialog |
| Sites | Table plus detail with address search, pin, perimeter editor (circle or polygon), activate or deactivate |
| Categories and specialties | Inline-editable tables with default priority and linked specialty |
| Audit | Filter by incident, actor, event type, date. Export CSV |
| Settings | Organization profile, locale and timezone, billing contact, resolve-photo requirement, reporter phone visibility, ownership transfer |
| Notifications | Panel from the top bar and a full page. Each item deep links to the case file |
| Registration | 3-step stepper (Company, Primary contact, Review and accept). Inline validation, step labels with check marks, "Check your email" result |
| Platform pages | Organizations table, organization detail with Suspend and Reactivate (reason dialog), registrations, audit |

**Cross-cutting requirements**

1. **Data:** TanStack Query for all server state. Optimistic updates for transitions with rollback and a clear message on failure. Request ids shown in error details for support.
2. **URL state:** filters, sort, selected incident and tab live in typed search params so every view is linkable and saved views are just stored search params.
3. **Forms:** React Hook Form with the shared zod schemas. Errors inline, summary at top only for long forms. Never clear a form on error.
4. **Tables:** TanStack Table, sticky header, keyboard navigation (arrows, Enter, Space to select), column visibility, density.
5. **Loading:** skeletons that match the final layout. No spinner for work over 400 ms, use a progress state with text.
6. **Errors:** route-level error boundaries with a retry, offline banner, `ORG_SUSPENDED` blocking screen, `MFA_REQUIRED` redirect.
7. **Empty states:** state the action ("No incidents yet. Employees report from the app, or create one for them.").
8. **i18n:** FR and EN by feature namespace, no hard-coded strings, dates and numbers through `Intl` with the organization timezone and locale.
9. **Accessibility:** WCAG 2.2 AA, focus trapped and restored in overlays, visible focus ring, focus not hidden by sticky bars, live regions for toasts and conflicts, all status and priority use glyph plus label.
10. **Performance budgets:** app shell route under 200 KB gzipped JS, route-level code splitting, map and chart libraries lazy loaded, LCP under 2.0 s on broadband, interaction latency under 200 ms.
11. **Dev tooling:** an internal `/design` route renders every component and state in light and dark for review.
12. **Testing:** component tests with Testing Library, Playwright journeys with axe-core on every page visited, a keyboard-only run of each supervisor journey.

### 8.2 Mobile app

**Navigation**

| Role | Tabs | Header |
|---|---|---|
| Employee | Report, My incidents, Notifications, Profile | Offline queue badge |
| Intervenant | My work, History, Notifications, Profile | Organization switcher, offline queue badge |

**Screen requirements**

| Screen | Requirements |
|---|---|
| Sign-in | Email and password, secure token storage, biometric unlock (S), clear errors for suspended or revoked accounts |
| Invitation acceptance | Deep link `sentinel://invite/:token` and universal link. Shows organization and role, password for new people, sign-in for existing |
| Report (3 steps) | What (title, description, photo from camera or library, resized on device), Where (site picker, GPS suggestion with accuracy, manual pin fallback), Confirm. Success screen shows the reference and what happens next. Works offline |
| My incidents | List with status glyph and label, case file with the milestone Thread and public comments, comment box |
| My work | Three groups in urgency order: Needs response, In progress, Awaiting review. Card: reference, title, site, priority, organization name when the person has several |
| Assignment detail | Case file plus one primary action fixed at the bottom (Accept, then Post update, then Resolve). Decline and Request reassignment sit in a secondary menu and ask for a reason in a sheet. Resolve form: note, photo, confirm |
| Notifications | List, unread state, tap to open the item |
| Profile | Phone, language, company and certifications with expiry (intervenant), availability toggle, active organization, sign out |
| Update gate | Blocking screen when the version is below the minimum from `app-config` |

**Cross-cutting requirements**

1. **Offline queue:** persisted in `expo-sqlite`. Each action carries an idempotency key and moves Waiting, Sent or Failed with retry and a reason. Covers report, progress, resolve and comment. Photos are queued as files.
2. **Targets:** minimum 48 pt touch targets, 56 pt for primary actions in field screens. Minimum 16 pt body text. Bottom-anchored primary actions for one-handed use.
3. **Permissions:** location asked at the Where step or the On site update, camera at photo time, notifications after the first assignment or report. Each request is preceded by a one-line reason and has a manual fallback.
4. **Platform conventions:** native navigation gestures, safe areas, sheets for forms, haptic feedback on confirm.
5. **Resilience:** poor network is the default assumption: optimistic UI, cached lists, retry with backoff, no blocking spinners.
6. **Fonts and language:** fonts bundled with `expo-font`. Language follows the person's locale.
7. **Accessibility:** screen reader labels on all controls, dynamic type up to 130 percent, no colour-only meaning.
8. **Distribution:** EAS internal builds for the pilot, store submission in R7.

### 8.3 Shared package contract

`packages/shared` is the only place where these live, and both apps import them:

- zod schemas for every request and response, inferred types, and the enum values
- the incident and assignment state machines, so the UI can ask "which actions are valid now"
- the typed API client (fetch wrapper with error contract, idempotency header helper, cursor helpers)
- design tokens (`tokens.ts`) that generate the web CSS variables and the React Native theme
- i18n dictionaries keyed by namespace
- formatting helpers (reference, relative time, distance)

---

## 9. UI and UX direction

Full detail, tokens, components and wireframes are in `docs/DESIGN_SYSTEM.md`. The decisions that bind the product requirements:

1. **Calm, modern, smooth.** Light surfaces, soft role-based radii, one confident brand colour, generous space where occasional users act and density where experts work. Smooth is measurable: no layout shift, optimistic updates, one easing family at 120 to 240 ms, skeletons that match layout, no full-page reloads.
2. **The Thread is the signature.** The case file's continuous timeline, with a single line connecting events and one live node, is the memorable element of the product. Everything else stays quiet.
3. **Triage desk, not inbox plus pages.** List and case file live side by side. Selecting never navigates away.
4. **Priority and status are never colour only.** Each has a glyph and a label.
5. **Field first on mobile.** Large type, high contrast, fixed bottom action, offline state always visible.
6. **Plain language.** Sentence case, verbs on buttons that match the resulting toast, errors that say what to do. FR and EN from day one.
7. **Motion answers actions.** The only non-user-triggered motion is a three-cycle pulse on an incident that needs a response. Reduced motion is respected.
8. **Dark theme** is tokenized from the start and ships in R7.

---

## 10. Delivery plan

Each milestone has its own branch `feature/R<n>-<slug>`, ends with green checks, a code review and a security pass on new endpoints, then waits for approval to commit and merge. Branches are deleted once merged.

| Milestone | Content | Exit criteria |
|---|---|---|
| R0 | Merge the P0 stack into main, tag `legacy-v0`, scaffold the four packages with strict TS, lint, tests and CI, replace stale docs | `pnpm -r typecheck lint test build` green, `/health` and `/ready` respond, web and mobile render a placeholder |
| R1 | Schema v2 with raw SQL constraints, identity verification gate, context resolver and guards, seed, DB-level tests | `migrate reset` and seed clean. Tests prove I1, I2, I4, I7. Auth tests: sign-in, lockout, session revoked on membership revoke |
| R2 | Incident loop slice: API, console (shell, inbox, case file, assign), mobile (sign-in, report, my work, accept, resolve), attachments, in-app notifications, audit | Role matrix tests, adversarial suite, double-assignment concurrency test, Playwright supervisor journey, emulator run for reporter and intervenant |
| R3 | Onboarding: registration, verification email, setup checklist, sites, categories, people, CSV import, invitations, deep links | Playwright J1 and J2, deep-link acceptance on a device |
| R4 | Supervisor depth: dashboard, map, reassignment queue, saved views, bulk, command palette, live updates, audit viewer, i18n, settings | Keyboard-only run, Lighthouse accessibility 95 or higher |
| R5 | Platform admin: TOTP, organizations, suspend and reactivate, registrations, platform audit, admin CLI | Every non-admin token gets 403 on `/platform`, Playwright J8 |
| R6 | Mobile depth: organization switcher, cross-organization work, offline queue, `app-config` gate, push, certifications, availability | J3 to J6 on an EAS internal build, offline then reconnect run |
| R7 | Hardening: CSP, rate limits, 10k dataset performance with `EXPLAIN`, dark theme, backup and restore runbook, deploy docs, store checklist, optional RLS | The acceptance checklist below |

**Acceptance checklist:** every M feature passes its tests; zero cross-tenant failures; keyboard-only run of each web journey; mobile journeys on a physical iOS and Android device including offline then reconnect; Lighthouse accessibility 95 or higher on core pages; p95 targets met on the 10,000 incident dataset; restore test documented; no `any` in API services; no hard-coded colours or strings in the apps.

---

## 11. Open decisions

| # | Decision | Default applied here | Decide by |
|---|---|---|---|
| 1 | Identity library | Better Auth, in-house fallback | R1 gate |
| 2 | Object storage dev adapter | Evaluate Garage or SeaweedFS, local disk fallback | R2 |
| 3 | Map tiles provider and licence | MapLibre with a commercial-use vector provider | R2 |
| 4 | Brand name for the app stores and domains, store accounts | Sentinel, to be confirmed | R6 |
| 5 | Tabular figures in the chosen fonts | Resolved: both Atkinson Hyperlegible Next and Bricolage Grotesque support `tabular-nums` (measured in the browser, 5 October 2026) | done |
| 6 | Attachment retention period | Document before launch, default 24 months after closure | R7 |
| 7 | Trial length and what happens at the end | 30 days, informational only, no lockout | with billing |
| 8 | Reopen closed incidents | Out of v1 | after pilot |
| 9 | Supervisors scoped to a subset of sites | Out of v1 | after pilot |
