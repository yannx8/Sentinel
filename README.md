# Sentinel

Production-oriented incident reporting and tracking platform for multi-tenant organizations.

## Architecture

- Frontend: React + TypeScript + Vite
- API: Express + TypeScript
- Database: PostgreSQL + Prisma
- Map: Leaflet + OpenStreetMap
- Monorepo: pnpm
- Authentication: short-lived access JWT + rotated, revocable HTTP-only refresh sessions
- Authorization: organization-scoped RBAC
- Storage: private server-side attachment storage

## No mock data

This repository contains **no demo accounts, seed incidents, sample organizations, or fabricated production records**. A deployment starts empty and must be provisioned through real administrative workflows or controlled database provisioning.

## Local development

1. Install Node 20+ and pnpm 10+.
2. Copy `.env.example` to `packages/backend/.env` and replace every secret/value.
3. Install dependencies:

```bash
pnpm install
```

4. Generate Prisma client and apply migrations:

```bash
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:migrate
```

5. Start the application:

```bash
pnpm dev
```

The Vite development server proxies `/api/*` to the API.

## Production deployment

Set real environment variables. Never deploy the example values.

Required:

- `DATABASE_URL`
- `JWT_SECRET` with at least 32 random characters
- `JWT_REFRESH_SECRET` with a different at least 32-character random value
- `WEB_ORIGIN`
- `EMAIL_WEBHOOK_URL`
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` when using Docker Compose

Apply migrations with:

```bash
pnpm --filter backend prisma:migrate:deploy
```

Then build and run the API and web containers. The API exposes `/health` for liveness and `/ready` for database readiness.

## Email delivery

The API uses an email webhook contract instead of embedding a vendor SDK. Configure `EMAIL_WEBHOOK_URL` to a trusted internal mail service or email provider adapter. The webhook receives the event type, recipient, verification/reset token, and generated application URLs. In production, registration/reset fails safely if email delivery is not configured.

## Security controls

- Organization context is embedded in access tokens and selected explicitly at login for multi-organization users.
- Refresh sessions are stored server-side, hashed, rotated, and revocable.
- Refresh credentials use an HTTP-only cookie and are not stored in browser localStorage.
- Access tokens are held in memory by the web client.
- CORS is restricted to `WEB_ORIGIN`.
- Security response headers and a restrictive CSP are enabled by the API.
- Authentication endpoints are rate limited.
- Passwords use bcrypt with cost 12.
- Verification/reset tokens are stored hashed and expire.
- Attachments are stored outside the public web root and require incident authorization for download.
- Tenant identifiers are never accepted from client-controlled mutation payloads.
- Incident transitions enforce role and assignment boundaries.
- Audit events are written for core lifecycle actions, comments, progress updates, and attachments.
- `/ready` checks database availability.

## Production checklist

Before public launch, configure TLS at the reverse proxy/load balancer, centralized logs and alerting, encrypted PostgreSQL backups, persistent/private attachment storage, email delivery monitoring, secret management, vulnerability scanning, dependency update automation, and a disaster recovery procedure.

The application code is designed for production deployment, but infrastructure security and operational controls remain deployment responsibilities.
