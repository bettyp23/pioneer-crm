# Pioneer OS — Decisions and Open Questions

Status legend: **OPEN** (needs owner approval) · **PROPOSED** (default unless you object) ·
**ACCEPTED**. Each entry gives a recommendation. Last updated: 2026-10-20.

## Needs owner approval before or during Milestone 1

| ID | Decision | Recommendation | Status |
|---|---|---|---|
| D-1 | Login method | Email + password + **required TOTP MFA**, enforced in RLS (`aal2`). Magic links are weaker for a single high-value account (email compromise = account compromise). | ACCEPTED 2026-10-19 |
| D-2 | Lead vs client model | A lead is an *opportunity* attached to a client record (status `prospect` until won). Avoids a lead→client conversion step and duplicate contact data. | ACCEPTED 2026-10-20 |
| D-4 | Environments | Local (Supabase CLI) + **separate staging Supabase project** for Vercel previews + production project. Alternative: Supabase Branching (more automation, more moving parts and cost). | OPEN |
| D-5 | Supabase plan, region, backups | Supabase Pro (no pausing, daily backups); evaluate PITR add-on at M7. Supabase and Vercel functions in the same region (e.g., `us-east-1` / `iad1`). | OPEN |
| D-11 | Workspace timezone | `America/New_York` (confirmed). | ACCEPTED 2026-10-19 |
| D-12 | Node.js version | Local Node is 20.14 (end-of-life since April 2026). Standardize on Node 24 LTS via `.nvmrc` and Vercel project setting. | ACCEPTED 2026-10-19 |
| D-13 | Production domain | Needed for auth redirect URLs and CSP (e.g., `os.<your-domain>`). Can be decided by M7; staging uses the Vercel URL. | OPEN |
| D-14 | Supabase/Vercel/GitHub provisioning | M1 runs fully local. Creating the staging Supabase project and linking Vercel are infrastructure actions I will not take without your go-ahead. | OPEN |
| D-18 | Next.js Cache Components | Next 16.4 scaffolds with `cacheComponents: true`. Every Pioneer OS page is private and per-user, and the nonce-based CSP needs request-time rendering, so it is **off** (`next.config.ts`) and the root layout calls `connection()`. Revisit when Next makes it mandatory (announced for the next major). | ACCEPTED 2026-10-20 |

## Needed before later milestones

| ID | Decision | Recommendation | Milestone | Status |
|---|---|---|---|---|
| D-3 | Pipeline stages | Owner-configurable table seeded with Inquiry, Discovery, Proposal, Negotiation, Won, Lost. Please supply your real stages. | M2 | ACCEPTED 2026-10-20 (default six) |
| D-6 | SOW required to generate a project? | Yes — require a `signed` SOW, except an explicit "internal / pilot" flag with a reason (audited). | M4 | OPEN |
| D-7 | Do cancelled prerequisite tasks unblock dependents? | Yes, but cancelling a task that has dependents requires confirmation listing them, and is audited. | M4 | OPEN |
| D-8 | Blueprints per project | One project = one blueprint version for MVP. Packages map to one blueprint; multi-blueprint projects deferred. | M3/M4 | OPEN |
| D-9 | Invoice system of record | Which tool issues invoices (QuickBooks, Stripe, Wave, other)? Pioneer OS stores metadata + link only. | M5 | OPEN |
| D-10 | What "Grok Bot" is and how it is reached | Prototype assumes no programmatic API: manual copy/export hand-off. If an API exists (e.g., xAI API), integration needs a separate review. | M6 | OPEN |
| D-15 | Routine scheduling | Vercel Cron → idempotent SQL function, daily. | M5 | PROPOSED |
| D-16 | Client approvals | Recorded internally with evidence link (e.g., Drive copy of the approval email); no client portal. | M4 | PROPOSED |
| D-17 | Activity immutability | Activities editable for 24 h by author, afterwards owner-only edit (audited). | M2 | PROPOSED — implemented as stated in M2 |

## Accepted (from the assignment brief)

- Private single-owner system; no public sign-up, multi-tenancy billing or SaaS features.
- Next.js App Router + TypeScript, Tailwind + shadcn/ui, Supabase (Postgres, Auth, SSR),
  Zod + React Hook Form, Vitest + Playwright, Vercel Pro, private GitHub repo.
- Documents stored in Google Drive; the app stores links.
- Feature branches + PRs; no merge to `main` or production deploy without owner authorization.

## Known limitations

- Member invitation flow is deferred; additional users would be provisioned by script.
- No workspace switcher (single workspace).
- No client portal.
- No in-app MFA factor reset or password change yet; recovery via the Supabase dashboard
  (docs/runbooks/bootstrap-owner.md).
- Users with audit history cannot be deleted (audit rows are immutable and reference them);
  suspend the membership instead. Workspaces cannot be deleted for the same reason.
- Members list shows display names only; emails live in Supabase Auth and are not exposed
  to the app's API role.
- Changes made directly in the `auth` schema (e.g., deleting an MFA factor in the dashboard)
  are not in the Pioneer OS audit log.
