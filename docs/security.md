# Pioneer OS — Security

Status: **Draft for owner review** · Last updated: 2026-10-19

## 1. Assets and threats

| Asset | Main threats |
|---|---|
| Client, contact and pipeline data | Account takeover, authorization bugs, data leakage to AI tools, leaked keys |
| Contract (SOW) references and approvals | Tampering, repudiation ("who approved this?") |
| Delivery state | Unsafe automatic transitions, duplicate generation, race conditions |
| Supabase secret key, Vercel/GitHub access | Credential leak via repo, logs, preview deployments, AI tools |
| Audit log | Tampering or deletion to hide changes |

Primary adversaries: credential stuffing/phishing against the owner account; bugs that
bypass authorization; accidental disclosure (copying data into AI tools, public Drive
links, logs); compromised dependencies.

## 2. Authentication

- Supabase Auth, email + password. **Public sign-up disabled** in project settings and in
  `supabase/config.toml`. Users are provisioned by the owner (bootstrap script now;
  invite flow later).
- **TOTP MFA required.** Enforced in the database: every business table has a restrictive
  RLS policy requiring `aal = 'aal2'`. The app redirects `aal1` sessions to MFA.
- Password policy: minimum 12 characters, leaked-password protection enabled (Supabase
  setting, plan-dependent), Supabase auth rate limits left on.
- Server code verifies the JWT with `supabase.auth.getClaims()`; `getSession()` data is
  never trusted server-side.
- Session cookies: HttpOnly, Secure, SameSite=Lax (managed by `@supabase/ssr`).
- Auth redirect URLs restricted to the production domain, staging domain and localhost.

## 3. Authorization

- **Layer 1 — application:** `requireMember()` / `requireRole(permission)` in
  `src/server/auth`. Every Server Action and Route Handler authorizes and validates with
  Zod before any data access. The role/permission matrix lives in one file
  (`permissions.ts`) and has unit tests.
- **Layer 2 — database:** RLS on every table in `public`; policies use
  `private.has_role(workspace_id, min_role)`. Column-level grants prevent direct updates of
  rule-bearing columns (`status`, `version`, `published_at`, …); those change only through
  RPC functions that enforce rules.
- `security definer` functions are rare, live in `private` (not exposed by the Data API)
  or explicitly re-check `auth.uid()` and role, always `set search_path = ''`, and
  `revoke execute ... from public, anon`.
- Views use `security_invoker = true` so RLS applies.
- `anon` has no privileges on application objects.

Role matrix (initial):

| Capability | owner | admin | member | viewer |
|---|:-:|:-:|:-:|:-:|
| Read business records | ✓ | ✓ | ✓ | ✓ |
| Create/edit clients, leads, activities, tasks | ✓ | ✓ | ✓ | |
| Configure pipeline stages | ✓ | ✓ | | |
| Manage service catalog and blueprint drafts | ✓ | ✓ | | |
| Publish/retire blueprint versions | ✓ | ✓ | | |
| Generate projects | ✓ | ✓ | | |
| Decide internal approvals | ✓ | ✓ | | |
| Record SOW as signed | ✓ | | | |
| Manage members, workspace settings | ✓ | | | |
| View audit log | ✓ | ✓ | | |
| Hard delete | ✓ | | | |
| Dispatch / accept agent work | ✓ | ✓ | | |

## 4. Keys and secrets

| Secret | Where it lives | Never |
|---|---|---|
| Supabase publishable key, URL | Vercel env, `NEXT_PUBLIC_*` | — (public by design; RLS protects data) |
| Supabase secret (service-role) key | Owner's password manager; local `.env.local` only when running `bootstrap-owner`; **not** in Vercel runtime env unless a later reviewed feature needs it | `NEXT_PUBLIC_*`, repo, logs, AI tools |
| `CRON_SECRET` (M5) | Vercel env (production, staging separately) | Repo |
| DB password | Password manager; CI secret for staging migrations | Repo, chat tools |

- `.env*` (except `.env.example`) in `.gitignore`. GitHub secret scanning and push
  protection enabled on the repository.
- Preview/staging deployments use only staging Supabase credentials.
- Rotation procedure documented in `docs/runbooks/` (M7); rotate immediately on suspected
  exposure.

## 5. Data integrity and auditability

- Foreign keys, check constraints and unique constraints on all business tables.
- Immutable records enforced by triggers: published blueprint versions and their templates,
  signed SOW references, decided approvals, audit events.
- Idempotency keys for project generation; unique constraints for routine occurrences;
  optimistic concurrency (`version`) for task/approval transitions.
- No automatic state transitions of consequence (task status, project status, approvals,
  SOW status). Cron jobs only create routine occurrences.
- Audit events for: membership/role changes, client status changes, stage changes,
  blueprint publish/retire, SOW status changes, project generation, task transitions,
  approval decisions, input waivers, invoice status, agent dispatch/review, hard deletes.

## 6. Data handling rules

- **No PHI.** Pioneer OS is not covered by a BAA. Free-text fields show a reminder; if a
  client is a healthcare organization, record business information only.
- **No payment card data, bank details or tax IDs.** Invoices are metadata pointing to the
  external system of record.
- **No secrets or client credentials.** Record only that access was granted and where the
  credential is stored (e.g., "1Password: Client X — WordPress admin").
- **Fixtures and seeds are synthetic.** No real client names, emails, prices or contracts
  in `seed.sql`, tests, screenshots or docs.
- **Google Drive:** store links only. Drive sharing settings remain the access control;
  documents must not use "anyone with the link". URLs are validated to Google hosts.
- Logs contain IDs and error codes, not record contents or PII.

## 7. AI agents (Grok Bot and others)

- Agents never receive Supabase credentials, API keys, DB access or a user session.
- Work items carry a **curated context snapshot** chosen by a human — not a live query.
  Default context excludes contact emails/phones, notes, invoice data and SOW details unless
  explicitly added.
- A pre-dispatch scanner flags emails, phone numbers, URLs with tokens, key-like strings,
  card-like numbers, and healthcare terms; flagged items need explicit override with a reason
  (audited).
- Dispatch is manual in the M6 prototype (copy/export). Any future API integration must be
  outbound-only from the server with an allowlisted payload, and requires a separate
  security review and owner approval.
- Agent output is a proposal; a human accepts or rejects it. No agent output triggers writes
  automatically.
- Development: no real client data, PHI, card data or secrets are pasted into AI coding
  tools (including this assistant).

## 8. Web application hardening

- Security headers via `next.config`: `Content-Security-Policy` (nonce-based scripts; tight
  `connect-src` to the Supabase project), `Strict-Transport-Security`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `frame-ancestors 'none'`, `Permissions-Policy` minimal.
- Server Actions: rely on Next.js origin checks; configure `serverActions.allowedOrigins`
  only for known domains.
- `robots.txt` disallow all; `X-Robots-Tag: noindex`.
- Vercel: Deployment Protection on previews; production domain only for the app.
- No user-generated HTML rendering; Markdown (if added) is sanitized.

## 9. Supply chain

- Pinned versions with committed lockfile; `npm ci` in CI.
- Dependabot (or Renovate) for security updates; `npm audit --omit=dev` in CI (high+ fails).
- Minimal dependency footprint; new runtime dependencies noted in PR descriptions.
- GitHub: branch protection on `main` (PR required, CI green, no force push), 2FA on the
  account.

## 10. Backups and recovery (finalized in M7)

- Supabase daily backups (Pro) and optional point-in-time recovery (D-5).
- Additional encrypted `pg_dump` of the production database on a schedule to owner-controlled
  storage.
- Quarterly restore drill into a scratch project; record RPO/RTO achieved.
- Migrations are forward-only; risky migrations are rehearsed on staging with a fresh backup
  taken first.

## 11. Verification

| Control | Verified by |
|---|---|
| RLS/grants per table and role | pgTAP tests in CI |
| MFA enforcement | pgTAP (`aal1` claims) + Playwright |
| Immutability triggers | pgTAP |
| Idempotent generation / concurrency | pgTAP + Vitest integration test with parallel calls |
| Authz matrix | Vitest |
| Headers | Playwright response assertions |
| No secrets in repo | GitHub secret scanning + CI `gitleaks` (optional) |
| Supabase advisors | `supabase db lint` / Security Advisor review each milestone |
