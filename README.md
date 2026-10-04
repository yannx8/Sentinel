# Sentinel

Multi-tenant incident management for organizations with several sites. Employees report, supervisors triage and assign, intervenants resolve, supervisors verify and close, with a full audit trail.

> Status: under active rebuild. Authentication is being replaced (Phase 2), so protected API routes currently answer 401. See the delivery phases in `docs/PRD.md`.

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
