# Pioneer OS — Decisions and Open Questions

Status legend: **OPEN** (needs owner approval) · **PROPOSED** (default unless you object) ·
**ACCEPTED**. Each entry gives a recommendation. Last updated: 2026-10-24.

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
| D-6 | SOW required to generate a project? | Yes — require a `signed` SOW, except an explicit "internal / pilot" flag with a reason (audited). | M4 | ACCEPTED 2026-10-20 |
| D-7 | Do cancelled prerequisite tasks unblock dependents? | Yes, but cancelling a task that has dependents requires confirmation listing them, and is audited. | M4 | ACCEPTED 2026-10-20 |
| D-8 | Blueprints per project | One project = one blueprint version for MVP. Packages map to one blueprint; multi-blueprint projects deferred. | M3/M4 | ACCEPTED 2026-10-20 |
| D-9 | Invoice system of record | Which tool issues invoices (QuickBooks, Stripe, Wave, other)? Pioneer OS stores metadata + link only. | M5 | OPEN |
| D-10 | What "Grok Bot" is and how it is reached | Grok bots are saved instructions in the Grok app (no callable API). M6 stores each role as an agent record and hands work over by copy/paste. The owner has Anthropic and xAI API accounts; automated connectors come in a later milestone with a separate review. | M6 | ACCEPTED 2026-10-21 |
| D-15 | Routine scheduling | Vercel Cron → idempotent SQL function, daily. Until hosting (M7) the same function runs when Routines/Dashboard load. | M5 | PROPOSED — function built in M5, cron in M7 |
| D-16 | Client approvals | Recorded internally with evidence link (e.g., Drive copy of the approval email); no client portal. | M4 | PROPOSED — implemented in M4 |
| D-19 | Re-scoped M6 (vision review 2026-10-21) | AI Command Center + Approval Center: agent roles, work items, proposed actions with approval gates, budget caps and a cost ledger; manual hand-off, no live connectors. | M6 | ACCEPTED 2026-10-21 |
| D-20 | Agent autonomy | Only read-only research may ever run without approval; sending, deploying, pricing and signing always need an approved action, enforced in the database. | M6+ | ACCEPTED 2026-10-21 |
| D-21 | AI budget caps | $50 per month each for Anthropic and xAI; editable by the owner. | M6 | ACCEPTED 2026-10-21 — superseded by D-33 |
| D-22 | Client data sent to AI | Client business information allowed by default; contact emails/phones, notes, invoice data and SOW details only when explicitly added (flagged); health data never. Navigation unchanged. | M6 | ACCEPTED 2026-10-21 |
| D-23 | Agent runtime (Pioneer OS 3.0 brief, 2026-10-22) | Hermes Agent (self-hosted, MIT) on a Hostinger VPS is the orchestrator; Pioneer OS stays the source of truth, approval gate and audit log. One Hermes install, one profile per role; tools only through a role-scoped Pioneer MCP server. See docs/os3/ARCHITECTURE.md. Supersedes the "custom connectors" plan in D-10. | M10–M11 | PROPOSED — owner brief adopts Hermes |
| D-24 | Providers | Grok (xAI) and Perplexity are removed (owner brief). Models via OpenRouter (Claude and others), code via Codex (OpenAI). The xAI $50 cap moves to OpenRouter; Anthropic $50 stays for an optional direct key. Enum values kept so old ledger rows stay readable; new rows are refused. | M7 | ACCEPTED (brief) — caps PROPOSED |
| D-25 | Agent roster | The eight 3.0 roles: Operations, Sales, Client Onboarding, Development, QA & Security, Marketing & SEO, Client Success & Maintenance, Finance & Admin. Existing M6 agents renamed in place (instructions and history kept); Research and Setup retired (inactive). | M7 | ACCEPTED (brief) — superseded by D-30 |
| D-26 | Kill switch | Owner-only workspace pause; enforced in the database for dispatch, agent jobs, heartbeats and budget checks; audited. Deterministic jobs keep running. | M7 | PROPOSED — implemented in M7 |
| D-27 | Job queue | Postgres `jobs` table with leases (SKIP LOCKED), exponential backoff, dead-letter, attempt history, idempotency keys; VPS worker uses a no-login-by-default role limited to five `worker.*` functions. No Redis or extra service. | M7 | PROPOSED — implemented in M7 |
| D-28 | Coding agent | Codex through the official Codex GitHub Action on feature branches; `OPENAI_API_KEY` only in GitHub secrets; proposed $30/month cap; `main` protected (requires GitHub Pro for private repos). | M14 | OPEN |
| D-29 | Brain and team lead (owner, 2026-10-24) | **Pioneer (Claude)** is the brain inside Pioneer: it reads what the owner says, answers or routes. **Michael Scott (Grok)** leads the Grok bots and talks to them; Pioneer never assigns individual Grok bots. The name "Michael" belongs only to the Grok bot. Replaces "Claude orchestrates" in docs/os4/PLAN.md §2.2. | os4 C | ACCEPTED 2026-10-24 |
| D-30 | Roster (owner, 2026-10-24) | No separate Pioneer role agents for now: Pioneer (Claude) is the only agent inside Pioneer; the Grok team does the role work. M7 roles retired (inactive, history kept). Supersedes D-25. | os4 C | ACCEPTED 2026-10-24 |
| D-31 | Scope (owner, 2026-10-24) | The 18-feature list adds to the 4.0 draft; chat panel, iPhone app (dictation) and Website Demo workflow stay. See docs/os4/AUDIT_AND_PLAN.md. | os4 | ACCEPTED 2026-10-24 |
| D-32 | Where agents execute (owner, 2026-10-24) | Inside a container only (OrbStack locally), never directly on the owner's Mac. | os4 S | ACCEPTED 2026-10-24 |
| D-33 | AI cost limits (owner, 2026-10-24) | Claude and Grok run on the owner's subscriptions, which cap usage; Claude usage credits stay off so nothing bills extra. Pioneer adds only a loop brake: max 20 tasks per rolling hour per connection; when hit, the connection pauses and the owner is told, and only the owner resumes. Dollar caps (total $150; Anthropic $75; OpenAI $40; others $35; alert at 80%, stop at 100%) apply only if a pay-per-use key is ever added. Supersedes D-21 and the D-24 cap proposal. | os4 / M8 | ACCEPTED 2026-10-24 |
| D-34 | Grok connection (proposed by Michael Scott, 2026-10-24) | Pioneer → Michael Scott webhook routine (address in `.env.local` only) with a short note (client, task, blueprint ID); results first via the Agency Dashboard sheet (read-only access, rows must match a job ID + one-time code, treated as untrusted), later a results endpoint with per-job keys. First test: one fake task for a made-up client. | os4 X | PROPOSED — Pioneer → webhook verified 2026-10-24 (test ID `test-2026-10-24T17-56-05-442Z`, Bearer header, receipt confirmed by Michael Scott); sheet read-back not built yet |
| D-35 | Claude through the owner's subscription (owner, 2026-10-24) | No pay-per-use API key. Pioneer reaches Claude like Grok: a Claude Code scheduled task (routine) with an API trigger, running on the owner's Claude plan in Anthropic's cloud (never on the Mac). Fire URL and token in `.env.local` only. Results come back through the same sheet as Grok. Coding stays manual in Claude Code. | os4 C | ACCEPTED 2026-10-24: Pioneer → Claude scheduled task verified (test ID `test-2026-10-24T18-30-30-113Z`, Haiku 5.5, no repo or connectors; run repeated the test ID). Result read-back not built yet |
| D-36 | Grok as an agent provider again (M8) | Michael Scott (Grok) is an agent record with provider `xai`; he runs on the owner's Grok plan through his webhook, so no xAI API key exists. Agents may use `xai` again; Perplexity stays blocked; budgets and the cost ledger keep the D-24 rules (no xAI rows). Narrows D-24 for agents only. | M8 | PROPOSED: implemented in M8, confirm on the merge request |
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
