# Milestone 1 — Implementation Plan

Scope: repository, documentation, authentication, workspace model, database migrations,
protected dashboard shell. Status: **Implemented — awaiting owner review** (approved to start
2026-10-20) · Last updated: 2026-10-20

Prerequisites: decisions D-1, D-11, D-12 accepted 2026-10-19 (see [decisions.md](decisions.md)); Docker + Supabase CLI installed locally.
D-4/D-5/D-14 can wait — M1 runs entirely on the local Supabase stack.

## 1. Branching

- Branch `feat/m1-foundation` from `main` after this docs PR is reviewed.
- One PR with commits grouped by step below (reviewable in order). Nothing merged or
  deployed without owner authorization.

## 2. Steps

### Step 1 — Toolchain and scaffold
- `.nvmrc` (Node 24 LTS), `engines` in `package.json`.
- `create-next-app` (TypeScript, App Router, `src/`, Tailwind, ESLint); TypeScript `strict`,
  `noUncheckedIndexedAccess`.
- Verify and pin current stable versions of: next, react, @supabase/ssr,
  @supabase/supabase-js, supabase CLI, zod, react-hook-form, @hookform/resolvers, tailwindcss,
  vitest, @playwright/test. Record the versions in the PR description.
- `shadcn` init; add button, input, label, form, card, dropdown-menu, sheet, sidebar, sonner.
- Prettier, ESLint import-boundary rules (architecture.md §3), `server-only` package.
- `.env.example`, `.gitignore` for `.env*`.

### Step 2 — Local Supabase
- `supabase init`; `config.toml`: `enable_signup = false`, TOTP MFA enroll/verify enabled,
  `site_url`/redirects for localhost, minimum password length 12.
- npm scripts: `db:start`, `db:reset`, `db:test`, `db:types`.

### Step 3 — Migrations
1. `…_extensions_and_private.sql` — `citext`, `pg_trgm`; `private` schema; revoke default
   privileges from `anon`/`authenticated`; `set_updated_at`, `bump_version` triggers.
2. `…_workspaces.sql` — enums, `workspaces`, `profiles`, `workspace_members`,
   `private.role_rank`, `private.has_role`, `private.is_mfa`, last-owner trigger, RLS + grants.
3. `…_audit.sql` — `audit_events`, `private.log_event`, `private.audit_row_change`; triggers on
   `workspace_members` and `workspaces`; RLS (owner/admin read), no write grants.
- `seed.sql`: synthetic workspace "Demo Workspace", owner `owner@example.test` with a known
  TOTP secret (local only), a viewer and a non-member user for tests.
- Generate `database.types.ts`.

### Step 4 — Supabase clients and session
- `src/server/db/server-client.ts` (cookie `getAll`/`setAll`), `src/lib/supabase/browser-client.ts`.
- `src/proxy.ts`: refresh session; redirect unauthenticated to `/login` (excludes static
  assets and `/login`).
- `src/server/auth/session.ts`: `getUser()` via `getClaims()`, `requireMember()` (aal2 +
  active membership), `requireRole(permission)`; `permissions.ts` matrix.

### Step 5 — Auth screens
- `/login`: RHF + Zod form; generic error message (no account enumeration).
- `/login/mfa`: enroll (QR + secret, verify first code) or challenge/verify.
- Sign-out route handler (POST).
- `scripts/bootstrap-owner.ts`: reads secret key from env, creates the auth user (if absent),
  workspace, profile and owner membership in one idempotent run; prints next steps. Run
  manually; documented in `docs/runbooks/bootstrap-owner.md`.

### Step 6 — Protected shell
- `(app)/layout.tsx` calls `requireMember()`; sidebar with all modules from the screen map
  (unbuilt modules shown as "Coming in M#", not links to broken pages); header with workspace
  name and user menu.
- `/dashboard`: empty-state cards for the future widgets.
- `/settings/workspace` (read; owner can edit name/timezone), `/settings/members` (read-only
  list), `/settings/security` (MFA factors), `/settings/audit` (owner/admin, paginated).

### Step 7 — Hardening
- Security headers + CSP in `next.config.ts`; `robots.txt` disallow; `noindex`.
- Error boundary and not-found pages that don't leak details.

### Step 8 — Tests and CI
- **pgTAP** (`supabase/tests`): anon has no access; non-member sees no workspace rows; viewer
  cannot update; `aal1` session sees nothing; last owner cannot be removed/demoted; audit
  events written on membership change and cannot be inserted/updated/deleted by
  `authenticated`; `private` functions not executable by `anon`.
- **Vitest**: Zod schemas, permissions matrix, URL validators.
- **Playwright**: unauthenticated redirect; login → MFA verify (TOTP from seeded secret) →
  dashboard; viewer cannot see audit page; sign-out; security headers present.
- **GitHub Actions** `ci.yml`: `npm ci` → lint → typecheck → vitest → `supabase start` →
  `db reset` → `db test` → Playwright. (Early version of M7 CI — no deploy steps.)

### Step 9 — Docs
- README: setup, scripts, environment variables.
- `docs/runbooks/local-development.md`, `docs/runbooks/bootstrap-owner.md`.
- Update schema.md (as-built M1), decisions.md, limitations.

## 3. Explicitly not in M1

Business tables (clients, etc.), member invitations, Vercel/Supabase cloud provisioning,
production deployment, Google Drive or Grok integration.

## 4. Risks

| Risk | Mitigation |
|---|---|
| Framework/library API changes since this plan (Next proxy, Supabase keys, Tailwind/shadcn) | Verify against current docs at Step 1; adjust and note in PR |
| MFA complicates E2E tests | Seed a known TOTP secret locally; generate codes in test |
| Docker unavailable locally | Supabase CLI requires Docker Desktop/OrbStack — confirm installed |

## 5. Acceptance criteria and evidence

Evidence for each criterion is listed in the PR description (§7 below summarizes
deviations from this plan).

| # | Criterion | Evidence |
|---|---|---|
| A1 | App builds, lints and typechecks with pinned versions | CI log |
| A2 | Migrations apply cleanly from scratch (`db reset`) | CI log |
| A3 | Sign-up is impossible; login requires password + TOTP | Playwright spec + config.toml diff |
| A4 | Unauthenticated and `aal1` users cannot reach the shell or read any row | Playwright + pgTAP |
| A5 | Non-members and lower roles are denied by RLS as per the matrix | pgTAP results |
| A6 | Last owner cannot be removed; membership changes are audited; audit is append-only | pgTAP results |
| A7 | Bootstrap script is idempotent (two runs → one user/workspace/membership) | Script run log against local stack |
| A8 | Shell, settings and audit pages render for the owner | Screenshots |
| A9 | Security headers present | Playwright assertion |
| A10 | No secrets committed; `.env.example` complete | Repo review |
| A11 | Docs updated (README, runbooks, schema as-built, decisions) | PR diff |

## 6. As-built notes (2026-10-20)

Deviations from the plan above, each verified against the bundled Next.js 16.4 docs or the
installed library:

- **Branch base:** `feat/m1-foundation` was branched from `docs/m0-architecture-and-plan`
  (the docs PR is not merged yet), so this PR also contains the M0 docs commits until that
  PR is merged.
- **CSP lives in `src/proxy.ts`**, not `next.config.ts`: a per-request nonce requires it.
  Static headers (HSTS, nosniff, referrer, frame, permissions, robots) are in `next.config.ts`.
- **Cache Components off** (decisions.md D-18); root layout calls `connection()`.
- **shadcn `form` → `field`:** current shadcn replaced the `form` component with `field`;
  `input-otp`, `badge`, `table`, `alert`, `separator`, `tooltip`, `skeleton` were added too.
- **`@hookform/resolvers` 5.9.1**, not 6.0.0 (published the day before, with peer conflicts).
- **Permission denials on pages render 404** (`notFound()`); `forbidden()` is still
  experimental in Next 16.4.
- **`[auth.email] enable_signup` stays `true`** — setting it to `false` disables email login
  entirely; sign-up is blocked by `[auth] enable_signup = false` (verified by an E2E test).
- **Extra seed user** `enroll@example.test` (member, no TOTP) exercises the enrollment flow.
- **`/no-access`** page for signed-in users without an active membership.
- **TypeScript 5.9.3** (TypeScript 7 is out but `create-next-app` 16.4 targets 5.x).
