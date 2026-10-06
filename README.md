# Sentinel

Multi-tenant incident management for organizations with several sites. Employees report, supervisors triage and assign, intervenants resolve, supervisors verify and close, with a full audit trail.

> Status: greenfield rebuild in progress. Start with `docs/PRD.md` (product spec and milestones R0 to R7) and `docs/DESIGN_SYSTEM.md`.

## Where things stand

| Area | State |
|---|---|
| Web console (`apps/web`) | The Triage desk works end to end on in-memory demo data: list, docked case file with the Thread, assign dialog, close, send back, dismiss, comments, undo, dark theme, phone layout. No API behind it yet. Review page: `/design` |
| Shared (`packages/shared`) | Design tokens (generated CSS, contrast tests), incident state machine, candidate ranking. 66 tests |
| API (`apps/api`) | Legacy code, protected routes answer 401 until auth lands in R1 and R2 |
| Mobile (`apps/mobile`) | Legacy shell. Not usable until it is rebuilt in R2, so there is nothing to test on a phone yet except the web console in a mobile browser |

Next steps, in order: R1 data model and auth, R2 incident loop slice with the API and mobile report and My work screens. Design prototypes are being made in Claude Design with `docs/design-system/claude-design-prompts.md`.

## Run the web console

```bash
pnpm install
pnpm --filter @sentinel/web dev      # http://localhost:5173/app/triage
pnpm --filter @sentinel/shared test  # tokens contrast and domain rules
pnpm --filter @sentinel/web build
```

On a machine behind TLS inspection (antivirus HTTPS scanning), set `NODE_EXTRA_CA_CERTS` to the inspecting root CA before running Node tools. See `.certs/README.md`.

## Deploy the web console on Vercel

Import the repository in the Vercel dashboard with Root Directory `apps/web` and Node 22. `apps/web/vercel.json` already sets the build command, output directory and single-page rewrites. The deployed site shows demo data only.

## Repository layout

| Path | What it is |
|---|---|
| `apps/api` | REST API: Express 5, Prisma 6, PostgreSQL 16 |
| `apps/web` | Web console for supervisors and platform admins: React, Vite, Tailwind v4 |
| `apps/mobile` | Expo app for employees and intervenants |
| `packages/shared` | Types, API client and design tokens shared by the apps |

## Requirements

- Node 22 or newer
- pnpm 10.15 (`corepack enable`)
- Docker Desktop, for Postgres and Mailpit

## Local development

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
docker compose up -d db mailpit
pnpm db:generate
pnpm db:migrate:deploy
pnpm dev            # api on :4000, web on :5173
pnpm dev:mobile     # Expo dev server
```

Local services:

| Service | URL |
|---|---|
| API | http://localhost:4000 (health: `/health`, `/ready`) |
| Web console | http://localhost:5173 |
| Mailpit inbox | http://localhost:8025 |

## Checks

```bash
pnpm typecheck
pnpm test           # API tests, run against the sentinel_test database
pnpm build
```

API tests always run with `--no-file-parallelism` to avoid exhausting the local connection pool.

## Full stack in Docker

```bash
docker compose up --build
```

The web console is served on http://localhost:8080 and proxies `/api` to the API container. The API applies pending migrations on start.

## Database

The schema lives in `apps/api/prisma/schema.prisma`, with one baseline migration. Some invariants (partial unique indexes) exist only as raw SQL in the migration, so review every generated migration for unintended `DROP INDEX` statements before applying it.
