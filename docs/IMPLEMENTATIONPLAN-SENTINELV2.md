# Sentinel V2: implementation plan to production and enterprise grade

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
>
> Phase 0 is written as bite-sized TDD steps. Phases 1 to 7 are task specs (files, interfaces, acceptance tests). Before starting a phase, expand it into its own bite-sized plan with superpowers:writing-plans, saved as `docs/plans/V2-P<n>-<slug>.md`.

**Goal:** take Sentinel from a working rebuild to a product that real organizations in Cameroon register for, pay for and run their sites on, operated by one developer from the platform console.

**Architecture:** keep the modular monolith: one Express API, one PostgreSQL, one React web app, and the `packages/shared` contracts. Add only what production needs:

- a Postgres job queue
- object storage
- phone-first identity
- an installable web app with an offline queue and push
- row-level security as a second tenant wall
- Stripe billing with a mobile-money fallback
- a platform control room

**Tech stack:**

- **Today:** React 19, Vite 7, TanStack Router/Query, Tailwind v4, Radix, Express 5, PostgreSQL 16, zod 4, pino.
- **Changed:** Prisma 6 → 7 (with `@prisma/adapter-pg`), Node 22 → 24.
- **New:** pg-boss, `@aws-sdk/client-s3`, sharp, web-push, vite-plugin-pwa, libphonenumber-js, Stripe, a mobile-money aggregator (Flutterwave or Notch Pay), the WhatsApp Cloud API, Twilio Verify, Sentry.

**Spec:** `docs/PRD.md` v2.1, `docs/DESIGN_SYSTEM.md` v2 and `PRODUCT.md`. This plan amends the PRD where section 3 says so.

**Decisions taken with the owner (8 October 2026):**

1. First market is Cameroon: XAF, French first, English second.
2. Employees and intervenants are identified by phone number, with WhatsApp or SMS codes. Supervisors keep email.
3. Billing is Stripe self-serve through an EU or US company.
4. Employees report, and so can visitors through QR codes, where a site enables it.
5. The supervisor web console design is locked: additive changes only.

## Global constraints

- **Runtime and types:** Node 24 LTS (from Phase 1), pnpm 10.15+, TypeScript strict, no `any` in API services.
- **Infrastructure:** one PostgreSQL, one API image, one web image. No Redis, broker or microservices until a measured need exists (PRD 1.5.6).
- **Tenancy:** tenant context comes only from `X-Org-Id`, validated against an ACTIVE membership, or from the caller's own memberships on `/me/*`. Cross-tenant access answers 404.
- **Vocabulary:** Employee, Intervenant, Supervisor, Site, Incident. Never "user", "responsable" or "administrator". FR and EN are complete and typed.
- **Copy:** sentence case, verbs on buttons, no exclamation marks, emoji or em dashes (DESIGN_SYSTEM §6).
- **Accessibility:** WCAG 2.2 AA. Field targets are 48 px minimum and 56 px for the primary action. Status and priority are never shown by colour alone.
- **Concurrency:** incident and assignment mutations carry `expectedVersion`. Creates and transitions accept `Idempotency-Key`.
- **Platform boundary:** platform admins never see incident content. The only exception is an owner-granted support session (Phase 5), which is bannered and audited.
- **Field budgets:**
  - route JS ≤ 200 KB gzipped
  - photos re-encoded to a 1600 px long edge at quality ≈ 0.72, typically ≤ 400 KB
  - list images are 320 px thumbnails

## Review focus

Failure modes no single task naturally exercises, each pinned to an owning task:

1. **Shared phone or browser.** One person signs out and another signs in while the first person's cache or offline queue still exists. Owned by Task 0.1 (no-reload switch test) and Task 2.4 (queue blocks sign-out; Clear-Site-Data).
2. **Intervenant serving two organizations.** They open and act on work from both, including from a notification deep link while the app is pointed at the other organization. Owned by Tasks 0.3, 0.4 and 2.5.
3. **Abuse of public entry points.** A guest QR flood on one site, or SMS pumping through the OTP endpoint. Owned by Tasks 2.1 and 2.6 (rate limits, geo allowlist, honeypot).
4. **Double replay on reconnect.** A reconnecting phone replays the same queued report or resolve twice after a partial failure. Owned by Task 2.4 (idempotency replay test).
5. **Missing tenant filter.** A new endpoint, job or raw query forgets `organizationId`. Owned by Tasks 3.1 and 3.2 (RLS, query guard, route-table adversarial suite).

---

## 1. Where Sentinel stands (audit, 8 October 2026)

### 1.1 Built and working

**Web (one app, every role):**

- **Console (`/app`):**
  - triage desk with docked case file, J/K/Enter/A/C/S keys, command palette, saved views, bulk actions and density
  - dashboard, reassignment queue, team (with CSV import), sites, categories and specialties
  - audit log with CSV export, settings and notifications
- **Field (`/field`):** three-step report with photo preparation, my incidents, cross-org "my work" list, case file, availability.
- **Platform (`/platform`):** organizations, suspend and reactivate, plan, registrations, platform audit.
- **Public:** registration with email verification, invitation, password reset, TOTP for platform admins.

**API:**

- Express 5 modules.
- In-house sessions: scrypt, hashed opaque tokens, lockout.
- Per-request tenant guard (I13), role guards and an incident policy (`incidentScope`).
- Optimistic concurrency, idempotency keys and cursor pagination.
- Database invariants:
  - append-only audit (trigger)
  - immutable original report (trigger)
  - partial unique indexes (I2, I4)
  - trigram search
- SSE through pg `NOTIFY`, magic-byte upload checks, local-disk storage, in-memory rate limits, nodemailer.

**Quality:**

- API integration tests on Postgres: tenancy, incident flow, onboarding, inbox depth, events, attachments and platform.
- Shared domain tests and a token contrast test.
- Playwright: auth roles and the incident loop.
- CI: format, lint, typecheck, migrate, test, build, e2e.

**Infrastructure:** Dockerfiles, nginx with a strict CSP, docker-compose (db, mailpit), migrations run at container start.

### 1.2 Gaps

| Area                  | Today                                                                              | Why it blocks production or enterprise                    | Phase   |
| --------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------- | ------- |
| Account switch        | Previous person shown after sign-out then sign-in, until reload                    | Wrong identity on shared devices                          | 0       |
| Console layout        | Document scrolls under the `h-dvh` shell, leaving a gap                            | Broken layout on every long page                          | 0       |
| Intervenant           | Org switcher; notifications, history, availability and live updates scoped per org | Friction; missed notifications from other clients         | 0       |
| Runtime               | Prisma 6 (security fixes end 19 Nov 2026), Node 22 (EOL 30 Apr 2027)               | Unsupported dependencies                                  | 1       |
| Storage               | Local disk inside the container                                                    | Photos lost on redeploy; single instance                  | 1       |
| Async                 | Emails sent best-effort after commit; no job runner                                | Lost mail, no retries, no scheduled work                  | 1       |
| Ops                   | Logs to stdout, `/health`, `/ready`                                                | No error tracking, alerting, backups or restore           | 1       |
| Identity              | Email and password only                                                            | Field staff in Cameroon use phone/WhatsApp                | 2       |
| Field                 | No offline, no push, no QR, no GPS pins                                            | Networks and power are unreliable; addresses are informal | 2       |
| Isolation             | App-layer only; PRD query-layer guard not built; no RLS                            | One missed `where` leaks a tenant                         | 3       |
| MFA                   | Platform admins only                                                               | Supervisors are the valuable accounts                     | 3       |
| SLA, verification     | None                                                                               | Buyers measure response time                              | 4       |
| Billing, platform ops | `plan` field only; list, suspend and plan change                                   | No revenue, no support access, no export or deletion      | 5       |
| Enterprise            | None                                                                               | SSO, API, webhooks, security pack                         | 6       |
| Legal                 | Versioned terms only                                                               | Cameroon Law 2024/017, DPA, subprocessors                 | 1 and 7 |

---

## 2. Research: how comparable products work

Sources are listed in Appendix A, referenced as [A1], [A2] and so on. "(inference)" marks a conclusion drawn from evidence rather than stated by a source.

### 2.1 The loop: request, work order, verification

| Product                        | Request handling                                                                                                                                | Completion check             |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| MaintainX                      | Separate request; an admin approves it into a work order. The requester is notified on the decision, changes and comments [A1]                  | None documented              |
| UpKeep                         | Admin or Limited Admin approves; a decline sends the reason; the requester is notified at Approved, In progress, On hold and Complete [A2]      | None                         |
| Limble                         | Review is opt-in and off by default [A3]                                                                                                        | None                         |
| Fiix                           | One object: a work order in "Requested" status [A4]                                                                                             | None                         |
| ServiceChannel                 | Completed → Pending Confirmation waits about 5 days for the location's feedback, then auto-closes; there is an "Unsatisfactory" sub-status [A5] | Location sign-off plus timer |
| Fixflo                         | "Mark as complete", then "awaiting feedback" or "ready for closure" (agency setting) [A6]                                                       | Requester feedback           |
| Mitti (formerly SafetyCulture) | Status moves can be restricted to named people and require evidence [A7]                                                                        | Evidence-gated               |

**For Sentinel:**

- The NEW status already plays the "request" role (the Fiix model), so no separate Request object is needed.
- Supervisor close and send-back is stronger than most mid-market CMMS.
- Add ServiceChannel's idea: ask the reporter "Est-ce réglé ?", with optional auto-close.

### 2.2 Reporters without paid seats

- **Free, unlimited requesters:** MaintainX, Limble and UpKeep [A8], plus Mobility Work and FMX.
- **No-login intake:**
  - MaintainX portal by link or QR [A9]
  - Limble QR per location and asset [A10]
  - Mitti issue QR on any plan, with optional contact details [A11]
  - Fixflo picture-based reporting in 40+ languages [A12]
- **Anonymous follow-up:**
  - FixMyStreet confirms anonymous reports by email.
  - SeeClickFix sends anonymous reporters no notifications [A13].
- **Baymard (checkout as a proxy):**
  - 18% of shoppers abandon over forced account creation.
  - Forms average 11.3 fields when 8 suffice [A14].
- **NN/g:** eliminate, automate, simplify [A15].
- **iOS:** installed iOS web apps keep storage separate from Safari, so an emailed magic link does not sign in the installed app [A16]. Codes typed inside the app avoid the problem.

### 2.3 Contractors serving several clients

- **One login across clients:** CorrigoPro [A17]. ServiceChannel Provider has an "All" tab listing every client's work orders [A18].
- **Presence and proof:**
  - ServiceChannel GPS check-in/out works offline, with IVR as backup [A19].
  - CorrigoPro prompts check-in by geofence [A20].
  - Praxedo reports carry photos, signatures and GPS [A21].
- **Switching friction:**
  - MaintainX cannot switch organization offline [A22].
  - Microsoft Teams shipped a cross-tenant activity panel (GA March 2026) [A23].

**Conclusion (inference):** a contractor needs one cross-org list with a client chip. A switcher, if kept at all, is for settings only. PRD J5 already intends this.

### 2.4 SLAs and escalation

- **ServiceChannel:**
  - Providers accept or decline within 30 min, or 15 min for emergencies.
  - Priority is an ETA window such as "P1 – 4 Hours" [A19][A24].
- **Zendesk SLA column:** a countdown, amber under 15 min, red when breached [A25].
- **Tier gating:** MaintainX escalation teams sit on upper tiers; UpKeep workflow automation is Enterprise [A26].
- **Gap:** per-priority SLA timers were not found in mid-market CMMS docs (inference). That makes them a differentiator.

### 2.5 Pricing and packaging (October 2026)

| Product   | Paid tiers (per user per month)     | What sits at Enterprise or costs extra                                            |
| --------- | ----------------------------------- | --------------------------------------------------------------------------------- |
| MaintainX | $20 / $65 (annual), free tier [A27] | SSO, custom permissions, multi-site, escalation (Enterprise); REST API in Premium |
| UpKeep    | $24 / $55 [A26]                     | SSO, custom roles, API, automation                                                |
| Limble    | No list price                       | API at Premium+; custom roles, SSO, multi-location at Enterprise                  |
| Fiix      | $45 / $75, free tier                | Audit trail at Enterprise; SSO and API extra                                      |
| Mitti     | $24, free up to 10 seats            | SSO at Premium; SCIM at Enterprise                                                |
| Praxedo   | $39–149, 5-user minimum             |                                                                                   |
| Yuman     | €69–119                             | Customer portal from the €79 tier                                                 |

- **Offline is tier-gated:** MaintainX Premium+, UpKeep Professional+, Limble Premium+ [A27][A26].
- **SSO tax:** SSO is commonly tier-gated; sso.tax lists 200+ vendors [A28].
- **For Sentinel (inference):** per-user prices of $20–75 do not fit Cameroonian budgets, and per-seat pricing taxes field adoption. Price per active site in XAF, with unlimited employees and intervenants, and include offline and SLA.

### 2.6 Field and offline patterns

- **Offline:** MaintainX caches assigned work orders, soonest due first, after a prior online sync [A22].
- **Visit flow:**
  - Jobber offers "on my way", directions to Maps or Waze, a timer, photos and forms [A29].
  - A MaintainX photo field blocks completion until filled.
- **Touch targets:**
  - WCAG 2.5.8 AA requires 24 px (44 px is AAA).
  - Apple uses 44 pt; Material uses 48 dp [A30].
- **Outdoors:** W3C cites sun glare and 4.5:1 to 7:1 contrast [A31].

### 2.7 Supervisor desk patterns

- **Linear Triage:** accept 1, decline 2, duplicate 3, snooze H; X or Shift-click to multi-select; shareable saved views [A32].
- **Help Scout:** single-key A (assign) and S (status) [A33].
- **Front:** shows who is replying, with live drafts [A34].
- **Dashboards:** backlog, assignee activity, SLA, and overdue vs on-time [A25][A35].

Sentinel already has most of this. The missing pieces are SLA timers and a "breaching soon" view.

### 2.8 Operating a multi-tenant SaaS (operator side)

- **Microsoft:** a control plane is a tenant catalog plus lifecycle processes (trial, onboard, deactivate/reactivate, offboard with retention). Manual operation works under about 10 tenants, and broad operator access is a flagged risk [A36].
- **AWS SaaS Lens:** tenant-aware health and usage, "without breaking privacy" [A37].
- **DataGrail support access:** granted by the customer's admin, time-limited and revocable, with a banner, restricted actions and a downloadable log [A38].
- **Clerk impersonation:** expiring token with a 10-minute inactivity timeout [A39].

### 2.9 Installable web app (PWA) in 2026

- **iOS push:** needs a Home Screen install (16.4+). Declarative Web Push arrived in 18.4 [A40].
- **Background Sync:** Chromium yes; Safari no [A41].
- **iOS storage:** Home Screen apps are exempt from the 7-day wipe; eviction is LRU [A42].
- **Camera:** iOS cannot force the camera from a file input [A43].
- **Install prompt:** `beforeinstallprompt` is Chromium-only [A44].
- **Expo:** background tasks are not guaranteed [A45].

**Conclusion:** a PWA is viable for cached lists plus queued writes synced on foreground. Expo is needed only if guaranteed background upload or install-free push becomes mandatory. In Cameroon, Android holds 82.4% of mobile OS share (StatCounter, July 2026) [B5], which is where PWA support is strongest.

### 2.10 Shared devices

- **OWASP:** invalidate the session server-side and send `Clear-Site-Data: "cache","cookies","storage"` on logout [A46]. Supported from Chrome 61, Firefox 63 and Safari 17; `storage` also clears IndexedDB and service workers [A47].
- **TanStack Query:** `queryClient.clear()` empties the caches [A48]. But see Task 0.1: it detaches a mounted observer.
- **Offline queues (inference):** block sign-out while the queue is unsynced, and key caches by user and organization.

### 2.11 Enterprise bar for a solo-run SaaS

**Tenant isolation:**

- AWS calls RLS required for pooled tenancy [A49].
- In PostgreSQL 16, table owners and BYPASSRLS roles skip RLS unless FORCE is set; no policy means deny [A50].
- Fail closed with `NULLIF(current_setting('app.org_id', true), '')::uuid` [A51]. Index policy columns and wrap functions as `(select ...)` [A52].
- Prisma's RLS extension is an example, not production code [A53].
- PgBouncer transaction mode does not keep session SETs, so keep the setting transaction-local [A54].

**Runtime support:**

- Prisma 6 gets security fixes only and ends 19 Nov 2026. Prisma 7 requires driver adapters [A55]: `@prisma/adapter-pg`, the `prisma-client` generator and `prisma.config.ts`.
- Pool defaults change: `pg` has no connection timeout by default.
- Node 22 reaches end of life on 30 Apr 2027 [A56].

**Identity:**

- NIST SP 800-63B-4 at AAL2: 24 h overall and 1 h idle (SHOULD); offer a phishing-resistant option [A57].
- FIDO, May 2026: about 5 billion passkeys [A58].
- Build vs buy: WorkOS costs $125 per connection per month each for SSO and SCIM [A59]; Ory Polis is free and self-hosted [A60].

**Supply chain:**

- Shai-Hulud (September 2025) hit 500+ npm packages [A61].
- Mini Shai-Hulud (May 2026) hit TanStack and shipped with valid provenance [A62].
- npm 12 disables lifecycle scripts by default [A63]. pnpm supports release-age delays [A64].

**Security baseline:**

- OWASP ASVS 5.0 [A65].
- OWASP Top 10 2025 adds supply-chain failures and mishandled exceptional conditions [A66].
- Uploads: allowlist, re-encode, scan [A67]. sharp strips EXIF and GPS by default [A68].

**Operations:**

- pg-boss: Postgres-backed with SKIP LOCKED, cron and dead-letter queues; `send(name, data, { db })` enqueues inside the caller's transaction [A69].
- BullMQ needs Redis with `noeviction` and AOF [A70].
- Email: Gmail requires SPF or DKIM and a spam rate below 0.3% [A71].
- 99.9% availability allows 43.2 min of downtime per month [A72].
- Sentry's EU region still stores account and 2FA data in the US [A73].
- Hosting:
  - Scaleway Paris costs about €25–35 a month for a small footprint, but no PITR was found [A74].
  - OVH managed Postgres keeps 14-day backups with a 99.95% SLA [A75].
  - Clever Cloud offers pgBackRest PITR on request [A76].

**EU law (applies if the billing company is in the EU):**

- GDPR Art 28 processor duties [A77].
- The Data Act requires 30-day switching and bans egress fees from 12 Jan 2027, so a full tenant export is needed [A78].
- If the company is French: e-invoicing reception from 1 Sep 2026, issuing for SMEs from 1 Sep 2027 [A79].

### 2.12 Cameroon

Several findings below come from secondary sources and some conflict. Before launch, a Cameroonian lawyer and tax adviser must confirm the items marked **(confirm)**.

**Data protection (Law 2024/017 of 23 Dec 2024):**

- The 18-month transition ended on 23 June 2026, so the law is enforceable now [B1].
- The authority (APDP/ADCP) was reported not yet operational in mid-2026 [B2].
- Scope over foreign processors is disputed between sources (confirm) [B2][B3].
- Processing requires prior declaration or authorisation, and controllers keep a register [B4]. Sentinel's customers are the controllers; Sentinel is their processor.
- Breaches must be notified "immediately" [B2].
- Transfers abroad need the authority's approval, an adequate destination, or contractual clauses. No explicit localisation mandate was found [B4].
- Fines reach XAF 100M, plus prison terms [B2].

**Network:**

- Cables: SAT-3 lands at Douala, WACS at Limbe, NCSCS links Kribi to Lagos, and SAIL reaches Brazil [B6].
- Lagos to Douala/Yaoundé round-trip time is about 20 ms [B7].
- There is no hyperscaler on-ramp in Douala [B8].
- MTN mobile ping is already about 153 ms [B9], so the last mile dominates (inference).

**Devices and connectivity:**

- Android 82.4% and iOS 17.6% [B5].
- 87.5% of mobile connections are 3G or above; internet penetration is 41.9% [B10].
- Data costs about US$1.63 per GB [B11].

**Power:**

- 6–8 hours of daily cuts reported since December 2024, and up to 10 hours in the north [B12].
- All four operators were fined for poor service quality [B9].

**Messaging:** WhatsApp is the second most used platform (qualitative) [B13].

**Buyers:** public tenders are published on COLEPS (2,334 notices in 2025) [B14].

**Payments:**

- Stripe: XAF is zero-decimal [B15]. Stripe has no mobile money in Cameroon.
- Flutterwave is licensed in Cameroon through Ecobank, with MTN and Orange MoMo in XAF [B16].
- Notch Pay supports MTN and Orange through hosted or direct APIs [B17].
- Mobile money is push-based: plan invoice → pay link → webhook rather than auto-debit.

**Tax:**

- VAT is 19.25% on digital services from non-residents, B2B included, with no threshold and a local fiscal representative required [B18].
- Stripe Tax supports Cameroon once you are registered [B19].
- A 15% withholding on service payments abroad is possible (confirm).

**Messaging prices:**

- WhatsApp has billed per message since 1 July 2025. Cameroon is in "Rest of Africa". Utility templates inside an open service window are free [B20].
- Authentication and utility templates cost about $0.0046 each (third-party, confirm against the live rate card) [B21].
- Authentication templates support copy-code and one-tap autofill on Android.
- SMS costs $0.08–0.25 locally, and MTN requires pre-registered sender IDs [B22].
- Twilio Verify Fraud Guard plus geo-permissions blocks SMS pumping [B23].

### 2.13 Why the leaders succeed, what they lack, and what Sentinel learns

Each lesson below is drawn from the evidence in 2.1–2.12. Where it is our reading rather than a source's claim, it is marked (inference).

| Product                                | Why it succeeds                                                                                                                                                                        | Why it is efficient                                                                                                                 | What it lacks (Sentinel's opening)                                                                                                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MaintainX                              | Free tier and free requesters remove the adoption barrier; a mobile, chat-like work order everyone understands; QR request portal with no login [A8][A9][A27]                          | Work requests are filtered before they become work; offline caches the soonest-due work first [A1][A22]                             | No completion verification step; offline and escalation reserved for upper tiers; cannot switch organization offline; per-user price ($20–65) out of reach in Cameroon [A22][A27] |
| UpKeep                                 | Clear requester status updates at every stage; free requesters [A2][A8]                                                                                                                | One approval gate, then the technician works without paperwork                                                                      | SSO, API and automation only on Enterprise; no verification; online-only below Professional [A26]                                                                                 |
| Limble                                 | QR per location and per asset, link and email intake; unlimited assets and PMs even on Standard [A10][A27]                                                                             | Requesters track status without a seat                                                                                              | No public prices; custom roles, approvals and multi-location at Enterprise                                                                                                        |
| Fiix                                   | Free tier, broad CMMS (assets, PM, inventory) [A27]                                                                                                                                    | One object: a request is just a work order in "Requested" status, with nothing to convert [A4]                                      | Audit trail only on Enterprise; SSO and API sold separately                                                                                                                       |
| ServiceChannel                         | Built for multi-site retail with external contractors, with the strongest closing loop: the location confirms, auto-close after about 5 days, an "Unsatisfactory" sub-status [A5][A19] | Contractors see every client in one "All" list; GPS check-in works offline; acceptance SLAs (30 min, 15 for emergencies) [A18][A19] | Heavy and expensive, aimed at large US networks; contractors pay usage fees (1.5% capped at $4) [A27]; complexity unsuited to a 10-site Cameroonian company (inference)           |
| Fixflo                                 | Picture-led reporting in 40+ languages lowers the literacy and language barrier; requester feedback before closure [A6][A12]                                                           | Guided reporting reduces back-and-forth                                                                                             | Property-management niche; quotes and approvals add steps                                                                                                                         |
| Mitti (formerly SafetyCulture)         | QR issue reporting on every plan, no account [A11]; evidence-gated status changes [A7]                                                                                                 | Proof is required at the moment of the status change, not chased afterwards                                                         | SSO on Premium and SCIM on Enterprise; reporter updates unconfirmed [A11][A27]                                                                                                    |
| Linear, Front, Zendesk (desk patterns) | Keyboard-first triage, shared views, collision detection, SLA countdowns [A25][A32][A34]                                                                                               | Single-key actions and bulk selection make tens of items a day cheap                                                                | Not built for field work or offline                                                                                                                                               |

**What makes them good, in five lessons:**

1. **Remove the cost of reporting.** Reporters are always free and never need an account to report (QR or link) [A8]–[A11]. A forced account costs about 18% of completions in checkout studies [A14]. Sentinel: free employees, QR prefill, opt-in guests, one-screen report (D7).
2. **Filter before you dispatch.** Every leader puts a gate between "reported" and "work". Sentinel's NEW state plus triage is that gate (Fiix model) [A4], with no extra object.
3. **Close the loop with the person who reported.** The best (ServiceChannel, Fixflo) ask the reporter or location to confirm, and auto-close on silence [A5][A6]. Most mid-market tools do not, so Sentinel adds "Est-ce réglé ?" (D8).
4. **One list for the person doing the work.** Contractors succeed when every client's work is in one list and works offline [A18][A19]. MaintainX's org switching is a known friction [A22]. Sentinel removes the switcher (Phase 0, D5).
5. **Proof at the moment of action.** Photos and check-ins captured when the status changes [A7][A19] beat chasing evidence later. Sentinel: required resolution photo option (exists) plus the "Je suis sur place" GPS stamp (Task 2.8).

**What they all lack for Sentinel's market (inference from 2.5 and 2.12):**

- Pricing per user in USD.
- Email-first identity.
- Offline, SLA and escalation locked behind expensive tiers.
- No WhatsApp channel.
- Contractor portals that assume reliable connectivity.

Sentinel's position:

- price per site in XAF, with unlimited field users
- phone and WhatsApp identity
- offline, SLA and verification included in the core plans
- a supervisor desk with the keyboard efficiency of Linear and Front

**What Sentinel deliberately does not copy:** full CMMS breadth (assets with meters, preventive maintenance, parts, purchase orders), contractor invoicing and NTE, and custom roles. These are what make MaintainX, Fiix and ServiceChannel heavy. They are left out until pilots prove the need (2.14).

### 2.14 What Sentinel takes, adapts and leaves

**Takes:**

- free reporters
- QR intake per location
- one cross-client list for contractors
- check-in with GPS stamp
- photo-gated resolution (exists)
- SLA countdowns
- the operator's tenant catalog and lifecycle
- customer-granted support access

**Adapts:**

- Reporter confirmation instead of a fixed location sign-off.
- Pricing per site, not per user.
- WhatsApp as the notification and login channel, because email is weak in the field.

**Leaves (non-goals for V2):**

- assets with meters
- preventive maintenance
- parts and inventory
- NTE, quotes and invoicing for contractors
- custom roles

These are CMMS territory and would dilute the incident loop. Revisit after pilots.

---

## 3. V2 decisions

Each decision gives what we do, why (with evidence), and what we rejected.

- **D1. Keep the monolith; add pg-boss for jobs.**
  - **Why:** Postgres-only, with cron, retries, dead-letter queues and transactional enqueue [A69]. Redis would add an always-on service with persistence tuning [A70]. Matches PRD "boring technology".
  - **Rejected:** BullMQ.
- **D2. Upgrade to Prisma 7 and Node 24 first (Phase 1).**
  - **Why:** Prisma 6 security fixes end 19 Nov 2026; Node 22 reaches end of life 30 Apr 2027 [A55][A56].
  - **Bonus:** the pg Pool can then be shared by Prisma, pg-boss and the SSE listener.
- **D3. Database-enforced tenant isolation.**
  - Postgres RLS with FORCE, a non-owner app role, a transaction-local `app.org_id`, and fail-closed policies.
  - A Prisma query guard that rejects tenant queries without `organizationId` (PRD 5.5.3, never built).
  - An adversarial suite generated from the route table.
  - **Why:** [A49]–[A54]; a cross-tenant leak is the one unrecoverable failure.
  - **Rejected:** schema-per-tenant (migration fan-out for one operator).
- **D4. Phone-first identity for field roles.**
  - Employees and intervenants are invited and sign in by phone number: a 6-digit code by WhatsApp authentication template, with SMS fallback after 30 s.
  - Field sessions last 30 days, then a new code is needed (NIST AAL1 re-authentication window).
  - Supervisors keep email + password; TOTP is offered in Phase 3 and owners can make it mandatory; passkeys come next.
  - Platform admins: 1 h idle and 12 h maximum (AAL2) [A57].
  - **Why:** owner's market knowledge; WhatsApp usage [B13]; codes typed inside the app work in installed PWAs where magic links do not [A16]; pricing about $0.005 per WhatsApp authentication message [B21].
  - **Rejected:** magic links, email-only.
- **D5. Person-centric field app with no organization switcher.**
  - Work, notifications, history, availability and live updates span every membership.
  - Each card carries a client chip. Opening a case file switches organization silently.
  - **Why:** [A17][A18][A22][A23]; PRD J5.
  - **Rejected:** keeping the header switcher.
- **D6. Installable web app first; Expo only on kill signals.**
  - **Why:** Android at 82% [B5] gets push, install and Background Sync [A41]; one codebase for one developer.
  - **Kill signals:** under 60% of invited field staff signed in within 7 days, or more than 5% of queued photos failing to upload in pilot.
- **D7. Reporters.**
  - Employees are free and unlimited.
  - A QR code per site and per area pre-fills the location.
  - Sites can opt in to guest reports, with an optional WhatsApp number for updates.
  - NEW remains the request state, with no new object.
  - The report form shrinks to one screen.
  - **Why:** [A8]–[A15].
- **D8. Reporter confirmation and auto-close.**
  - After RESOLVED, the reporter is asked "Est-ce réglé ?" (Oui / Toujours un problème).
  - The supervisor sees the answer.
  - Optional org setting: close automatically after N days when the answer is yes or no answer arrives.
  - **Why:** [A5][A6].
- **D9. SLA timers.**
  - Respond and resolve targets per priority, using the organization's business hours and timezone.
  - Amber and red chips, a "breaching soon" view, escalations at 75% and 100%.
  - **Why:** [A19][A24][A25]; a differentiator at mid-tier.
- **D10. Notifications.**
  - In-app is the source of truth.
  - Web push on installed apps.
  - WhatsApp utility templates for five high-value events only: assigned, sent back, reassignment rejected (intervenant); resolved with confirmation request, closed (reporter).
  - Email for supervisors and owners.
  - Each organization has a monthly WhatsApp budget, with the actual spend shown in the platform console.
  - **Why:** [B20][B21]; flaky networks and power [B9][B12].
- **D11. Object storage and photo pipeline.**
  - Private S3-compatible bucket.
  - sharp re-encodes every image (stripping EXIF/GPS) and makes a 320 px thumbnail.
  - Downloads use 5-minute presigned GETs after the scope check.
  - Client-side compression stays.
  - **Why:** [A67][A68]; data at about $1.63/GB [B11].
- **D12. Hosting.**
  - EU region (Paris) on a managed provider with PITR: OVHcloud Managed PostgreSQL (14-day backups, 99.95%) or Clever Cloud with PITR enabled. Compute and object storage come from the same provider.
  - A CDN serves the web shell.
  - Keep migration to a Lagos region as an option.
  - **Why:**
    - the last mile dominates latency [B9]
    - there is no Douala on-ramp [B8]
    - mature managed Postgres
    - EU law for the processor
    - Scaleway is cheaper but has no PITR [A74]–[A76]
  - Revisit if the Cameroon authority requires local hosting.
- **D13. Billing.**
  - Stripe Billing: one product per plan, priced per active site per month, with the quantity synced to active sites.
  - Prices in XAF (zero-decimal) or EUR; trials without a card.
  - Mobile money and bank transfer: an invoice with a payment link through Flutterwave (or Notch Pay), confirmed by webhook, extends the period.
  - Billing state lives in Sentinel's database and is provider-agnostic.
  - Stripe Tax is enabled once Sentinel is registered for Cameroon VAT; invoices state VAT and withholding.
  - **Why:** [B15]–[B19], [A80], [A81].
- **D14. Platform control room.**
  - Tenant catalog with health computed from usage counts only.
  - A lifecycle state machine.
  - Entitlement overrides.
  - Support access the owner grants: time-boxed, read-only, bannered, audited on both sides.
  - Data export and deletion jobs, plus system health.
  - **Why:** [A36]–[A39].
- **D15. Shared-device hygiene.**
  - Fix the observer bug (Task 0.1).
  - Sign-out in other tabs follows via BroadcastChannel.
  - `Clear-Site-Data` once offline storage exists.
  - The offline queue blocks sign-out.
  - Caches are keyed by user.
  - **Why:** [A46]–[A48].
- **D16. Observability and recovery.**
  - Sentry for API and web (or self-hosted GlitchTip if US-stored account data is a problem [A73]).
  - OpenTelemetry Express auto-instrumentation and pino JSON logs.
  - Uptime Kuma off-platform with a status page.
  - PITR plus nightly encrypted dumps to a separate bucket, and a quarterly restore drill.
  - Public SLA no higher than 99.9% [A72].
- **D17. Supply-chain hygiene.**
  - Frozen lockfile; a 3-day release-age delay; lifecycle scripts only for allowlisted packages (`onlyBuiltDependencies`).
  - Dependabot weekly; `pnpm audit --prod` in CI.
  - CI tokens read-only; 2FA on GitHub, npm, the host, Stripe and Meta.
  - A credential-rotation runbook.
  - **Why:** [A61]–[A64].
- **D18. Enterprise features on demand.**
  - OIDC/SAML SSO and SCIM through self-hosted Ory Polis, sold on the Enterprise tier.
  - Org API keys, signed webhooks, audit export.
  - **Why:** [A28][A59][A60]; price-sensitive market.
  - **Rejected:** WorkOS ($125 per connection).
- **D19. Compliance pack.**
  - DPA with Cameroon transfer clauses; public subprocessor list; processing register.
  - Breach runbook ("immediately"); per-tenant export and erasure; consent records for guest phone numbers.
  - A tender-ready security questionnaire answer set.
  - If the company is in the EU, add GDPR Art 28 and Data Act switching.
  - ISO 27001-aligned policies, without certification until a buyer asks.
  - **Why:** [B1]–[B4], [A77]–[A79].

**PRD amendments:**

- §1.3 non-goals: SLA engine, SMS and push, and billing move into scope.
- §2.1: the field surface is the PWA.
- §6.3: Incident description becomes optional, and a guest reporter is allowed.
- J5: no organization switcher for intervenants.
- §11 decision 3: maps use self-hosted Protomaps.

---

## 4. Interfaces per role

**Rules shared by every surface:**

- The design system's near-monochrome look, ink primary actions, Inter, and the Thread as signature.
- No coloured KPI cards, gradients or illustrations.
- One primary action per view.
- FR first in examples (EN is complete in i18n).
- Phone screens are designed at 360 px wide.

### 4.1 Employee: report in 30 seconds

**Who:**

- Who: cashier, bank teller, housekeeper, guard.
- How often: a few times a month.
- Device: mid- or low-end Android, WhatsApp-native, may have no work email.

**Responsibilities:** say what and where with evidence, answer questions, confirm the fix.

**Entry points:**

- a QR sticker on the site or area
- the installed app icon
- a WhatsApp link (invitation or update)

**Tabs:** Signaler · Mes signalements · Profil. Notifications merge into Mes signalements, and alerts arrive by WhatsApp and push.

```
┌──────────────────────────────────────┐
│ Northwind Facilities                 │
│ Signaler un problème                 │
│ ┌──────────────────────────────────┐ │
│ │ Agence Akwa, Douala · Hall       │ │ location prefilled (QR, home site, last site)
│ │ via QR code              Changer │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │          [appareil photo]        │ │ 3:2 tile, opens the camera
│ │          Ajouter une photo       │ │
│ └──────────────────────────────────┘ │
│ Que se passe-t-il ?                  │
│ (Fuite d'eau) (Électricité) (Clim)   │ top 5 categories as 48 px chips
│ (Porte, serrure) (Autre)             │
│ [ Ex. : l'eau coule du plafond    ]  │ one sentence = title (3-120)
│ + Ajouter des détails                │ optional description
│ [            Envoyer             ]   │ 56 px ink button
├──────────────────────────────────────┤
│  Signaler   Mes signalements  Profil │
└──────────────────────────────────────┘
```

**After sending:**

- Online: "Signalement envoyé · INC-2026-00042. Un superviseur va le prendre en charge. Vous serez prévenu sur WhatsApp."
- Offline: "Enregistré sur le téléphone. Il partira dès que le réseau revient." The header chip reads "1 en attente".

**Mes signalements:** parcel-style tracking.

- Each card shows a milestone rail: Signalé · Pris en charge · En cours · Réglé · Clôturé.
- When the incident is RESOLVED, the card shows "Est-ce réglé ? [Oui, c'est réglé] [Toujours un problème]".
- Public comment box while the incident is open.

**Removed friction:**

- no password
- one screen instead of three
- location never typed when a QR code or home site exists
- description optional

**Anti-goals:** a long form, a category dropdown, asking for priority up front, account creation for guests.

### 4.2 Visitor through a QR code (guest)

Only on sites where a supervisor enabled it.

```
┌──────────────────────────────────────┐
│ Northwind Facilities                 │
│ Signaler un problème                 │
│ Agence Akwa, Douala · Hall           │
│ [ photo ]                            │
│ Que se passe-t-il ? [ une phrase ]   │
│ Votre numéro WhatsApp (facultatif)   │
│ [ +237 6__ __ __ __ ]                │
│ Pour être prévenu quand c'est réglé. │
│ [ Envoyer ]                          │
│ Données : finalité et durée (lien)   │
└──────────────────────────────────────┘
```

**Result:** a reference plus a tracking link (`/t/:token`, status milestones only). With a number, the visitor also gets WhatsApp updates.

**For supervisors:** the incident shows a "Visiteur" badge and a one-key Spam dismissal.

### 4.3 Intervenant: Mon travail

**Who:** internal technician or contractor serving several clients; on the move, gloves, sun, intermittent network, Android.

**Responsibilities:** answer fast, get to the site, keep people informed, resolve with proof, handle send-backs.

**Tabs:** Mon travail · Historique · Notifications · Profil. There is no organization switcher.

```
┌──────────────────────────────────────┐
│ Mon travail                [cloche]2 │
│ ● Disponible ▾          1 en attente │ availability applies to every client; offline queue chip
├──────────────────────────────────────┤
│ À accepter · 2                       │
│ ┌──────────────────────────────────┐ │
│ │ ▮▮▮ Haute · INC-2026-00042       │ │
│ │ Fuite d'eau, plafond du hall     │ │
│ │ Agence Akwa, Douala · 3,2 km     │ │
│ │ [N] Northwind · Répondre avant 14:30 │ client chip + SLA
│ │ [     Accepter     ]   [ ··· ]   │ │ inline 48 px; Refuser in the menu
│ └──────────────────────────────────┘ │
│ En cours · 3                         │
│ │ ▮▮ Moyenne · INC-2026-00031 [A] Atlas │
│ │ Climatiseur salle serveurs       │ │
│ │ Sur place depuis 40 min          │ │
│ En attente de validation · 1         │
├──────────────────────────────────────┤
│ Mon travail Historique Notifs Profil │
└──────────────────────────────────────┘
```

**Case file:**

- Header: client chip, title, priority, status.
- Place card: site, area and landmark ("face pharmacie du Port"), plus [Itinéraire] (opens Google Maps or Waze at the site pin) and [Appeler le site] (if the org allows it).
- The Thread below.
- A fixed bottom primary action that follows the state: Accepter → Je suis sur place (stamps time and GPS accuracy) → Terminer.

**Resolve sheet:** "Ce qui a été fait" (required), then the after photo (required when the org says so), then [Envoyer pour validation]. It works offline.

**Historique:** every client together, with org filter chips (Tous · Northwind · Atlas).

**Removed friction:**

- no organization switch
- accept from the list
- one global availability
- WhatsApp alert with a deep link

### 4.4 Supervisor console (locked: additive changes only)

| Addition                                                                 | Where it appears                             | Phase |
| ------------------------------------------------------------------------ | -------------------------------------------- | ----- |
| SLA chip (amber within 15 min, red when breached), "Breaching soon" view | Inbox rows, case file header, built-in views | 4     |
| "Visiteur" badge, Spam dismiss reason                                    | Inbox, case file                             | 2     |
| Reporter confirmation chip ("Confirmé réglé" / "Toujours un problème")   | Awaiting review rows, case file              | 4     |
| GPS pin, landmark, areas, printable QR sheet (A4, one code per area)     | Sites                                        | 2     |
| Map of open incidents                                                    | New nav item, lazy loaded                    | 4     |
| Breach escalations, daily digest                                         | Notifications, email                         | 4     |

**Owner settings tabs:** Organisation (exists), Abonnement, Sécurité, Notifications, Données, Accès support.

- Abonnement: plan, sites, invoices, payment method.
- Sécurité: required 2FA, sessions, SSO on Enterprise.
- Notifications: WhatsApp budget, events.
- Données: export, deletion.
- Accès support: grant, revoke, log.

### 4.5 Platform admin: Control room (desktop, the platform shell)

**Responsibilities:**

- keep organizations healthy
- convert trials
- recover payments
- handle abuse, support, export and deletion requests
- watch the system

It never shows incident content.

**Nav:** Vue d'ensemble · Organisations · Inscriptions · Facturation · Messagerie · Accès support · Données · Système · Annonces · Journal.

```
┌────────────┬────────────────────────────────────────────────────────────────┐
│ Sentinel   │ Vue d'ensemble                                                 │
│ [Platform] │ 42 organisations actives · 6 essais finissent sous 7 j         │
│            │ 2 paiements en retard · 3 inscriptions en attente              │
│ ...nav...  │                                                                │
│            │ À traiter (5)                                                  │
│            │ ▲ Paiement échoué        Hôtel Akwa Palace   il y a 2 j  Ouvrir │
│            │ ● Inscription suspecte   test@gmail          il y a 3 h  Ouvrir │
│            │ ● Export demandé         Brasseries du Nord  il y a 1 j  Ouvrir │
│            │ ▲ 12 tâches en échec     email.send          il y a 20 min Voir │
│            │                                                                │
│            │ Activation (30 j) : inscrits 18 → vérifiés 15 → 1er site 12 →   │
│            │ 1re invitation 10 → 1er incident 8 → 1re clôture 6              │
└────────────┴────────────────────────────────────────────────────────────────┘
```

**Organisations table columns:**

- Nom, Statut, Offre, Sites (used/limit), Membres actifs 30 j, Incidents/mois, Dernière activité.
- Santé: Bonne / À surveiller / À risque, as glyph plus text, computed from setup completion, 7-day activity and billing state.

**Organization detail tabs:**

- Aperçu: owner contact, lifecycle timeline, counts.
- Facturation: Stripe or aggregator status, invoices, extend trial, change plan, mark a transfer as paid.
- Droits: entitlement overrides.
- Messagerie: WhatsApp and SMS spend.
- Support: grants and past sessions.
- Données: export and deletion schedule.
- Journal.

**Lifecycle actions:**

- suspend or reactivate (with a reason)
- extend trial
- schedule deletion
- open as support, only during a valid grant

Every action asks for a reason and writes a PlatformAuditEvent.

---

## 5. Target architecture

### 5.1 System context

```
 Employees, intervenants, visitors (Android/iOS browsers, installed PWA: service worker, IndexedDB queue, push)
 Supervisors, owners (desktop)                 Platform admin (TOTP)
                     │ HTTPS (cookie session; SSE)            │
              CDN + reverse proxy (TLS, static web, /api)
                     │
        Sentinel API, Node 24 / Express 5, 1..N instances (stateless)
   ┌────────────┬─────────────┬──────────────┬───────────────┬────────────────┐
 PostgreSQL 16   pg-boss jobs   S3 bucket      Email (SPF/DKIM/   WhatsApp Cloud API, Twilio Verify/SMS,
 (data, RLS,     (same DB)      (photos,       DMARC subdomain)   Web Push (VAPID), Stripe + Flutterwave
 sessions)                      exports)                          webhooks, Sentry, Uptime Kuma
```

### 5.2 Backend modules

**New:**

- `jobs/` (boss.ts, queues)
- `auth/phone.ts` (OTP)
- `lib/messaging/{whatsapp,sms}.ts`
- `lib/push.ts`
- `lib/storage.ts` (S3 adapter, same put/read/remove interface)
- `modules/public-reports.ts` (QR and guest)
- `modules/sla.ts`
- `modules/billing/{stripe,aggregator,webhooks}.ts`
- `modules/support-access.ts`
- `modules/data-lifecycle.ts` (export, deletion)

**Split:** `modules/platform.ts` becomes `platform/{overview,organizations,billing,messaging,system}.ts`.

**Changed:**

- `modules/me.ts` (cross-org reads)
- `modules/events.ts` (`openStream`)
- `modules/notifications.ts` (recipient-set helpers)
- `incidents/service.ts` (scope parameter, SLA fields, guest reporter)

### 5.3 Data model changes (Prisma plus `prisma/sql`)

| Model                                          | Change                                                                                                                                                                                                                                                                                   | Constraint or invariant                                                   | Phase |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----- |
| User                                           | `email` nullable, `phone` (E.164) unique nullable, `phoneVerifiedAt`                                                                                                                                                                                                                     | CHECK email or phone present                                              | 2     |
| PhoneChallenge (new)                           | phone, purpose, codeHash, attempts, expiresAt, consumedAt, ip, channel                                                                                                                                                                                                                   | Index on (phone, createdAt)                                               | 2     |
| Invitation                                     | `email` nullable, `phone`                                                                                                                                                                                                                                                                | CHECK one present                                                         | 2     |
| Session                                        | `kind` (CONSOLE, FIELD, PLATFORM), `absoluteExpiresAt`                                                                                                                                                                                                                                   |                                                                           | 2     |
| Site                                           | latitude, longitude, radiusMeters, landmark, guestReporting                                                                                                                                                                                                                              |                                                                           | 2     |
| SiteArea (new)                                 | organizationId, siteId, name, code, publicToken, isActive                                                                                                                                                                                                                                | Composite FK to Site; publicToken unique                                  | 2     |
| Incident                                       | `areaId?`; `reporterMembershipId` nullable plus guestName/guestPhone/trackingTokenHash; `channel` (APP, QR_GUEST, SUPERVISOR, WHATSAPP); `description` optional; `respondDueAt`, `resolveDueAt`, `respondBreachedAt`, `resolveBreachedAt`; `reporterConfirmation`, `reporterConfirmedAt` | CHECK reporter membership or guest; extend the I5 trigger to guest fields | 2, 4  |
| DismissReason                                  | add SPAM                                                                                                                                                                                                                                                                                 |                                                                           | 2     |
| ProgressUpdate                                 | latitude, longitude, accuracyMeters (ON_SITE)                                                                                                                                                                                                                                            |                                                                           | 2     |
| SlaPolicy (new)                                | organizationId, priority, respondMinutes, resolveMinutes                                                                                                                                                                                                                                 | unique (org, priority)                                                    | 4     |
| Organization                                   | businessHours JSON; billing fields (billingProvider, stripeCustomerId, subscriptionStatus, currentPeriodEnd, siteQuantity); entitlementOverrides JSON; whatsappMonthlyBudget; deletionRequestedAt, deletionScheduledFor                                                                  |                                                                           | 4, 5  |
| PushSubscription (new)                         | userId, endpoint unique, keys, lastSuccessAt                                                                                                                                                                                                                                             |                                                                           | 2     |
| NotificationPreference (new)                   | membershipId, channel, enabled                                                                                                                                                                                                                                                           |                                                                           | 2     |
| OutboundMessage (new)                          | organizationId?, channel, template, toMasked, status, providerId, costMicros, error                                                                                                                                                                                                      | Spend and debugging                                                       | 2     |
| Payment (new)                                  | organizationId, provider, providerRef unique, amount, currency, status, periodStart, periodEnd                                                                                                                                                                                           | Idempotent webhooks                                                       | 5     |
| SupportAccessGrant (new)                       | organizationId, grantedByMembershipId, reason, expiresAt, revokedAt                                                                                                                                                                                                                      |                                                                           | 5     |
| DataExport (new)                               | organizationId, requestedBy, status, objectKey, expiresAt                                                                                                                                                                                                                                |                                                                           | 5     |
| PlatformAnnouncement (new)                     | fr, en, severity, startsAt, endsAt                                                                                                                                                                                                                                                       |                                                                           | 5     |
| ApiKey, WebhookEndpoint, WebhookDelivery (new) | Hashed keys, HMAC secret, retries                                                                                                                                                                                                                                                        |                                                                           | 6     |
| AuditEventType / PlatformEventType             | add SUPPORT_ACCESS__, BILLING__, EXPORT__, DELETION__, SITE_AREA_*, SLA_BREACHED                                                                                                                                                                                                         | Append-only (I7)                                                          | 2–5   |

**Rules for every new tenant table:**

- `organizationId` plus composite foreign keys (I1)
- an RLS policy (Phase 3 onward)
- an adversarial test

### 5.4 API additions

- **Me:**
  - `/me/notifications`, plus `/unread-count`, `/read-all`, `/:id/read`
  - `/me/incidents`, `/me/events`, `PATCH /me/availability`
  - `POST /me/push-subscriptions`, `GET/PATCH /me/notification-preferences`
- **Auth:** `POST /auth/phone/start`, `POST /auth/phone/verify`, `POST /auth/mfa/totp/*`, WebAuthn routes (Phase 3).
- **Public:**
  - `GET /public/sites/:token` (QR landing data)
  - `POST /public/sites/:token/reports`
  - `GET /public/tracking/:token`
  - `POST /public/tracking/:token/confirmation`
- **Tenant:**
  - `/sites/:id/areas` CRUD, `GET /sites/:id/qr-sheet`
  - `/sla-policies`, `POST /incidents/:id/confirmation`
  - `/billing/checkout`, `/billing/portal`, `/billing/invoices`
  - `/support-grants`, `/data-exports`, `POST /organization/deletion`
- **Webhooks:** `/webhooks/stripe`, `/webhooks/flutterwave`, `/webhooks/whatsapp` (signature verified, idempotent).
- **Platform:** `/platform/overview`, organization billing, entitlements, messaging and support, `/platform/system`, `/platform/announcements`.

### 5.5 Frontend structure

**Routes:**

- `/r/:token` (QR landing)
- `/t/:token` (tracking)
- `/field/incidents/$reference?org=`
- `/app/settings/{billing,security,notifications,data,support}`
- `/app/map`
- `/platform/{overview,billing,messaging,support,system,announcements}`

**Query keys:**

- Person scope lives under `['me', ...]` and survives organization switches.
- Tenant keys are reset on switch.
- On sign-out, everything is removed and the root `me` query is set to null (never `clear()`; see Task 0.1).

**Offline:**

- `lib/offline-queue.ts` (IndexedDB, one store per user)
- `lib/sync.ts`: replays on `online`, on focus and through Background Sync, with an Idempotency-Key per action.

**PWA:** vite-plugin-pwa generateSW; manifest per role start_url; update toast.

### 5.6 Coherence rules (checked in review)

1. Every request and response schema lives in `packages/shared` and is used by both API and web.
2. Every new state or transition goes into the shared state machine plus `domain.test.ts`.
3. Every event gets an audit type, a notification-matrix row and a live event.
4. Every user-visible string exists in FR and EN; the type check fails on a missing key.
5. Every migration is reviewed for `DROP` against `prisma/sql` objects. The CI grep exists; extend it to RLS policies.
6. Every external webhook is signature-verified and idempotent on the provider's event id.
7. Every job is idempotent and retried with backoff, and failures are visible in Platform › Système.

---

## 6. Roadmap

Estimated effort for one developer, in weeks:

| Phase                                             | Effort    |
| ------------------------------------------------- | --------- |
| P0                                                | 0.5       |
| P1                                                | 3–4       |
| P2                                                | 5–6       |
| P3                                                | 2–3       |
| **Pilot gate:** 2–3 organizations on a free trial |           |
| P4                                                | 3–4       |
| P5                                                | 4–5       |
| P7                                                | 2         |
| **Paid launch**                                   |           |
| P6                                                | On demand |

Each phase:

- ends with green `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm --filter @sentinel/web e2e`
- runs on its own branch `feature/V2-P<n>-<slug>`
- gets a review (ecc:typescript-reviewer or react-reviewer, plus ecc:security-reviewer on auth, input or payments) and owner approval before merge

### Phase 0: Stabilize (bite-sized TDD)

**Exit:** the three reported problems are fixed, each with a regression test that fails before the fix.

#### Task 0.1: Signing in as someone else shows that person without a reload

**Root cause, verified in code:**

1. `signOut()` (`apps/web/src/app/session.tsx:102-109`) calls `queryClient.clear()`.
2. That removes the `['me']` query that `SessionProvider` observes. TanStack Query does not notify an observer when its query is removed.
3. `setQueryData(meQueryKey, null)` then builds a new, unobserved query.
4. `SessionProvider` sits above `RouterProvider` (`main.tsx:31-33`), so navigation never re-renders it, and it keeps returning the previous person.
5. `signedIn(next)` writes into the orphan query. `HomeRedirect` and `useShellGate` read the stale `me`, so the previous person's shell renders while requests carry the new cookie.

The e2e helpers always reload (`e2e/auth-roles.spec.ts:25-36`), so this path was never tested.

**Files:**

- Modify: `apps/web/src/app/session.tsx`
- Modify: `apps/web/src/app/shells/shared.tsx` (UserMenu, UserMenuSignOut)
- Modify: `apps/web/src/features/account/account-page.tsx:256-294`
- Create: `apps/web/e2e/session-switch.spec.ts`

**Produces:** `useSignOut(): () => Promise<void>` from `app/session.tsx`.

- [ ] **Step 1: write the failing test**

```ts
// apps/web/e2e/session-switch.spec.ts
import { expect, test, type Page } from '@playwright/test';

// Seeded database required (pnpm db:reset). After the first goto, everything happens in the app: no reloads.
const password = 'sentinel-demo';

async function signInHere(page: Page, email: string) {
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('supervisor then employee in the same tab: the employee gets the field app', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/login');
  await signInHere(page, 'claire@northwind.test');
  await expect(page).toHaveURL(/\/app\/incidents/);

  await page.getByRole('button', { name: /Claire/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await signInHere(page, 'lea@northwind.test');
  await expect(page).toHaveURL(/\/field\/report/);
  await page.getByRole('link', { name: 'Profile' }).click();
  await expect(page.locator('input[value="lea@northwind.test"]')).toBeVisible();
});

test('employee then supervisor in the same tab: the supervisor gets the console', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/login');
  await signInHere(page, 'lea@northwind.test');
  await expect(page).toHaveURL(/\/field\/report/);

  await page.getByRole('link', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await signInHere(page, 'claire@northwind.test');
  await expect(page).toHaveURL(/\/app\/incidents/);
  await expect(page.getByRole('button', { name: /Claire/ })).toBeVisible();
});

test('another tab follows a sign-out', async ({ context }) => {
  await context.clearCookies();
  const first = await context.newPage();
  await first.goto('/login');
  await signInHere(first, 'claire@northwind.test');
  await expect(first).toHaveURL(/\/app\/incidents/);
  const second = await context.newPage();
  await second.goto('/app/incidents');

  await first.getByRole('button', { name: /Claire/ }).click();
  await first.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(second).toHaveURL(/\/login/);
});
```

- [ ] **Step 2: run it and see it fail**

  `pnpm --filter @sentinel/web exec playwright test e2e/session-switch.spec.ts`

  Expected: FAIL. The first test stays on `/app/incidents` after Léa signs in.

- [ ] **Step 3: fix sign-out at the source, and add the tab sync and the leave-first hook**

```ts
// apps/web/src/app/session.tsx (additions and replacements)
import { useNavigate } from '@tanstack/react-router';

const sessionChannel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('sentinel.session');

// inside SessionProvider:
useEffect(() => {
  if (!sessionChannel) return;
  // Another tab signed in or out: this tab must not keep acting as the previous person.
  const reload = () => window.location.reload();
  sessionChannel.addEventListener('message', reload);
  return () => sessionChannel.removeEventListener('message', reload);
}, []);

const signedIn = useCallback(
  async (next: Me) => {
    void queryClient.cancelQueries({ queryKey: meQueryKey }, { revert: false });
    resetTenantCache(queryClient);
    queryClient.setQueryData(meQueryKey, next);
    sessionChannel?.postMessage('changed');
    await new Promise((resolve) => setTimeout(resolve, 0));
  },
  [queryClient],
);

const signOut = useCallback(async () => {
  try {
    await api.post('/auth/logout');
  } finally {
    // Not queryClient.clear(): it removes the ['me'] query this provider observes without telling it,
    // so the previous person stays on screen until a reload.
    resetTenantCache(queryClient);
    queryClient.getMutationCache().clear();
    queryClient.setQueryData(meQueryKey, null);
    sessionChannel?.postMessage('changed');
  }
}, [queryClient]);

/** Sign-out from inside a shell: leave first, so the shell gate never adds ?redirect= to the previous person's page. */
export function useSignOut() {
  const { signOut } = useSession();
  const navigate = useNavigate();
  return useCallback(async () => {
    await navigate({ to: '/login', replace: true });
    await signOut();
  }, [navigate, signOut]);
}
```

Then wire the hook into the three call sites:

- `shared.tsx` UserMenu: replace `const { me, signOut } = useSession()` with `const { me } = useSession(); const signOutHere = useSignOut();` and use `onSelect={() => void signOutHere()}`. Remove the navigate call.
- `shared.tsx` UserMenuSignOut: `onClick={() => void signOutHere()}`.
- `account-page.tsx`: `const signOutHere = useSignOut();` and the button's `onClick={() => void signOutHere()}`.

- [ ] **Step 4: run it and see it pass.** Same command. Expected: 3 passed.

- [ ] **Step 5: run the regression checks.** `pnpm --filter @sentinel/web typecheck && pnpm --filter @sentinel/web exec playwright test e2e/auth-roles.spec.ts` must pass.

- [ ] **Step 6: commit.** `fix(web): show the new person after switching account`

#### Task 0.2: Pages never scroll the document under the console

**Root cause:**

- The console `<main>` (`console-shell.tsx:248`) and the platform `<main>` (`platform-shell.tsx:53`) scroll (`overflow-y-auto`), but neither is positioned.
- Absolutely positioned descendants therefore take the initial containing block: `sr-only` table captions and labels (`dashboard/tables.tsx:50`, `trend-chart.tsx:286`, `team/member-table.tsx:199` and others) and Radix hidden inputs.
- Those elements extend the document below the `h-dvh` shell. At the end of the panel, scroll chaining moves the whole app up and shows the empty canvas.
- `Panel`, `Page` and `Table` are not positioned either.

**Files:**

- Modify: `console-shell.tsx:248`
- Modify: `platform-shell.tsx:53`
- Create: `apps/web/e2e/layout.spec.ts`

- [ ] **Step 1: confirm in the browser.** On `/app/team` or `/app/dashboard`, run `document.documentElement.scrollHeight - innerHeight` in DevTools. Expected: greater than 0. Then list the offenders:

```js
[...document.querySelectorAll('body *')].filter(
  (e) => getComputedStyle(e).position === 'absolute' && e.getBoundingClientRect().bottom > innerHeight,
);
```

- [ ] **Step 2: write the failing test**

```ts
// apps/web/e2e/layout.spec.ts
import { expect, test } from '@playwright/test';

test('console pages scroll inside the content panel, never the document', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Work email').fill('claire@northwind.test');
  await page.getByLabel('Password', { exact: true }).fill('sentinel-demo');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/app\/incidents/);

  for (const path of [
    '/app/incidents',
    '/app/dashboard',
    '/app/team',
    '/app/sites',
    '/app/categories',
    '/app/audit',
    '/app/settings',
  ]) {
    await page.goto(path);
    const main = page.locator('#main');
    await main.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await main.hover();
    await page.mouse.wheel(0, 3000);
    const leak = await page.evaluate(() => ({
      extra: document.documentElement.scrollHeight - window.innerHeight,
      scrolled: window.scrollY,
    }));
    expect(leak, path).toEqual({ extra: 0, scrolled: 0 });
  }
});
```

- [ ] **Step 3: run it and see it fail.** `pnpm --filter @sentinel/web exec playwright test e2e/layout.spec.ts`. Expected: FAIL on at least one long page, with `extra > 0`.

- [ ] **Step 4: fix both panels.**
  - Console: `'relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface'`
  - Platform: add `relative overscroll-contain` to the `<main>` className.

  `relative` contains the absolute descendants; `overscroll-contain` stops the chaining.

- [ ] **Step 5: run it and see it pass.** Same command.

- [ ] **Step 6: commit.** `fix(web): keep console scrolling inside the panel`

#### Task 0.3: Cross-organization reads for the person (API)

**Files:**

- Modify: `apps/api/src/auth/context.ts`
- Modify: `apps/api/src/modules/notifications.ts`
- Modify: `apps/api/src/modules/incidents/service.ts:336`
- Modify: `apps/api/src/modules/incidents/routes.ts:57`
- Modify: `apps/api/src/modules/events.ts`
- Modify: `apps/api/src/modules/me.ts`
- Create: `apps/api/test/me-cross-org.test.ts`

**Produces:**

- `activeMemberships(userId): Promise<{ id; organizationId; role }[]>`
- `listNotifications(recipients, query)`, `unreadCount(recipients)`, `markAllRead(recipients)`, `markRead(recipients, id)`
- `listIncidents(scope: Prisma.IncidentWhereInput, query)`
- `openStream(res, userId, accepts)`
- Routes: `GET /v1/me/notifications`, `GET /v1/me/notifications/unread-count`, `POST /v1/me/notifications/read-all`, `POST /v1/me/notifications/:id/read`, `GET /v1/me/incidents`, `PATCH /v1/me/availability`, `GET /v1/me/events`

- [ ] **Step 1: write the failing test**

```ts
// apps/api/test/me-cross-org.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { addMember, createOrg, prisma, reportIncident, resetDb, signIn } from './helpers';

type Ctx = Awaited<ReturnType<typeof setup>>;
let ctx: Ctx;

async function setup() {
  const a = await createOrg('Northwind');
  const b = await createOrg('Atlas');
  const employeeA = await addMember(a.org.id, 'REPORTER');
  const employeeB = await addMember(b.org.id, 'REPORTER');
  const karim = await addMember(a.org.id, 'INTERVENANT', { names: ['Karim', 'Benali'], siteIds: [a.site.id] });
  const karimInB = await addMember(b.org.id, 'INTERVENANT', { userId: karim.user.id, siteIds: [b.site.id] });
  const [supA, supB, repA, repB] = await Promise.all([
    signIn(a.owner.user.email, a.org.id),
    signIn(b.owner.user.email, b.org.id),
    signIn(employeeA.user.email, a.org.id),
    signIn(employeeB.user.email, b.org.id),
  ]);
  const incA = await reportIncident(repA, a.site.id, a.category.id);
  const incB = await reportIncident(repB, b.site.id, b.category.id);
  await supA
    .post(`/incidents/${incA.id}/assign`, {
      expectedVersion: incA.version,
      intervenantMembershipId: karim.membership.id,
      priority: 'HIGH',
    })
    .expect(200);
  await supB
    .post(`/incidents/${incB.id}/assign`, {
      expectedVersion: incB.version,
      intervenantMembershipId: karimInB.membership.id,
      priority: 'HIGH',
    })
    .expect(200);
  const karimClient = await signIn(karim.user.email, null);
  return { a, b, karim, karimInB, incA, incB, karimClient, supA };
}

const orgsOf = (rows: { organization: { id: string } }[]) => new Set(rows.map((r) => r.organization.id));

describe('a person working for two organizations, without X-Org-Id', () => {
  beforeAll(async () => {
    await resetDb();
    ctx = await setup();
  });

  it('lists notifications from both organizations', async () => {
    const res = await ctx.karimClient.get('/me/notifications').expect(200);
    expect(orgsOf(res.body.data)).toEqual(new Set([ctx.a.org.id, ctx.b.org.id]));
  });

  it('counts unread across organizations and marks one read', async () => {
    const before = (await ctx.karimClient.get('/me/notifications/unread-count').expect(200)).body.data.count;
    expect(before).toBeGreaterThanOrEqual(2);
    const first = (await ctx.karimClient.get('/me/notifications?limit=1').expect(200)).body.data[0];
    await ctx.karimClient.post(`/me/notifications/${first.id}/read`).expect(204);
    const after = (await ctx.karimClient.get('/me/notifications/unread-count').expect(200)).body.data.count;
    expect(after).toBe(before - 1);
  });

  it('lists the incidents worked in both organizations', async () => {
    const res = await ctx.karimClient.get('/me/incidents?sort=updated').expect(200);
    expect(res.body.data.map((i: { id: string }) => i.id).sort()).toEqual([ctx.incA.id, ctx.incB.id].sort());
  });

  it('sets availability everywhere at once', async () => {
    await ctx.karimClient.patch('/me/availability', { availability: 'BUSY' }).expect(204);
    const profiles = await prisma.intervenantProfile.findMany({ where: { membership: { userId: ctx.karim.user.id } } });
    expect(profiles.map((p) => p.availability)).toEqual(['BUSY', 'BUSY']);
  });

  it("never returns another person's notifications", async () => {
    const mine = (await ctx.karimClient.get('/me/notifications').expect(200)).body.data.map(
      (n: { id: string }) => n.id,
    );
    const theirs = (await ctx.supA.as(null).get('/me/notifications').expect(200)).body.data.map(
      (n: { id: string }) => n.id,
    );
    expect(mine.filter((id: string) => theirs.includes(id))).toEqual([]);
  });

  it('drops an organization from every list once the membership is revoked', async () => {
    await prisma.membership.update({ where: { id: ctx.karimInB.membership.id }, data: { status: 'REVOKED' } });
    expect(orgsOf((await ctx.karimClient.get('/me/notifications').expect(200)).body.data)).toEqual(
      new Set([ctx.a.org.id]),
    );
    const incidents = (await ctx.karimClient.get('/me/incidents').expect(200)).body.data;
    expect(incidents.map((i: { id: string }) => i.id)).toEqual([ctx.incA.id]);
  });
});
```

- [ ] **Step 2: run it and see it fail.**

  `pnpm --filter @sentinel/api exec vitest run test/me-cross-org.test.ts`

  Expected: FAIL with 404 on `/me/notifications`.

- [ ] **Step 3: implement**

```ts
// apps/api/src/auth/context.ts
/** ACTIVE memberships in ACTIVE organizations: the whole scope of the cross-organization /me reads. */
export function activeMemberships(userId: string) {
  return prisma.membership.findMany({
    where: { userId, status: 'ACTIVE', organization: { status: 'ACTIVE' } },
    select: { id: true, organizationId: true, role: true },
    orderBy: { joinedAt: 'asc' },
  });
}
```

```ts
// apps/api/src/modules/notifications.ts (the existing routes now call these helpers)
export const notificationQuery = cursorQuery.extend({ unread: z.enum(['true', 'false']).optional() });
type Recipient = { id: string; organizationId: string };

/** Only ever called with the caller's own memberships: one on tenant routes, all of them on /me. */
const addressedTo = (recipients: Recipient[]): Prisma.NotificationWhereInput => ({
  organizationId: { in: recipients.map((r) => r.organizationId) },
  recipientMembershipId: { in: recipients.map((r) => r.id) },
});

export async function listNotifications(
  recipients: Recipient[],
  { cursor, limit, unread }: z.infer<typeof notificationQuery>,
) {
  const after = decodeCursor(cursor);
  const rows = await prisma.notification.findMany({
    where: {
      ...addressedTo(recipients),
      ...(unread === 'true' ? { readAt: null } : {}),
      ...(after
        ? {
            OR: [
              { createdAt: { lt: new Date(String(after[0])) } },
              { createdAt: new Date(String(after[0])), id: { lt: String(after[1]) } },
            ],
          }
        : {}),
    },
    include: {
      organization: { select: { id: true, displayName: true } },
      incident: { select: { id: true, reference: true, title: true } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });
  const result = page(rows, limit, (row) => [row.createdAt.toISOString(), row.id]);
  const data: NotificationDTO[] = result.data.map((row) => ({
    id: row.id,
    type: row.type,
    organization: row.organization,
    incident: row.incident,
    actorName: row.actorName,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
  return { data, page: result.page };
}

export const unreadCount = (r: Recipient[]) =>
  prisma.notification.count({ where: { ...addressedTo(r), readAt: null } });
export const markAllRead = (r: Recipient[]) =>
  prisma.notification.updateMany({ where: { ...addressedTo(r), readAt: null }, data: { readAt: new Date() } });
export async function markRead(r: Recipient[], id: string) {
  const { count } = await prisma.notification.updateMany({
    where: { ...addressedTo(r), id },
    data: { readAt: new Date() },
  });
  if (count === 0) throw notFound('Notification');
}

const own = (req: Request): Recipient[] => {
  const t = tenantOf(req);
  return [{ id: t.membershipId, organizationId: t.orgId }];
};
notificationRoutes.get('/', async (req, res) => {
  res.json(await listNotifications(own(req), parse(notificationQuery, req.query)));
});
notificationRoutes.get('/unread-count', async (req, res) => {
  res.json({ data: { count: await unreadCount(own(req)) } });
});
notificationRoutes.post('/read-all', async (req, res) => {
  await markAllRead(own(req));
  res.status(204).end();
});
notificationRoutes.post('/:id/read', async (req, res) => {
  await markRead(own(req), parseId(req.params.id, 'Notification'));
  res.status(204).end();
});
```

Then the other three source changes:

- **`incidents/service.ts`:** `export async function listIncidents(scope: Prisma.IncidentWhereInput, query: ListIncidentsQuery)`, with `incidentScope(tenant)` replaced by `scope` in its `AND`.
- **`incidents/routes.ts:57`:** `listIncidents(incidentScope(tenantOf(req)), parse(listIncidentsQuery, req.query))`.
- **`events.ts`:** move the body of the existing GET handler into `export function openStream(res: Response, userId: string, accepts: (e: LiveEvent) => boolean)`. The tenant route becomes `openStream(res, tenant.userId, (e) => e.orgId === tenant.orgId && e.recipients.includes(tenant.membershipId))`.

```ts
// apps/api/src/modules/me.ts (additions)
meRoutes.get('/notifications', async (req, res) => {
  res.json(await listNotifications(await activeMemberships(authOf(req).user.id), parse(notificationQuery, req.query)));
});
meRoutes.get('/notifications/unread-count', async (req, res) => {
  res.json({ data: { count: await unreadCount(await activeMemberships(authOf(req).user.id)) } });
});
meRoutes.post('/notifications/read-all', async (req, res) => {
  await markAllRead(await activeMemberships(authOf(req).user.id));
  res.status(204).end();
});
meRoutes.post('/notifications/:id/read', async (req, res) => {
  await markRead(await activeMemberships(authOf(req).user.id), parseId(req.params.id, 'Notification'));
  res.status(204).end();
});

/** History across organizations: the union of each membership's own read scope. */
meRoutes.get('/incidents', async (req, res) => {
  const { user } = authOf(req);
  const tenants = await Promise.all(
    (await activeMemberships(user.id)).map((m) => resolveTenant(user, m.organizationId)),
  );
  const scope = tenants.length ? { OR: tenants.map(incidentScope) } : { id: { in: [] as string[] } };
  res.json(await listIncidents(scope, parse(listIncidentsQuery, req.query)));
});

meRoutes.patch('/availability', async (req, res) => {
  const { user } = authOf(req);
  const { availability } = parse(availabilitySchema, req.body);
  for (const m of await activeMemberships(user.id)) {
    if (m.role === 'INTERVENANT') await setAvailability(await resolveTenant(user, m.organizationId), availability);
  }
  res.status(204).end();
});

meRoutes.get('/events', async (req, res) => {
  const { user } = authOf(req);
  const mine = new Set((await activeMemberships(user.id)).map((m) => m.id));
  openStream(res, user.id, (event) => event.recipients.some((id) => mine.has(id)));
});
```

- [ ] **Step 4: run it and see it pass.** Then run the whole API suite: `pnpm --filter @sentinel/api test`. Existing notifications and events tests must still pass.

- [ ] **Step 5: add an SSE test.** In `test/events.test.ts`, add one case following the `stream()` helper pattern, but with path `/v1/me/events`. The intervenant's stream receives events from both orgs; another org's supervisor stream receives none. Run it to green.

- [ ] **Step 6: commit.** `feat(api): cross-organization reads for the person`

#### Task 0.4: Person-centric field app with no organization switcher (web)

**Files:**

- Modify: `app/shells/field-shell.tsx`
- Modify: `features/notifications/{notification-bell.tsx,live-updates.ts,parts.tsx,notifications-page.tsx}`
- Modify: `lib/incidents.ts:16`
- Modify: `app/router.tsx` (fieldIncidentRoute `validateSearch`)
- Modify: `features/field/{field-incident-page.tsx,my-work-page.tsx,my-incidents-page.tsx,incident-row.tsx,queries.ts,availability-control.tsx}`
- Create: `apps/web/e2e/intervenant-orgs.spec.ts`

**Consumes:** the Task 0.3 routes.

- [ ] **Step 1: write the failing e2e test.**

  Add `data-testid="work-card"` and `data-testid="work-org"` to IncidentRow first, so the test can target them. Then:

```ts
// apps/web/e2e/intervenant-orgs.spec.ts
import { expect, test } from '@playwright/test';

test('an intervenant opens work from two organizations without switching', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Work email').fill('karim@rhone-plomberie.test');
  await page.getByLabel('Password', { exact: true }).fill('sentinel-demo');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/field\/work/);
  await expect(page.getByRole('button', { name: /switch organization/i })).toHaveCount(0);

  const orgs = [...new Set(await page.getByTestId('work-org').allInnerTexts())];
  expect(orgs.length).toBeGreaterThan(1);
  for (const org of orgs) {
    await page.getByTestId('work-card').filter({ hasText: org }).first().click();
    await expect(page).toHaveURL(/\/field\/incidents\/INC-.*org=/);
    await expect(page.getByText(org).first()).toBeVisible();
    await page.goBack();
  }
});
```

- [ ] **Step 2: run it and see it fail** (the switcher is present).

- [ ] **Step 3: implement**
  1. **Field shell:** replace `<OrgSwitcher compact />` with the organization name (not interactive) when the person has one field membership, otherwise `<Logo />`. Use `<NotificationBell to="/field/notifications" scope="person" />`.
  2. **Notifications:** add a `scope: 'tenant' | 'person'` prop or argument. For `person`:
     - keys under `['me', 'notifications', ...]`
     - endpoints `/me/notifications...`
     - live updates from `apiUrl('/me/events')`, invalidating every query except the root `['me']` (predicate `q => !(q.queryKey[0] === 'me' && q.queryKey.length === 1)`)
     - opening a notification navigates to `/field/incidents/$reference` with `search: { org: item.organization.id }`
  3. **My work key:** `incidentKeys.myWork = ['me', 'work']`, so it survives `resetTenantCache`. The invalidation at `lib/incidents.ts:70` keeps working.
  4. **Router:** `fieldIncidentRoute.validateSearch = z.object({ org: z.string().uuid().optional().catch(undefined) })`.
  5. **Field incident page:** when `org` is set, differs from the active membership and is one of `me.memberships`, call `switchOrganization(org)` in an effect and render the list skeleton until `membership.organization.id === org`. The case file header shows the OrgMark plus the organization name when the person has several memberships.
  6. **My work page:** delete the `open()` switch logic. Pass `orgId` to `IncidentRow`, which adds `search={{ org: orgId }}` to its Link and shows the org chip (`data-testid="work-org"`).
  7. **History:** for intervenants, use a new `useMyIncidents()` (`['me', 'incidents']` → `/me/incidents?sort=updated`, infinite) with org filter chips. Employees keep `/incidents`.
  8. **Availability control:** use `PATCH /me/availability` (optimistic), then invalidate `['membership']`. Its label becomes "Pour tous vos clients" when the person has several memberships.
  9. **Mixed roles** (supervisor in A, intervenant in B): the account page's OrganizationsSection is the only place to change surface. It has an "Ouvrir" button calling `switchOrganization` and then `navigate(homePath(...))`.

- [ ] **Step 4: run it and see it pass.** Run this test and the full e2e suite: `pnpm --filter @sentinel/web e2e`.

  _Found while implementing:_ `switchOrganization` re-rendered nothing. It wrote a copy of the session data, but TanStack Query's structural sharing keeps the old object, so the old organization stayed on screen. The active organization is now React state in `SessionProvider` (`activeOrg`), which every consumer re-renders on.

- [ ] **Step 5: commit.** `feat(web): intervenants work across organizations without switching`

### Phase 1: Production foundation (3–4 weeks)

**Exit:**

- staging and production are deployed from CI
- a restore drill is documented
- error tracking and uptime alerts are live
- email passes DMARC
- no local-disk state remains

#### Task 1.1: Prisma 7 and Node 24 (before 19 Nov 2026)

- Generator `prisma-client` with output `apps/api/src/generated/prisma`; update imports.
- Add `apps/api/prisma.config.ts` and use `new PrismaClient({ adapter: new PrismaPg(pool) })`.
- One shared `pg` Pool in `lib/db.ts` for Prisma, pg-boss and the SSE listener (`lib/events.ts` keeps its dedicated LISTEN client).
- Pool settings that match v6: `connectionTimeoutMillis: 5000` and an explicit `max`. Keep the 20 s transaction timeout.
- Docker base `node:24-alpine`, CI `node-version: 24`, `engines.node >=24`.
- **Acceptance:** all suites green; `EXPLAIN` on the inbox list unchanged; seed and `migrate deploy` work in Docker.
- Expand into its own plan using the upgrade guide (`/prisma/web` upgrade-prisma-orm/v7).

#### Task 1.2: Deploy pipeline and environments

- GitHub Actions on `main`: build the api and web images, push to GHCR, and run `prisma migrate deploy` as a one-off release job. Remove it from `Dockerfile.api` CMD, so two instances never migrate concurrently.
- Rolling deploy, then smoke-check `/ready`, then run the Playwright smoke set against staging.
- Environments: staging (seeded with fake data) and production on the same images.
- `env.ts` gains `APP_ENV`, `PUBLIC_WEB_URL`, `S3_*`, `MAIL_*`, `SENTRY_DSN`, plus Phase 2 and 5 keys, all validated at boot.
- Secrets live in the host's secret store.
- Migration rule: expand/contract. Never drop or rename in the same release that stops using a column.

#### Task 1.3: Hosting (D12)

- Provision in the Paris region:
  - managed PostgreSQL 16 with PITR of 7 days or more and automated daily backups
  - two small compute instances (or a PaaS)
  - an S3 bucket with versioning
  - a CDN for the web shell
- Nightly `pg_dump`, encrypted, stored in a separate bucket and account, kept 30 days.
- Written RPO of 15 minutes and RTO of 4 hours.
- **Acceptance:** a restore drill into a scratch database, row counts checked, time recorded in `docs/runbooks/restore.md`.

#### Task 1.4: Object storage and photo pipeline (D11)

- `lib/storage.ts`: S3 adapter behind the existing `put/read/remove` interface. Downloads switch to a 5-minute presigned GET after `findReadableAttachment`.
- sharp re-encodes every upload to JPEG/WebP (no metadata) and writes a 320 px thumbnail key.
- Delete orphaned objects through a daily `sweep.attachments` job.
- **Tests:**
  - EXIF GPS is absent after upload (fixture with GPS)
  - a wrong magic number answers 415 (exists)
  - presigned URLs are issued only after the scope check (adversarial)

#### Task 1.5: Jobs (D1)

- `jobs/boss.ts` starts and stops pg-boss with the server.
- Transactional enqueue via `boss.send(name, data, { db: { executeSql: (sql, values) => tx.$queryRawUnsafe(sql, ...(values ?? [])).then((rows) => ({ rows })) } })`. Use pg-boss's Prisma adapter if the installed version ships one.
- Queues:
  - `email.send` (5 retries, backoff)
  - `sweep.attachments` (daily)
  - `purge.registrations` (daily; reuses `purgeExpiredRegistrations`)
  - stubs for `notify.push`, `notify.whatsapp`, `sla.tick`, `org.export`, `org.delete`
- **Test:** enqueue inside a rolled-back transaction leaves no job (mirror the `emitEvent` rollback test).

#### Task 1.6: Email deliverability

- Transactional provider with SPF, DKIM and DMARC on `mail.<domain>` (start DMARC at `p=none`, move to `quarantine` after two clean weeks).
- Bounce and complaint webhook feeds a suppression table.
- All mail goes through `email.send`.

#### Task 1.7: Observability

- Sentry for api and web: release equals the git sha; source maps uploaded in CI, not served.
- OpenTelemetry Node auto-instrumentation (HTTP, Express, pg).
- pino JSON with requestId, userId and orgId, shipped to a log store.
- Uptime Kuma on separate infrastructure watching `/ready` and the web root, with a public status page.
- Alerts:
  - 5xx above 1% for 5 min
  - p95 above 800 ms
  - job failures above 0 for 15 min
  - DB connections above 80%
  - disk above 80%
- Write `docs/runbooks/incident-response.md`.

#### Task 1.8: Security baseline

- Origin check middleware on state-changing requests (CSRF defence in depth on top of SameSite=Lax).
- CSP `default-src 'none'` on API JSON. Keep the strict web CSP and extend `connect-src` for the S3, Sentry and Stripe origins.
- Session timeouts by kind (D4).
- Dependency policy (D17): `pnpm-workspace.yaml` gets `minimumReleaseAge: 4320` and `onlyBuiltDependencies`; Dependabot config; `pnpm audit --prod --audit-level=high` in CI.
- `docs/runbooks/credential-rotation.md`.

#### Task 1.9: Legal and trust pages (FR and EN)

Public pages:

- Privacy policy
- Terms (versioned; exists)
- DPA with transfer clauses for Cameroon
- Subprocessor list (host, email, Sentry, Meta WhatsApp, Twilio, Stripe, Flutterwave)
- Security
- Accessibility statement

Registration records acceptance of the DPA version. Lawyer review of Law 2024/017 items is marked "confirm" in 2.12.

#### Task 1.10: First-party activation events

- An `ActivationEvent` table, or derived queries, covering: registered → verified → first site → first invite accepted → first incident → first close.
- Feeds the platform overview.
- No third-party trackers, which keeps the CSP strict and needs no consent banner.

### Phase 2: Field experience, phone first (5–6 weeks)

**Exit:**

- J3–J6 pass on a mid-range Android (Chrome, installed) and an iPhone (Home Screen)
- airplane-mode report → reconnect produces exactly one incident
- median OTP sign-in time below 60 s in pilot

#### Task 2.1: Phone identity (D4)

- Data model changes from 5.3: User, PhoneChallenge, Session `kind`.
- `libphonenumber-js` with default region `CM`, stored as E.164.
- `POST /auth/phone/start`:
  - sends a 6-digit code through the WhatsApp authentication template (copy-code and one-tap)
  - falls back to Twilio Verify SMS after 30 s, or on WhatsApp failure
- `POST /auth/phone/verify` creates a FIELD session (30 days).
- Limits:
  - 3 sends per 10 min and 10 per day per number
  - per IP
  - 5 attempts per code, 10-min expiry
  - codes stored hashed
- Fraud guard: geo allowlist `+237` by default (per-org extension); Twilio Fraud Guard on.
- Web: `autocomplete="one-time-code"`; resend countdown; "Recevoir par SMS".
- **Tests:**
  - pumping: 20 starts from one IP are rate-limited
  - a wrong code 5 times locks the challenge
  - an unknown number answers like a known one (no enumeration)

#### Task 2.2: Invitations and CSV import by phone

- An invitation goes to the phone through a WhatsApp utility template with a link, falling back to SMS.
- Acceptance: link → phone code → confirm name → signed in.
- An existing person with the same phone gets a join request.
- The CSV import accepts a `phone` column. I2 still holds, by person.

#### Task 2.3: PWA shell

- vite-plugin-pwa generateSW:
  - app shell precache
  - NetworkFirst for GET lists (24 h)
  - CacheFirst for thumbnails (7 days, capped)
- Manifest: icons, `standalone`, start_url per role.
- Install: Android uses `beforeinstallprompt` after the first successful report or accept; iOS shows an "Ajouter à l'écran d'accueil" instruction sheet.
- An "update available" toast reloads into the new version.

#### Task 2.4: Offline queue

- `lib/offline-queue.ts` (IndexedDB, one store per user id) holds: create incident, comment, progress, on-site, resolve, accept, decline.
- Each action carries an Idempotency-Key; photos are stored as Blobs.
- Replays on `online`, on focus and through Background Sync where available.
- States: Waiting / Sent / Failed with reason and Retry. Header chip "N en attente".
- Sign-out with a non-empty queue shows a confirm dialog naming what will be lost.
- Logout sends `Clear-Site-Data: "cache", "storage"`.
- **Tests:**
  - unit tests for queue ordering
  - e2e with the context set offline, a report, back online: one incident, and a second replay returns the same reference

#### Task 2.5: Notifications (D10)

- Web Push:
  - VAPID keys and the `web-push` lib
  - a PushSubscription per device
  - payload limited to reference and event type (PRD)
  - the service worker opens `/field/incidents/:ref?org=`
- WhatsApp utility templates, approved in FR and EN, for the five D10 events.
- Per-person preferences and a per-org monthly budget (stop and alert the owner at 100%).
- Every send is logged in OutboundMessage.
- All sending goes through the `notify.push` and `notify.whatsapp` jobs.

#### Task 2.6: Sites, areas, QR and guest reports (D7)

- Site GPS pin (tap on map or "use my position"), landmark text, `guestReporting` switch.
- SiteArea CRUD.
- Printable A4 QR sheet (SVG via `qrcode`), with a name per code.
- `/r/:token`: a signed-in employee gets the report form pre-filled; otherwise, if guests are allowed, the guest form; otherwise the sign-in prompt.
- `POST /public/sites/:token/reports`:
  - 5 per hour per IP per site and 50 per day per site
  - a honeypot field
  - at most 3 photos
  - optional phone, with consent text stored
- Tracking `/t/:token` and its confirmation endpoint.
- Supervisors get the "Visiteur" badge and the `SPAM` dismissal.

#### Task 2.7: One-screen report

- Description becomes optional (shared schema plus a migration giving the DB column a default of `''`).
- Category chips.
- The location comes from QR, then home site, then last site.
- Photo first, through a `capture="environment"` input; Android opens the camera.

#### Task 2.8: Intervenant field actions

- "Je suis sur place" stamps GPS and accuracy, plus the distance to the site pin.
- Itinéraire link: `https://www.google.com/maps/dir/?api=1&destination=lat,lng`.
- Call-site button when the org allows it.

#### Task 2.9: Data saver

- Thumbnails in lists; full image on tap.
- Honour `navigator.connection.saveData`.
- Upload preparation targets 1600 px at quality 0.72.

### Phase 3: Tenant safety and identity (2–3 weeks) → Pilot gate

**Exit:**

- RLS is on for every tenant table
- the adversarial suite is green in CI, running as the app role
- supervisors can enrol TOTP, and owners can require it

#### Task 3.1: RLS (D3)

- Roles: `sentinel_owner` runs migrations; `sentinel_app` is LOGIN with no BYPASSRLS.
- New migration in `prisma/sql/rls.sql`, for each tenant table: `ENABLE` + `FORCE ROW LEVEL SECURITY` and a policy `USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::uuid)`, with a matching `WITH CHECK`.
- Tenant requests run in a transaction that starts with `SELECT set_config('app.org_id', $1, true)`, through a Prisma extension on the shared client, plus a per-request transaction helper.
- `/me` cross-org reads loop per membership, each with its own setting.
- Platform, jobs and public endpoints use a `system` path:
  - a separate role with BYPASSRLS, used only in `platform/*`, `jobs/*` and `public-*`
  - the import is lint-restricted to those folders
- Index check on `organizationId`; measure p95 before and after on the 10k dataset.

#### Task 3.2: Query guard and adversarial suite

- A Prisma extension throws on tenant models without `organizationId` in `where` (PRD 5.5.3).
- A test iterates every tenant model.
- A route-table test enumerates the Express routers and, for each tenant route, checks that an org-B caller gets 404 on org-A ids.
- Every non-admin gets 403 on `/platform`.
- Every `/me` route returns only the caller's rows.
- A SQL test as `sentinel_app` with no setting returns zero rows.

#### Task 3.3: Supervisor MFA

- TOTP enrolment with QR and 10 recovery codes (reusing `lib/crypto`).
- "Exiger la double authentification" owner setting, enforced by the guard.
- Session rotation on MFA verification.
- Passkeys (`@simplewebauthn/server`) for supervisors and admins as a follow-up task in the same phase if time allows.

#### Task 3.4: Session and security events

- UserSecurityEvent records sign-in success and failure, codes sent, MFA changes and session revokes. The person sees these in Account.
- New-device alert by email or WhatsApp.
- Revoke every session on phone, email or password change.

### Phase 4: Operations depth (3–4 weeks)

#### Task 4.1: SLA (D9)

- SlaPolicy CRUD (defaults: Critical 30 min / 4 h, High 2 h / 1 d, Medium 8 h / 3 d, Low 1 d / 7 d) and an org business-hours editor.
- `computeDue(createdAt, minutes, hours, tz)` in `packages/shared`, with unit tests across weekends and DST-free zones (Africa/Douala).
- Due dates are set on create and on triage or priority change.
- `sla.tick` job every minute: marks breaches and escalates at 75% and 100% to supervisors (in-app, push, email), then writes SLA_BREACHED to the audit log.
- UI: inbox chips, the "Breaching soon" view, "Répondre avant" on field cards, SLA compliance % on the dashboard.

#### Task 4.2: Reporter confirmation and auto-close (D8)

- `POST /incidents/:id/confirmation` for the reporter, plus the public tracking variant.
- WhatsApp template with "Oui / Toujours un problème" links.
- Supervisor chip.
- Org setting `autoCloseAfterDays` (off by default). The job closes the incident as the system actor, with an audit reason.

#### Task 4.3: Map

- MapLibre GL with a self-hosted Protomaps PMTiles Cameroon extract in the bucket (no per-request fees, no third-party tracking), lazy loaded.
- Open incidents by priority glyph, site pins; a click opens the case file.

#### Task 4.4: Repeat detection and exports

- Case file note "3e incident de cette catégorie à cet endroit en 30 jours".
- CSV export of incidents with filters.
- Weekly owner summary email: opened, closed, SLA %, top sites.

#### Task 4.5: Notification preferences and digest

Per-channel preferences for each person, and a daily supervisor digest.

#### Task 4.6: Pilot-validated options

Build these only if pilots ask:

- **Voice notes:** MediaRecorder, 60 s or less, a new AttachmentKind AUDIO.
- **WhatsApp intake:** inbound webhook; the sender's phone is matched to an employee membership; photo plus text becomes a NEW incident; a reply carries the reference.
- **Accept/decline from WhatsApp:** quick-reply buttons carrying a single-use token.

### Phase 5: SaaS business layer (4–5 weeks)

**Exit:**

- an organization goes from trial to paid by card, and by mobile-money invoice
- a past-due organization is restricted, then recovered
- support access works end to end with both audit trails
- export and deletion jobs run in staging

#### Task 5.1: Plans and entitlements

`packages/shared/src/plans.ts`:

| Plan       | Sites    | Supervisors | Features                                        |
| ---------- | -------- | ----------- | ----------------------------------------------- |
| Starter    | up to 3  | 2           |                                                 |
| Business   | up to 20 | 10          | + SLA escalations, WhatsApp quota, map, exports |
| Enterprise | custom   | custom      | + SSO, API, webhooks, audit export, support SLA |

- Employees and intervenants are always unlimited.
- `requireEntitlement(key)` middleware; `Organization.entitlementOverrides`.
- The UI shows locked features with an owner-only upgrade action.

#### Task 5.2: Stripe Billing (D13)

- Products and prices per active site (XAF or EUR; monthly and annual).
- Checkout (subscription) from Settings › Abonnement; Customer Portal.
- Webhooks are verified and idempotent on the event id: `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`.
- A job syncs the site quantity.
- Trial without a card (30 days, exists): at the end, choose a plan or go read-only.
- Stripe Tax on, once registered.
- Invoice footer explains VAT and withholding.

#### Task 5.3: Mobile money and transfer

- Flutterwave (or Notch Pay) payment link on an issued invoice; a verified webhook writes a Payment and extends `currentPeriodEnd`.
- Platform "Marquer comme payé" for bank transfers, with a reason and an audit entry.
- Renewal reminders at 7, 3 and 0 days, by email and WhatsApp.

#### Task 5.4: Dunning and lifecycle

| Stage    | What happens                                                             |
| -------- | ------------------------------------------------------------------------ |
| Past due | Owner banner                                                             |
| Day 14   | Read-only (new reports still accepted, so field staff are never blocked) |
| Day 30   | Platform admin decides on suspension (manual)                            |

All states live in `shared/domain.ts` with tests.

#### Task 5.5: Control room (section 4.5)

- `/platform/overview`, organizations health columns, organization tabs.
- Billing (failed payments), Messagerie (spend, OTP abuse), Système (pg-boss counts and failed jobs with retry, email bounces, storage, version), Annonces (banner in apps).
- Health rules live in one function with tests.

#### Task 5.6: Support access (D14)

- The owner grants 1–72 h with a reason.
- A banner shows in the tenant console while the grant is active.
- The platform admin gets "Ouvrir en lecture seule": a support tenant context with role SUPERVISOR and every mutation blocked by middleware.
- Every request is audited in the AuditEvent and PlatformAuditEvent logs.
- Auto-expiry and owner revoke.
- **Tests:** mutations answer 403; no grant answers 404; after expiry answers 404.

#### Task 5.7: Data lifecycle (D19)

- **Export:** a zip of CSV/JSON plus photos, built by a job, delivered through a 7-day signed URL.
- **Deletion:** the owner requests it, a 30-day grace period runs (cancellable), then a job deletes rows and objects and cancels billing.
- **Person erasure:** anonymize the User and redact audit payload names through a `SECURITY DEFINER` function (the only path allowed past I7).

### Phase 6: Enterprise, on demand

- **6.1 SSO:** OIDC (Microsoft Entra ID, Google) and SAML through self-hosted Ory Polis; per-org domain verification; owners enforce SSO for supervisors.
- **6.2 SCIM:** through Polis, only if an SSO customer requires it.
- **6.3 Public API and webhooks:**
  - org API keys (hashed, scoped read and write)
  - an OpenAPI document generated from the shared zod schemas
  - signed webhooks (HMAC, timestamp) delivered by pg-boss with retries and a delivery log
- **6.4 Audit and security pack:** audit export by date range, a security questionnaire answer set, an annual third-party pen test, ISO 27001-aligned policies.
- **6.5 Site-scoped supervisors** (PRD open decision 9), the likeliest enterprise request; preferred to custom roles.

### Phase 7: Launch readiness (2 weeks)

- **Load:** 50 organizations, 10k incidents per organization; p95 targets from PRD 7.13; `EXPLAIN` on hot queries.
- **DR drill:** restore within RTO; documented.
- **Security:** an OWASP ASVS 5.0 Level 2 checklist pass, plus an ecc:security-reviewer pass over auth, public, webhook and billing code.
- **Accessibility:** WCAG 2.2 AA audit with axe in Playwright on every page, plus a keyboard-only console run.
- **Content:** French help centre (report, accept, QR setup, billing) and onboarding playbook (QR stickers, WhatsApp template approval, first-week checklist).
- **Support:** a customer support WhatsApp Business number and email.
- **Legal:** final legal review of Cameroon items.

---

## 7. Testing strategy and quality gates

| Level          | What                                                                                                              | Where                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Unit           | State machines, SLA due computation, plan entitlements, health score, phone normalisation, offline queue ordering | `packages/shared`, `apps/web/src/**/*.test.ts`                |
| Integration    | Every route with its role matrix, webhooks (signature, idempotency), jobs (rollback, no job), RLS as the app role | `apps/api/test` (real Postgres, one file at a time)           |
| Adversarial    | Route-table cross-tenant 404, `/platform` 403, `/me` scope, public endpoint rate limits                           | `apps/api/test/adversarial.test.ts` (blocks CI)               |
| E2E            | J1–J8, session switch, layout, intervenant across orgs, offline replay, guest QR, support access                  | `apps/web/e2e`                                                |
| Device         | Installed PWA on Android (Chrome) and iPhone (Home Screen): offline, push, camera                                 | Manual checklist per release, `docs/runbooks/device-check.md` |
| Non-functional | Load (k6) on staging, Lighthouse accessibility ≥ 95, bundle budget check in CI                                    | Phase 7, then per release                                     |

**Gates per pull request:**

- format, lint, typecheck, tests, build and e2e green
- the reviewer agent from CLAUDE.md signs off, plus the security reviewer when touching auth, input, payments or public routes
- no new tenant table without RLS, composite FKs and an adversarial test

---

## 8. Operations

**Runbooks** in `docs/runbooks/`: deploy and rollback, restore, incident response, credential rotation, WhatsApp template changes, payment reconciliation, data export and deletion, tenant suspension.

**Weekly operator routine:**

1. Control room "À traiter" queue.
2. Failed jobs.
3. Email bounces.
4. WhatsApp and SMS spend versus budgets.
5. Dependabot PRs.
6. Backup status.

**Monthly:** restore spot-check, access review (platform admins, cloud, Stripe, Meta), cost review.

---

## 9. Security and compliance checklist (before paid launch)

- [ ] RLS forced on every tenant table; app role without BYPASSRLS; adversarial suite blocking CI.
- [ ] MFA for platform admins (exists) and available to supervisors, with owner enforcement; session timeouts per D4.
- [ ] OTP rate limits, `+237` geo allowlist, Fraud Guard; no user enumeration.
- [ ] Uploads re-encoded (no EXIF/GPS), private bucket, presigned 5-minute GETs, size limits.
- [ ] Webhooks signature-verified and idempotent; secrets in the host store; rotation runbook tested.
- [ ] Supply chain: frozen lockfile, release-age delay, scripts allowlist, audit in CI, 2FA everywhere, read-only CI tokens.
- [ ] CSP strict on web and API; Origin check; Clear-Site-Data on logout.
- [ ] PITR plus off-site dumps, restore drill under 4 h, status page, alerting.
- [ ] DPA (transfer clauses), subprocessor list, processing register, breach runbook ("immediately"), export and erasure working, consent stored for guest phone numbers.
- [ ] Cameroon lawyer confirmation: scope over foreign processors, transfer authorisation, declarations customers must file.
- [ ] Cameroon tax adviser confirmation: VAT registration and fiscal representative, withholding treatment, invoice wording.
- [ ] EU entity only: GDPR Art 28 terms, Data Act switching export, French e-invoicing platform before 1 Sep 2027.

---

## 10. Risks, kill signals, open decisions

| Risk                                                       | Signal                                                   | Response                                                                               |
| ---------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Field adoption low                                         | Under 60% of invited field staff signed in within 7 days | Review the WhatsApp invite copy; add QR plus phone sign-in at site; consider Expo (D6) |
| Photo uploads fail on poor networks                        | More than 5% of queued photos failing                    | Resumable uploads; smaller images; Expo background upload                              |
| WhatsApp template rejection or cost rise                   | Template not approved, or rate card change               | SMS fallback; cut events to assignment only; per-org budget                            |
| Card declines on Cameroon-issued cards                     | Over 30% failed first charges                            | Default to an invoice plus mobile-money link                                           |
| Cameroon law requires local hosting or prior authorisation | Authority decree or lawyer opinion                       | Keep the provider-agnostic stack; plan a Lagos or in-country move (D12)                |
| Solo operator overload                                     | More than 10 tenants with manual tasks [A36]             | Automate lifecycle and billing jobs (Phase 5); cut "À traiter" categories              |
| Prisma 7 regression                                        | Timeouts after upgrade                                   | Pool settings matching v6 (Task 1.1); staged rollout on staging                        |

**Open decisions (owner):**

1. Billing company: French SAS or US LLC (sets GDPR, e-invoicing, Stripe fees).
2. Price points in XAF per site per month for Starter and Business (validate in pilot).
3. Hosting provider within Paris: OVHcloud or Clever Cloud.
4. Mobile-money aggregator: Flutterwave or Notch Pay (after merchant onboarding answers).
5. Whether guest reporting is on by default for new sites (recommended off).

---

## Appendix A. Sources

Sources were retrieved by research agents on 8 October 2026. "(snippet)" means seen in a search result and not fully fetched. Items marked "confirm" in 2.12 need professional confirmation.

**Market and UX**

- A1 https://help.getmaintainx.com/about-work-requests
- A2 https://help.onupkeep.com/en/articles/9627833-how-to-approve-and-manage-work-order-requests
- A3 https://help.limblecmms.com/en/articles/11471739-how-to-use-work-request-review-and-approval
- A4 https://helpdesk.fiixsoftware.com/hc/en-us/articles/17578832400020-Transition-a-work-request-to-a-work-order
- A5 https://servicechannel.com/learning-channel/stay-on-top-with-the-right-work-order-status
- A6 https://landlord-help.fixflo.com/support/solutions/articles/61000272500-landlord-guide
- A7 https://help.safetyculture.com/004268 (snippet); rename reported at https://startlandnews.com/2026/08/safetyculture-mitti/
- A8 https://www.getmaintainx.com/pricing; https://limble.com/pricing; https://help.onupkeep.com/en/articles/108077
- A9 https://help.getmaintainx.com/set-up-a-request-portal
- A10 https://help.limblecmms.com/en/articles/3637230-qr-code-overview
- A11 https://help.mitti.com/001617
- A12 https://www.fixflo.com/
- A13 https://osm.fixmystreet.com/faq; https://cob.org/about/contacts/report/seeclickfix-frequently-asked-questions (snippet)
- A14 https://baymard.com/blog/checkout-flow-average-form-fields; https://baymard.com/lists/cart-abandonment-rate
- A15 https://www.nngroup.com/articles/eas-framework-simplify-forms/
- A16 https://wwdcnotes.com/documentation/wwdc23-10120-whats-new-in-web-apps/
- A17 https://corrigopro.com/faq/?lang=en_au
- A18 https://servicechannel.atlassian.net/wiki/x/4oQYJQ (snippet)
- A19 https://servicechannel.com/services-providers/trade-partner-guide/; https://servicechannel.com/products/provider-app/
- A20 https://developer.corrigopro.com/docs/technician-checked-in
- A21 https://www.praxedo.com/product-tour/work-order-reports/
- A22 https://help.getmaintainx.com/offline-mode
- A23 https://mc.merill.net/message/MC1184992
- A24 https://developer.servicechannel.com/guides/wo/create-wo-classic/ (snippet)
- A25 https://support.zendesk.com/hc/en-us/articles/4408832852122-Viewing-and-understanding-SLA-targets
- A26 https://upkeep.com/pricing/
- A27 https://www.getmaintainx.com/pricing; https://fiixsoftware.com/pricing/; https://mitti.com/pricing/; https://www.praxedo.com/pricing/; https://www.yuman.io/en/pricing/
- A28 https://sso.tax/
- A29 https://help.getjobber.com/hc/en-us/articles/360042930793 (snippet)
- A30 https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html; https://developer.apple.com/design/human-interface-guidelines/accessibility
- A31 https://www.w3.org/TR/mobile-accessibility-mapping/
- A32 https://linear.app/docs/triage; https://linear.app/docs/select-issues
- A33 https://docs.helpscout.com/article/419-keyboard-shortcuts
- A34 https://help.front.com/en/articles/2403
- A35 https://help.getmaintainx.com/on-time-vs-overdue-report (snippet)
- A36 https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/approaches/control-planes; https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenant-life-cycle
- A37 https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/tenant-aware-operations.html (snippet)
- A38 https://docs.datagrail.io/docs/overview/support-access
- A39 https://clerk.com/docs/guides/users/impersonation
- A40 https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/; https://webkit.org/blog/16535/meet-declarative-web-push/
- A41 https://developer.chrome.com/docs/workbox/modules/workbox-background-sync; caniuse background-sync
- A42 https://webkit.org/blog/14403/updates-to-storage-policy/
- A43 caniuse html-media-capture; https://kb.strich.io/article/29-camera-access-issues-in-ios-pwa
- A44 https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt
- A45 https://docs.expo.dev/versions/latest/sdk/background-task/
- A46 https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- A47 https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Clear-Site-Data
- A48 https://tanstack.com/query/latest/docs/reference/QueryClient

**Enterprise and operations**

- A49 https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-managed-postgresql/rls.html
- A50 https://www.postgresql.org/docs/16/ddl-rowsecurity.html
- A51 https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres
- A52 https://supabase.com/docs/guides/database/postgres/row-level-security
- A53 https://github.com/prisma/prisma-client-extensions/tree/main/row-level-security
- A54 https://www.pgbouncer.org/features.html
- A55 https://www.prisma.io/docs/orm/release-status; https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7
- A56 https://endoflife.date/nodejs
- A57 https://pages.nist.gov/800-63-4/sp800-63b.html
- A58 https://fidoalliance.org/fido-alliance-reports-accelerating-global-passkey-adoption-on-world-passkey-day-2026/
- A59 https://workos.com/pricing
- A60 https://github.com/ory/polis
- A61 https://www.cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem
- A62 https://harness.io/blog/mini-shai-hulud-explained-how-the-tanstack-and-rubygems-supply-chain-attacks-worked
- A63 https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/
- A64 https://pnpm.io/settings/dependency-resolution; https://docs.npmjs.com/cli/v11/using-npm/config
- A65 https://owasp.org/www-project-application-security-verification-standard/
- A66 https://top10.owasp.org/2025
- A67 https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- A68 https://sharp.pixelplumbing.com/api-output
- A69 https://github.com/timgit/pg-boss; https://deepwiki.com/timgit/pg-boss/6.1-sending-jobs
- A70 https://docs.bullmq.io/guide/going-to-production
- A71 https://support.google.com/a/answer/81126
- A72 https://sre.google/sre-book/availability-table/
- A73 https://docs.sentry.io/organization/data-storage-location/
- A74 https://www.scaleway.com/en/pricing/managed-databases/; https://feature-request.scaleway.com/posts/186/point-in-time-recovery
- A75 https://www.ovhcloud.com/en/public-cloud/postgresql/
- A76 https://www.clever.cloud/developers/doc/addons/postgresql/
- A77 https://gdpr-info.eu/art-28-gdpr/
- A78 https://www.cooley.com/news/insight/2025/2025-09-08-paas-iaas-or-saas-be-aware-new-switching-rules-will-become-applicable-in-eu
- A79 https://www.impots.gouv.fr/professionnel/je-decouvre-la-facturation-electronique
- A80 https://docs.stripe.com/billing/subscriptions/quantities
- A81 https://docs.stripe.com/billing/subscriptions/trials/free-trials

**Cameroon**

- B1 https://droitmediasfinance.com/index.php/actualites/droit-tech-fintech/1297-cameroun-la-loi-sur-la-protection-des-donnees-a-caractere-personnel-entre-en-vigueur-ce-23-juin-2026
- B2 https://techhiveadvisory.africa/insights/operationalising-cameroons-data-protection-law-a-review-of-key-provisions-and-impacts
- B3 https://lexafrica.com/2025/10/cameroon-data-protection-law-compliance/
- B4 https://www.dlapiperdataprotection.com/?c=CM&t=law
- B5 https://gs.statcounter.com/os-market-share/mobile-operating-system/cameroon
- B6 https://www.telecomreviewafrica.com/?p=2407
- B7 https://africloud.com/news/africa-latency-measured
- B8 https://inflect.com/datacenters/cameroon/douala
- B9 https://www.connectingafrica.com/regulation/cameroonian-telcos-fined-9-8m-for-poor-network-quality
- B10 https://datareportal.com/reports/digital-2026-cameroon
- B11 https://a4ai.org/?p=9993 (cable.co.uk figure)
- B12 https://www.businessincameroon.com/energy/2001-15625-cameroon-power-utility-warns-of-up-to-10-hour-outages-in-northern-regions
- B13 https://oldsite.defyhatenow.org/common-digital-platforms-in-cameroon-and-their-usage-2/
- B14 https://ecomatin.net/cameroun-lattribution-des-marches-publics-en-ligne-bondit-de-221-a-1-173-contrats-en-un-an
- B15 https://docs.stripe.com/currencies
- B16 https://www.connectingafrica.com/fintech/flutterwave-expands-further-with-license-in-cameroon
- B17 https://developer.notchpay.co/accept-payments/mobile-money
- B18 https://www.vatcalc.com/cameroon/cameroon-vat-on-non-resident-digital-services/
- B19 https://docs.stripe.com/tax/supported-countries/africa/cameroon
- B20 https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- B21 https://articles.chakrahq.com/article/pricing-updates-for-whatsapp-business-platform-effective-july-2025-onwards/ (third-party)
- B22 https://www.sent.dm/en/resources/sms-pricing/central-africa-sms-pricing
- B23 https://static0.twilio.com/docs/verify/preventing-toll-fraud
