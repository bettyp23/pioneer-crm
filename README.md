# pioneer-crm
Pioneer Digital AI custom CRM (Next.js + Supabase)

## Current version: minimal (chat with Michael)

`main` is deliberately cut down to one page: sign in (email + password + 6-digit code), then the
**Dashboard**, which is a direct chat with Michael Scott (Grok). Messages go out and replies come
back through the worker on the owner's Mac (`npm run worker`), so the Mac must be on for replies.

The app is mounted at `/login` (`basePath`), including its assets. Public sign-in is
`/login`, the code page is `/login/mfa`, and the chat is `/login/dashboard`. The native
Cloudflare Worker is `pioneer-crm-login` (`cloudflare.config.ts`). Attach
`pioneerdigitalai.com/login` and `pioneerdigitalai.com/login/*` only after the Worker build
and GitHub CI pass. Do not route `/`, `/_next`, or `/api`.

Install it as an app: on iPhone open the site in Safari → Share → **Add to Home Screen**; on a
laptop use Chrome/Edge → the install icon in the address bar.

The full CRM (clients, pipeline, projects, operations, agents, settings) is kept on the
`archive/full-pioneer-os` branch. The database schema and worker are unchanged, so those pages
can be brought back without data loss. The docs below describe the full system.

Pioneer OS is a private, internal CRM and service-operations platform. Start with the docs:

- [Requirements](docs/requirements.md)
- [Architecture](docs/architecture.md) (includes the screen map)
- [Schema](docs/schema.md)
- [Security](docs/security.md)
- [Decisions and open questions](docs/decisions.md)
- [Milestone 1 plan](docs/milestone-1-plan.md) · [Milestone 2 plan](docs/milestone-2-plan.md) · [Milestone 3 plan](docs/milestone-3-plan.md) · [Milestone 4 plan](docs/milestone-4-plan.md) · [Milestone 5 plan](docs/milestone-5-plan.md) · [Milestone 6 plan](docs/milestone-6-plan.md) · [Milestone 7 plan](docs/milestone-7-plan.md)
- **Pioneer OS 3.0** (Hermes, integrations, roadmap): [overview](docs/os3/README.md) · [setup and purchasing guide](docs/os3/PIONEER_OS_SETUP_GUIDE.md)
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
