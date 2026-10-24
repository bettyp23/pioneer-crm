# Pioneer OS — Architecture

Status: **Draft for owner review** · Last updated: 2026-10-19

## 1. Overview

```
Browser ──HTTPS──► Vercel (Next.js App Router)
                     │  proxy (session refresh, coarse redirect)
                     │  Server Components / Server Actions / Route Handlers
                     │        │
                     │        ▼
                     │  Data access layer (src/server, src/features/*/server)
                     │    • requireMember() / requireRole()   ← authorization
                     │    • Zod-validated inputs
                     │    • Supabase client bound to the user's session
                     ▼        │
                   Supabase   ▼
                     Auth (email+password, TOTP MFA, sign-up disabled)
                     Postgres: RLS on every table, column-level grants,
                               RPC functions for multi-step transactions,
                               audit triggers
Google Drive ◄── links only (no API integration in MVP)
Grok Bot     ◄── manual, reviewed hand-off via agent work queue (M6)
```

Principles:

1. **The database is the last line of defense.** RLS, constraints, and triggers enforce
   tenancy, immutability and state rules even if application code has a bug.
2. **The application is the first line.** Every Server Action and Route Handler validates
   input and authorizes before touching data. Server Actions are public HTTP endpoints and
   are treated as such.
3. **Multi-step writes are Postgres functions.** Supabase's JS client has no transactions, so
   blueprint publishing, project generation, and task transitions are `plpgsql` functions
   called via RPC. They run as `security invoker` (RLS applies) unless a documented reason
   requires `security definer`.
4. **Nothing changes state automatically when it matters.** Blockers clearing make a task
   *eligible*; a human moves it.
5. **Boring over clever.** No ORM, no generic repository layer, no event bus. Generated
   Supabase types + small typed query functions per feature.

## 2. Technology

Exact versions are pinned in `package.json`/lockfile and verified at implementation time
(see milestone-1-plan.md §2). Baseline expectations as of 2026-10:

| Concern | Choice | Notes |
|---|---|---|
| Runtime | Node.js Active LTS (24.x) | Local machine is on 20.14, which is past end-of-life — upgrade needed (decisions.md D-12) |
| Framework | Next.js (current stable major), App Router, TypeScript strict | `proxy.ts` (formerly `middleware.ts`) per current Next conventions |
| UI | Tailwind CSS v4, shadcn/ui (Radix primitives), lucide icons | Components copied into `src/components/ui` |
| Forms | React Hook Form + Zod + `@hookform/resolvers` | Same Zod schema validates on server |
| Data/Auth | Supabase Postgres + Auth, `@supabase/ssr`, `@supabase/supabase-js` | Publishable key in browser; secret key server-only scripts |
| Types | `supabase gen types typescript` → `src/server/db/database.types.ts` | Regenerated with each migration |
| Unit tests | Vitest | Schemas, authz matrix, pure domain helpers |
| DB tests | pgTAP via `supabase test db` | RLS, grants, triggers, RPC rules |
| E2E | Playwright against local Supabase stack | Auth, MFA, core flows |
| CI | GitHub Actions | Lint, typecheck, unit, DB, E2E |
| Hosting | Vercel Pro; Supabase (Pro recommended) | Same region (decisions.md D-5) |
| Package manager | npm (already installed) | Lockfile committed |

## 3. Repository layout

```
.
├── docs/                         requirements, architecture, schema, security, decisions, runbooks
├── supabase/
│   ├── config.toml               local stack config (sign-up disabled, MFA on)
│   ├── migrations/               timestamped SQL, forward-only
│   ├── tests/                    pgTAP tests (*.test.sql)
│   └── seed.sql                  synthetic local-only data
├── scripts/
│   └── bootstrap-owner.ts        one-time owner + workspace provisioning (secret key, manual)
├── src/
│   ├── app/
│   │   ├── (auth)/login/         sign-in, MFA enroll/verify
│   │   ├── (app)/layout.tsx      protected shell; calls requireMember()
│   │   ├── (app)/dashboard/
│   │   ├── (app)/clients/ …      route segments mirror the screen map
│   │   └── auth/                 callback / sign-out route handlers
│   ├── features/
│   │   └── <feature>/            clients, contacts, leads, catalog, blueprints, projects, …
│   │       ├── components/       feature UI (client + server components)
│   │       ├── server/
│   │       │   ├── queries.ts    reads   ('server-only')
│   │       │   └── actions.ts    Server Actions: validate → authorize → write → audit/revalidate
│   │       ├── schemas.ts        Zod schemas shared by form and action
│   │       └── types.ts
│   ├── server/                   cross-cutting server-only code
│   │   ├── auth/session.ts       getUser(), requireMember(), requireRole()
│   │   ├── auth/permissions.ts   role → permission matrix (single source in TS)
│   │   ├── db/server-client.ts   cookie-bound Supabase client (RLS applies)
│   │   ├── db/admin-client.ts    secret-key client — import allowlisted to scripts/ only
│   │   └── db/database.types.ts  generated
│   ├── components/{ui,layout}/   shadcn primitives, app shell
│   ├── lib/                      framework-free utilities (dates, money, urls)
│   └── proxy.ts                  session refresh + redirect for unauthenticated users
└── tests/e2e/                    Playwright specs
```

**Import boundaries** (enforced with ESLint `no-restricted-imports`):

- `src/server/db/*` may be imported only from `src/server/**` and `src/features/*/server/**`.
- `src/server/db/admin-client.ts` may be imported only from `scripts/**` (and, if ever needed,
  an explicitly reviewed server module).
- Client components never import from `server/`; server modules start with
  `import 'server-only'`.

## 4. Authentication and authorization flow

1. `proxy.ts` refreshes the Supabase session cookie on each request and redirects requests
   without a session to `/login`. It is **not** the authorization boundary.
2. `(app)/layout.tsx` and every query/action call `requireMember()`:
   - verifies the JWT server-side (`supabase.auth.getClaims()` — never trusts
     `getSession()` on the server),
   - requires `aal2` (MFA completed); otherwise redirects to MFA verify/enroll,
   - loads the active workspace membership and role.
3. Mutations call `requireRole(permission)` using `permissions.ts`.
4. Queries run through the user-bound Supabase client, so RLS re-checks membership, role and
   `aal2` in the database.

Active workspace: with one workspace at launch, it is the user's only membership. The
model supports several; a workspace switcher is deferred.

## 5. Data access and mutation pattern

```ts
// src/features/clients/server/actions.ts
'use server'
export async function updateClient(input: unknown) {
  const { supabase, member } = await requireRole('clients.write')
  const data = updateClientSchema.parse(input)            // Zod
  const { error } = await supabase
    .from('clients').update(data.patch)
    .eq('id', data.id).eq('workspace_id', member.workspaceId)
  if (error) throw toActionError(error)
  revalidatePath(`/clients/${data.id}`)
}
```

- Simple CRUD: direct table access through the user client (RLS + column grants).
- Multi-step or rule-bearing writes: RPC to a Postgres function (`publish_blueprint_version`,
  `generate_project`, `transition_task`, `decide_approval`, …).
- Audit: row-level triggers on consequential tables plus explicit audit inserts inside RPCs
  (see schema.md §3). App code does not write audit rows directly.
- Errors: Postgres errors with known `SQLSTATE`/constraint names are mapped to user-facing
  messages; unknown errors are logged server-side without record contents.

## 6. Key domain mechanisms

### 6.1 Immutable blueprint versions
`blueprint_versions.status` ∈ `draft | published | retired`. Triggers reject any
`UPDATE`/`DELETE` on a published/retired version (except `published → retired`) and any
`INSERT/UPDATE/DELETE` on its task templates, dependencies and input templates.
`publish_blueprint_version()` validates (acyclic via recursive CTE, ≥1 task, references
within the version), stamps `published_at/by`, computes a content hash, and audits.

### 6.2 Transactional, idempotent project generation
`generate_project(client_id, blueprint_version_id, sow_id, name, start_date, idempotency_key)`:
one transaction that inserts the project (unique `idempotency_key` → returns the existing
project on retry), copies templates to tasks keyed by template `key`, maps dependencies,
creates client-input requests and pending approval placeholders, and writes one audit
event. The form generates the idempotency key when it renders, so double-submit and network
retries converge.

### 6.3 Task state rules
Status is changed only by `transition_task(task_id, to_status, expected_version)`;
the `status` column is not granted for direct update. The function checks:
allowed transition graph, prerequisites complete, blocking inputs accepted/waived, approval
approved (for `done`), and optimistic-concurrency `version`. The `task_readiness` view
explains blockers to the UI.

### 6.4 SOW references vs. progress
`sow_documents` holds contractual references (immutable once signed). Projects point to a
SOW; progress lives only on projects/tasks. Changing scope = new SOW version + supersede.

### 6.5 Agent work queue (M6)
Agents have no Supabase identity. A human builds a work item with a curated context
snapshot, the system scans it for sensitive patterns, a human dispatches it (manual
copy/export in the prototype), and pastes back the result for review. Accepted output is
attached as a proposal; any record change is a normal human action.

### 6.6 Scheduled work (M5)
Routine occurrence generation runs from a Vercel Cron route handler protected by
`CRON_SECRET`, calling an idempotent SQL function (`unique(routine_id, scheduled_for)`).
Cron never changes task or project status.

## 7. Environments

| Env | App | Database | Data |
|---|---|---|---|
| Local | `next dev` | Supabase CLI (Docker) | `seed.sql` synthetic only |
| Preview/Staging | Vercel preview deployments | Separate staging Supabase project (D-4) | Synthetic only |
| Production | Vercel production (`main`) | Production Supabase project | Real data |

Preview deployments must never hold production keys. Migrations reach production only via
a reviewed, owner-authorized release (`supabase db push` from CI or a documented manual
step — decided in M7).

## 8. Primary screen map

```
/login                         email + password
/login/mfa                     TOTP enroll (first login) / verify
/dashboard                     Today: overdue follow-ups, tasks ready to start, pending approvals,
                               routines due, open high-severity issues
/clients                       directory, search, status filter
/clients/[id]                  tabs: Overview · Contacts · Leads · Projects · SOWs · Activity ·
                               Diagnostics · Issues · Invoices · Links (Drive)
/contacts                      cross-client contact list
/pipeline                      Kanban by stage (+ list view)
/leads/[id]                    lead detail, activities, follow-ups
/follow-ups                    my follow-ups: overdue / today / upcoming
/catalog/services              service catalog
/catalog/packages              packages and included services
/blueprints                    blueprint list (latest published, draft badge)
/blueprints/[id]               version history
/blueprints/[id]/versions/[n]  draft editor (tasks, dependencies, inputs) or read-only published view
/projects                      cross-project list with health
/projects/new                  generation wizard: client → SOW → blueprint version → review → generate
/projects/[id]                 tabs: Tasks (list/board, blocked reasons) · Dependencies · Client inputs ·
                               Approvals · SOW · Activity
/approvals                     approval inbox
/routines, /routines/[id]      registry and occurrence history
/diagnostics, /issues          lists + detail drawers
/invoices                      invoice metadata, receivables status
/reports                       operational reports
/agents/queue, /agents/queue/[id]   work items: compose → review → dispatch → return → accept/reject
/settings/workspace            name, timezone
/settings/members              members and roles
/settings/security             MFA factors, sessions
/settings/audit                audit log (owner/admin)
```

M1 ships `/login`, `/login/mfa`, `/dashboard` (shell), `/settings/*` and placeholder entries
for the other modules.
