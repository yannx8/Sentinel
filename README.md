# Sentinel

A production-oriented incident reporting and tracking platform for organizations. Sentinel gives employees a structured way to report incidents, while administrators and responsables can triage, assign, investigate, resolve, and audit the full incident lifecycle within an organization-scoped workspace.

## Highlights

- Organization-scoped incident management
- Role-based access control with `USER`, `RESPONSABLE`, and `ADMINISTRATOR` roles
- Incident lifecycle tracking from `NEW` through `CLOSED`
- Site-aware incident reporting with GPS, fallback, and manual-pin location sources
- Responsable assignment, acceptance, reassignment, and site authorization
- Progress updates, comments, attachments, notifications, and audit events
- Short-lived access tokens with server-side, revocable refresh sessions
- Private attachment storage outside the public web root
- REST API with consistent response, pagination, validation, and error conventions
- Responsive React web application and an Expo/React Native mobile application
- PostgreSQL persistence through Prisma ORM

> Sentinel starts without demo accounts, seeded incidents, or fabricated production records. A new deployment must be provisioned through real administrative workflows.

## Architecture

Sentinel is a TypeScript monorepo built as a modular monolith:

```text
React + TypeScript + Vite
            |
            | HTTP / REST
            v
Node.js + Express + TypeScript
            |
            | Prisma ORM
            v
PostgreSQL
```

The web application is served by Vite during development and by Nginx in the production container. The API exposes health and readiness endpoints and serves versioned REST resources under `/api/v1`.

The mobile application is an Expo and React Native client. It shares types with the web and backend packages through `@sentinel/shared`.

## Technology stack

- **Language:** TypeScript, with JavaScript entry files in the mobile app
- **Web:** React 18, Vite, React Router, Tailwind CSS, Zustand
- **API:** Node.js, Express 5, Zod, JWT, bcryptjs, Multer
- **Database:** PostgreSQL 16 and Prisma 6
- **Maps and charts:** Leaflet, React Leaflet, Recharts
- **Mobile:** Expo 57, React Native 0.86, React Navigation, Expo Secure Store
- **Testing:** Vitest and Supertest
- **Package manager:** pnpm 10
- **Deployment:** Docker, Docker Compose, and Nginx

## Repository structure

```text
.
├── apps/
│   └── mobile/              Expo and React Native mobile client
├── packages/
│   ├── backend/             Express API, Prisma schema, migrations, and tests
│   ├── frontend/            React web application and Vite configuration
│   └── shared/              Shared TypeScript types and API contracts
├── docs/
│   ├── architecture.md      Runtime architecture and security boundaries
│   ├── api-conventions.md   REST routes, responses, errors, and pagination
│   ├── database-domain-model.md
│   └── git-workflow.md
├── postman/                 Postman API collections and environments
├── .env.example             Environment variable template
├── docker-compose.yml       PostgreSQL, API, and frontend services
├── Dockerfile               Production API image
├── Dockerfile.frontend      Production frontend image
├── nginx.conf               Frontend serving and API proxy rules
├── package.json              Root workspace scripts
└── pnpm-workspace.yaml      pnpm workspace definition
```

## Incident lifecycle

Incidents follow a controlled server-side state machine:

```text
NEW -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> CLOSED
```

- A `USER` can submit incidents within their organization.
- An `ADMINISTRATOR` can manage organization incidents and assignments.
- A `RESPONSABLE` works on incidents assigned to them and within their authorized sites.
- Assignment history is preserved. Reassignment does not destroy previous records.
- Progress updates, comments, attachments, and audit events remain associated with the incident.

The original incident submission and subsequent operational changes are kept distinguishable through the incident domain model and audit history.

## Security model

Tenant isolation and authorization are enforced by the backend, not by the web or mobile clients.

- Organization context comes from the verified session and is never trusted from mutation payloads.
- Backend service and data-access code applies organization scope to tenant-owned resources.
- Access tokens are short-lived JWTs.
- Refresh sessions are stored server-side as hashes and can be rotated or revoked.
- Refresh credentials use an HTTP-only cookie.
- Access tokens are held in web-client memory rather than browser local storage.
- Passwords are protected with bcrypt.
- Authentication endpoints are rate limited.
- Verification and reset tokens are stored hashed and expire.
- CORS is restricted to `WEB_ORIGIN`.
- Attachments require incident authorization and are stored privately.
- Production deployments must use unique secrets and TLS at the reverse proxy or load balancer.

## Prerequisites

For local development, install:

- Node.js 20 or newer
- pnpm 10 or newer
- PostgreSQL 16, or Docker with Docker Compose

## Local development

### 1. Clone and install dependencies

```bash
git clone https://github.com/yannx8/Sentinel.git
cd Sentinel
pnpm install
```

### 2. Configure the backend

Copy the backend environment template:

```bash
cp packages/backend/.env.example packages/backend/.env
```

Set at least the following values in `packages/backend/.env`:

```dotenv
DATABASE_URL=postgresql://user:password@localhost:5432/nexus_incidents
JWT_SECRET=replace-with-a-random-string-at-least-32-characters-long
JWT_REFRESH_SECRET=replace-with-another-random-string-at-least-32-characters
PORT=4000
NODE_ENV=development
WEB_ORIGIN=http://localhost:5173
STORAGE_PATH=./uploads
```

Use different, randomly generated values for `JWT_SECRET` and `JWT_REFRESH_SECRET`. Do not commit `.env` files or production credentials.

### 3. Start PostgreSQL

Using Docker Compose:

```bash
docker compose up -d db
```

The development database uses the following defaults from `docker-compose.yml`:

```text
Database: nexus_incidents
User:     nexus
Password: nexus_secret
Port:     5432
```

Update `DATABASE_URL` if your local database uses different credentials.

### 4. Generate Prisma Client and apply migrations

```bash
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:migrate
```

The migration command creates or applies a local development migration. The repository does not include fabricated seed records.

### 5. Start the web application and API

```bash
pnpm dev
```

This starts both applications in parallel:

- Web application: http://localhost:5173
- API: http://localhost:4000

The Vite development server proxies `/api` requests to the API server.

## Useful commands

Run commands from the repository root unless noted otherwise.

```bash
# Start backend and frontend in development mode
pnpm dev

# Build every workspace package
pnpm build

# Run workspace tests
pnpm test

# Generate the Prisma client
pnpm --filter backend prisma:generate

# Create or apply a development migration
pnpm --filter backend prisma:migrate

# Apply committed migrations in a deployment environment
pnpm --filter backend prisma:migrate:deploy

# Backend tests
pnpm --filter backend test

# Frontend tests
pnpm --filter frontend test

# Frontend type checking
pnpm --filter frontend typecheck

# Mobile type checking
pnpm --filter mobile typecheck
```

## Docker deployment

Docker Compose starts PostgreSQL, the API, and the Nginx-served frontend:

```bash
export JWT_SECRET="replace-with-a-random-secret-of-at-least-32-characters"
export JWT_REFRESH_SECRET="replace-with-a-different-random-secret-of-at-least-32-characters"
export WEB_ORIGIN="http://localhost"
docker compose up --build
```

Once the containers are ready:

- Frontend: http://localhost
- API through Nginx: http://localhost/api/v1
- Liveness: http://localhost/health
- Database readiness: http://localhost/ready
- PostgreSQL: localhost:5432

The API image runs `prisma migrate deploy` before starting the server. For production, replace all example credentials, provide persistent database and attachment storage, configure TLS, and use an external secret-management strategy appropriate for your deployment.

## Environment variables

The complete templates are available in `.env.example` and `packages/backend/.env.example`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Access-token signing secret, minimum 32 characters |
| `JWT_REFRESH_SECRET` | Refresh-token signing secret, different from `JWT_SECRET` |
| `PORT` | API port, normally `4000` |
| `NODE_ENV` | `development`, `test`, or `production` |
| `STORAGE_PATH` | Private local attachment storage path |
| `WEB_ORIGIN` | Allowed frontend origin for CORS |
| `TRUST_PROXY` | Whether Express trusts the deployment proxy |
| `ACCESS_TOKEN_TTL` | Access-token lifetime, for example `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | Refresh-session lifetime, for example `7` |
| `EMAIL_WEBHOOK_URL` | Optional trusted webhook for verification and reset email delivery |

## API conventions

The documented API base path is:

```text
/api/v1
```

Resources use plural nouns and nested sub-resources, for example:

```text
GET    /api/v1/incidents
GET    /api/v1/incidents/:incidentId
POST   /api/v1/incidents/:incidentId/comments
GET    /api/v1/incidents/:incidentId/assignments
GET    /api/v1/sites
```

Successful responses use a `data` envelope. Collections include pagination metadata:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Errors use a consistent envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body is invalid",
    "details": []
  }
}
```

See [`docs/api-conventions.md`](docs/api-conventions.md) for the complete route, validation, pagination, and error contract.

## Mobile application

The mobile client is located in `apps/mobile` and uses Expo, React Native, React Navigation, and Expo Secure Store.

```bash
cd apps/mobile
pnpm install
pnpm start
```

Available mobile scripts:

```bash
pnpm start       # Start the Expo development server
pnpm android     # Start on Android
pnpm ios         # Start on iOS
pnpm web         # Start the web target
pnpm typecheck   # Run TypeScript checking
```

Configure the mobile API base URL in the mobile client before connecting it to a non-local backend.

## Testing and quality

Backend tests use Vitest and Supertest. The backend test configuration disables file parallelism to avoid exhausting a local PostgreSQL connection pool:

```bash
pnpm --filter backend test
```

Before opening a pull request, run:

```bash
pnpm build
pnpm test
pnpm --filter frontend typecheck
pnpm --filter mobile typecheck
```

## Documentation

- [Application architecture](docs/architecture.md)
- [API conventions](docs/api-conventions.md)
- [Database domain model](docs/database-domain-model.md)
- [Git workflow](docs/git-workflow.md)
- [Postman resources](postman/)

## Operational notes

Before exposing Sentinel publicly:

1. Replace every example secret and database password.
2. Configure TLS at the reverse proxy or load balancer.
3. Configure persistent, private attachment storage.
4. Configure encrypted PostgreSQL backups and recovery testing.
5. Set up centralized logs, metrics, and alerting.
6. Configure and monitor email delivery if verification or reset emails are enabled.
7. Confirm that `/health` and `/ready` are monitored independently.
8. Review organization membership, role, and site authorization workflows.

## License

The mobile application includes an MIT license file. Confirm the intended license for the complete repository before distributing the web or backend packages.
