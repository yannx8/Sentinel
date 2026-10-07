# Sentinel

Incident management for organizations that run several sites. Employees report a problem, supervisors triage and assign it, intervenants (technicians or external contractors) resolve it with proof, and supervisors verify and close it, with a full audit trail and strict separation between organizations.

## What is in the box

| Surface  | For                                                                                       | Path                                    |
| -------- | ----------------------------------------------------------------------------------------- | --------------------------------------- |
| Console  | Supervisors: triage desk, dashboard, team, sites, categories, audit log, settings         | `/app`                                  |
| Field    | Employees (report in three steps) and intervenants (accept, update, resolve), phone first | `/field`                                |
| Platform | Sentinel staff: organizations, suspension, registrations. Never shows incident content    | `/platform`                             |
| Public   | Sign-in, organization registration with email verification, invitations, password reset   | `/login`, `/register`, `/invite/:token` |

English and French throughout, light and dark themes, WCAG 2.2 AA contrast checked by test.

## Stack

| Layer  | Choice                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------- |
| Web    | React 19, Vite, TanStack Router and Query, React Hook Form, Radix, Tailwind v4, Inter                         |
| API    | Express 5, Prisma 6, PostgreSQL 16, zod, pino                                                                 |
| Auth   | In-house: scrypt hashes, opaque session tokens, lockout, TOTP for platform admins                             |
| Shared | `packages/shared`: zod schemas, DTO types, incident state machine, candidate ranking, Thread visibility rules |

Decisions and rules: [docs/PRD.md](docs/PRD.md) (section 12 lists what differs from the original plan). Visual language: [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).

## Getting started

Requirements: Node 22 or newer, pnpm 10.15 (`corepack enable`), Docker (or a local PostgreSQL 16 with the `pg_trgm` extension).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
docker compose up -d db mailpit
pnpm db:generate
pnpm db:migrate
pnpm db:seed          # optional demo data
pnpm dev              # API on :4000, web on :5173
```

| Service              | URL                                         |
| -------------------- | ------------------------------------------- |
| Web                  | http://localhost:5173                       |
| API                  | http://localhost:4000 (`/health`, `/ready`) |
| Mail inbox (Mailpit) | http://localhost:8025                       |

Without `SMTP_HOST`, emails are printed in the API log, and registration also returns the confirmation link in development.

### Demo accounts

After `pnpm db:seed`, every account uses the password `sentinel-demo`.

| Email                        | Role                                                           |
| ---------------------------- | -------------------------------------------------------------- |
| `claire@northwind.test`      | Supervisor and owner, Northwind Facilities                     |
| `karim@rhone-plomberie.test` | Intervenant in two organizations                               |
| `lea@northwind.test`         | Employee                                                       |
| `admin@sentinel.test`        | Platform admin, TOTP secret `JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP` |

The seed data is fictional and the seed refuses to run in production.

### Create a real platform admin

```bash
PLATFORM_ADMIN_PASSWORD='choose a long passphrase' \
  pnpm --filter @sentinel/api admin:create -- --email you@company.com --first Ada --last Lovelace
```

It prints the TOTP secret once. Platform admins cannot be created from the UI.

## Checks

```bash
pnpm typecheck
pnpm test             # shared rules, token contrast, and API integration tests on Postgres
pnpm build
pnpm format:check
```

API tests run against a database whose name ends in `_test` (`apps/api/.env.test`), one file at a time. They refuse to run against anything else because suites truncate tables.

## Configuration

Read by `apps/api/src/env.ts`:

| Variable                                                            | Default                 | Purpose                                       |
| ------------------------------------------------------------------- | ----------------------- | --------------------------------------------- |
| `DATABASE_URL`                                                      | required                | PostgreSQL connection string                  |
| `PORT`                                                              | `4000`                  | API port                                      |
| `WEB_ORIGIN`                                                        | `http://localhost:5173` | CORS origin and base of links in emails       |
| `TRUST_PROXY`                                                       | `false`                 | Set `true` behind nginx or another proxy      |
| `SESSION_COOKIE_SAMESITE`                                           | `lax`                   | `none` only for cross-site setups, over HTTPS |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | unset                   | Outgoing email                                |
| `STORAGE_PATH`                                                      | `./uploads`             | Where photos are stored                       |
| `LOG_LEVEL`                                                         | `info`                  | pino log level                                |

The web app reads `VITE_API_URL` (default `/api`, proxied to the API by Vite in development and by nginx in Docker).

## Full stack in Docker

```bash
docker compose up --build
```

Open http://localhost:8080. The API applies pending migrations on start. Behind TLS inspection, put the inspecting root CA in `.certs/` (see `.certs/README.md`).

## Repository layout

```
apps/api         Express API, Prisma schema and migration, seed, tests
apps/web         React app: console, field app, platform, public pages
packages/shared  Contracts and rules used by both
docs/            PRD and design system
```

## Database

One baseline migration in `apps/api/prisma/migrations/0001_baseline`. Constraints that Prisma cannot express live in `apps/api/prisma/sql/invariants.sql` and are appended to it: one live assignment per incident, one employee membership per person, append-only audit rows, immutable original reports, read-only closed incidents, trigram search indexes. Review every generated migration for `DROP` statements against these objects.

## Security notes

- Every request re-checks the user, the membership and the organization status. Anything outside the caller's organization answers 404, identical to a missing id.
- Platform admins and organization members use separate guards and cannot cross over. A platform admin session needs a verified TOTP code.
- Uploads are checked by content, not by name or declared type, and served only after a scope check.
- Mutations carry the incident version, and creates and transitions accept `Idempotency-Key`.
