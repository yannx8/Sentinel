# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Scope note: this file is shared by `apps/web` (supervisor and platform admin console) and `apps/mobile` (Expo app for employees and intervenants). The mobile app is a separate native surface and will record its own platform when it is built.

## Stack

React 19, Vite, TanStack Router, Query and Table, React Hook Form with shared zod schemas, Radix primitives, Tailwind v4 with `@theme` tokens. Decided in `docs/PRD.md` section 7.2, confirmed by the user.

## Users

Primary: supervisors at a desk (often the organization owner or a delegate) triaging tens of incidents a day, who must keep nothing unowned or stale. Secondary: platform admins (Sentinel staff) managing tenant organizations. Employees and intervenants use the mobile app, not this console.

## Product Purpose

Sentinel is a multi-tenant B2B incident platform for organizations that run several sites. It closes the loop between "someone noticed a problem" and "the right technician fixed it and someone checked": employee reports, supervisor triages and assigns, intervenant accepts, works and resolves, supervisor verifies and closes, with a full audit trail. Success: an organization registers and invites its people in under 15 minutes, and the full loop works per role.

## Positioning

One case file per incident, the same object for every role, filtered by permission. Strict tenant isolation proven by automated adversarial tests. Platform admins manage organizations but never see incident content. Intervenants can serve several client organizations with one login.

## Operating Context

Supervisors work on desktop browsers, in a docked list plus case file workflow. Field staff use the phone app, often offline, in daylight, with gloves. FR and EN from day one. Dates in the organization timezone. Refer to `docs/PRD.md` for journeys J1 to J8.

## Capabilities and Constraints

- Roles: employee (REPORTER), intervenant, supervisor (owner flag), platform admin. One role per membership. UI vocabulary: Employee, Intervenant, Supervisor, Site, Incident. Never "user", "responsable" or "administrator".
- Incident states NEW, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED, mirroring the live assignment while open. Original incident fields are immutable.
- Tenant context from `X-Org-Id`, validated against an ACTIVE membership. Cross-tenant access returns 404.
- WCAG 2.2 AA. Status and priority never by colour alone.
- Undecided: map tile provider, tabular figures in the chosen fonts, attachment retention, trial behaviour. See PRD section 11.

## Brand Commitments

Name: Sentinel. Voice rules from `docs/PRD.md` and `docs/DESIGN_SYSTEM.md` section 7: plain verbs, sentence case, no exclamation marks, errors that say what to do. Visual direction is NOT recorded here. `docs/DESIGN_SYSTEM.md` is a draft proposal pending the user's review and is evidence for new-work, not a binding constraint.

## Evidence on Hand

`docs/PRD.md` (v2.0), `docs/DESIGN_SYSTEM.md`, `docs/design-system/specimen.html`. No real customers, testimonials, metrics or screenshots exist. Do not fabricate any.

## Product Principles

1. The next action is always obvious: show only the actions valid for the current state and role.
2. One incident, one source of truth, filtered by permission.
3. Trust is visible: who did what and when, never edited retroactively.
4. Fast beats feature-rich: optimistic updates, no reloads, no spinner over 400 ms.
5. Boring technology: one database, one deployable API.

## Accessibility & Inclusion

WCAG 2.2 AA floor, keyboard-complete web journeys, visible focus, reduced motion respected, French and English.
