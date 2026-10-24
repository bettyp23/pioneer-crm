# pioneer-crm
Pioneer Digital AI custom CRM (Next.js + Supabase)

Pioneer OS is a private, internal CRM and service-operations platform. Start with the docs:

- [Requirements](docs/requirements.md)
- [Architecture](docs/architecture.md) (includes the screen map)
- [Schema](docs/schema.md)
- [Security](docs/security.md)
- [Decisions and open questions](docs/decisions.md)
- [Milestone 1 plan](docs/milestone-1-plan.md)
- Runbooks: [local development](docs/runbooks/local-development.md) ·
  [bootstrap the owner](docs/runbooks/bootstrap-owner.md)

## Quick start (local)

Requirements: Node 24 (`.nvmrc`), Docker (OrbStack or Docker Desktop).

```sh
npm ci
cp .env.example .env.local      # local Supabase defaults; no real secrets
npm run db:start                # local Supabase in Docker: migrations + synthetic seed
npm run dev                     # http://localhost:3000
```

Sign in with a seeded synthetic user, e.g. `owner@example.test` / `local-dev-password`.
The TOTP secret for seeded users is in [tests/e2e/fixtures.ts](tests/e2e/fixtures.ts) —
add it to an authenticator app, or see the local development runbook.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / serve the build |
| `npm run lint` · `format` · `format:check` · `typecheck` | ESLint (incl. import boundaries) · Prettier · TypeScript |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) against the local stack |
| `npm run db:start` · `db:stop` | Start/stop the local Supabase stack |
| `npm run db:reset` | Recreate the local DB from migrations + `supabase/seed.sql` |
| `npm run db:test` | Database tests (pgTAP): RLS, grants, triggers |
| `npm run db:lint` | Supabase schema linter |
| `npm run db:types` | Regenerate `src/server/db/database.types.ts` after a migration |
| `npm run bootstrap:owner` | Provision the owner account + workspace ([runbook](docs/runbooks/bootstrap-owner.md)) |

## Environment variables

See [.env.example](.env.example).

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | app (browser + server) | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | app (browser + server) | Publishable key; RLS protects data |
| `SUPABASE_SECRET_KEY` | `bootstrap:owner` only | Bypasses RLS. Never in the app runtime, never `NEXT_PUBLIC_` |
| `BOOTSTRAP_*` | `bootstrap:owner` only | Owner email/name, workspace name/slug |

## Working rules

Feature branches and pull requests only. Nothing is merged to `main` or deployed to
production without the owner's explicit authorization. Fixtures and seeds are synthetic.
