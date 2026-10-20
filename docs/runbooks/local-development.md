# Runbook — Local development

Last updated: 2026-10-20

## Prerequisites

- **Node 24** (`.nvmrc`). `node -v` should print `v24.x`.
- **Docker** via OrbStack (recommended on macOS) or Docker Desktop. `docker info` must work.
- The Supabase CLI is a pinned dev dependency (`npx supabase …`); no global install needed.

## First run

```sh
npm ci
cp .env.example .env.local
npm run db:start      # first run downloads images (several minutes)
npm run dev
```

Open http://localhost:3000 and sign in with a seeded user (password `local-dev-password`):

| Email | Role | TOTP |
|---|---|---|
| `owner@example.test` | owner | enrolled |
| `viewer@example.test` | viewer | enrolled |
| `enroll@example.test` | member | not enrolled — exercises the enrollment flow |
| `outsider@example.test` | none | enrolled — sees "No workspace access" |

All seeded data is synthetic and local only. The shared TOTP secret is
`LOCAL_TOTP_SECRET` in `tests/e2e/fixtures.ts`. To get a code without an authenticator app:

```sh
node -e "import('otpauth').then(({TOTP})=>console.log(new TOTP({secret:'PIONEERLOCALDEVTOTPSECRET234567A'}).generate()))"
```

Supabase Studio (local DB browser): http://127.0.0.1:54323.

## Everyday commands

| Task | Command |
|---|---|
| Reset DB to migrations + seed | `npm run db:reset` |
| New migration | `npx supabase migration new <name>` → edit SQL → `npm run db:reset` → `npm run db:types` |
| Database tests | `npm run db:test` |
| Unit tests | `npm test` |
| E2E tests (reuses a running `npm run dev`) | `npm run test:e2e` |
| E2E exactly as CI (production build) | `CI=1 npm run test:e2e` |
| Full check before a PR | `npm run lint && npm run format:check && npm run typecheck && npm test && npm run db:lint && npm run db:test && npm run test:e2e` |

## Notes

- **Sign-up is disabled** (`supabase/config.toml`). `[auth.email] enable_signup` must stay
  `true` — it enables the email provider itself; `[auth] enable_signup = false` blocks
  sign-ups.
- **Explicit grants.** New tables are not reachable by the API until a migration grants
  access (`auto_expose_new_tables = false` plus revoked default privileges). Every new table
  needs RLS, an MFA restrictive policy, grants and pgTAP tests (docs/schema.md §10).
- **TOTP replay.** Supabase Auth rejects a code already used in the same 30-second window;
  the E2E helper `freshTotpCode` waits for a new window when needed.
- **Next.js 16.4.** Read the bundled docs in `node_modules/next/dist/docs/` before using a
  framework API (see AGENTS.md). Cache Components is off (decisions.md D-18).
- **Install scripts.** npm 11 requires approving dependency install scripts; `esbuild`,
  `unrs-resolver` and `fsevents` are denied (`allowScripts` in package.json) — none are
  needed.
