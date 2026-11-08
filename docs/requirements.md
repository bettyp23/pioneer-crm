# Pioneer OS — Requirements

Status: **Draft for owner review** · Last updated: 2026-10-19

Pioneer OS is the internal CRM and service-operations platform for Pioneer Digital AI
(operated by Benemento Lab LLC). This document defines what the system must do. How it
does it lives in [architecture.md](architecture.md), [schema.md](schema.md) and
[security.md](security.md). Open questions live in [decisions.md](decisions.md).

## 1. Purpose and scope

### 1.1 Goals

- One private system of record for clients, contacts, leads, delivery and operations.
- Repeatable delivery: approved, versioned service blueprints generate client projects.
- Explicit control: dependencies, approvals and signed-scope references are enforced, not
  conventions.
- Traceability: every consequential change is attributable and auditable.
- Safe AI assistance: agents (Grok Bot) get curated, reviewed work items — never direct
  access to client records or production operations.

### 1.2 Users

| User | Description | MVP? |
|---|---|---|
| Owner | Founder; full control of the workspace | Yes — the only user at launch |
| Internal member | Future employee/contractor with a scoped role | Data model only |
| Viewer | Read-only internal user (e.g., advisor, bookkeeper) | Data model only |
| Client | External client | **No access.** Client approvals are recorded by an internal user with evidence |
| AI agent | Grok Bot or similar | No login; interacts only through the reviewed work queue (M6) |

### 1.3 Out of scope

- Public SaaS, public self-registration, multi-tenant billing or subscription management.
- Client-facing portal.
- Storing PHI, payment card data, bank details, or secrets/credentials (see security.md §6).
- Storing document files: documents live in Google Drive; Pioneer OS stores links only.
- Generating prices, scopes or contract terms. The system records what the owner enters.
- Unattended AI actions against client records or production systems.

## 2. Functional requirements

IDs are stable so tests and PRs can reference them. "M#" is the delivering milestone.

### 2.1 Foundation (M1)

| ID | Requirement |
|---|---|
| FR-AUTH-1 | Users sign in with email + password; public sign-up is disabled. |
| FR-AUTH-2 | TOTP multi-factor authentication is required before any business data is readable (enforced in the database, not only the UI). |
| FR-AUTH-3 | The owner account is provisioned by a documented, manually-run bootstrap script. |
| FR-AUTH-4 | Sign-out ends the session; protected routes redirect unauthenticated users to `/login`. |
| FR-WS-1 | All business data belongs to a workspace; users access data through workspace membership. |
| FR-WS-2 | Memberships have a role: `owner`, `admin`, `member`, `viewer`. A workspace always has at least one owner. |
| FR-WS-3 | Settings screens show workspace details and members (member invites are deferred; see decisions.md). |
| FR-AUD-1 | Consequential changes produce append-only audit events (actor, action, entity, before/after, time). |
| FR-AUD-2 | Owners/admins can view the audit log. Nobody can edit or delete audit events through the app. |
| FR-UI-1 | Authenticated users see a dashboard shell with navigation for all planned modules. |

### 2.2 Clients and pipeline (M2)

| ID | Requirement |
|---|---|
| FR-CLI-1 | Create, edit, archive and search clients (organizations or individuals) with status `prospect`, `active`, `paused`, `former`. |
| FR-CLI-2 | Store a Google Drive folder link per client. |
| FR-CON-1 | Manage contacts linked to a client; mark one primary contact. |
| FR-LEAD-1 | Track leads (opportunities) against a client through configurable pipeline stages, including won/lost outcomes and lost reason. |
| FR-LEAD-2 | Kanban and list views of the pipeline; stage changes are audited. |
| FR-ACT-1 | Log activities (note, call, email, meeting) against a client, and optionally a lead, contact or project. |
| FR-FU-1 | Create follow-ups with a due date; dashboard lists overdue and due-today follow-ups. |

### 2.3 Service catalog and blueprints (M3)

| ID | Requirement |
|---|---|
| FR-SVC-1 | Maintain a service catalog and packages (bundles of services). Prices are optional, owner-entered fields. |
| FR-BP-1 | Each blueprint has numbered versions. Exactly zero or one draft version exists at a time. |
| FR-BP-2 | A draft contains task templates (phase, order, estimate, relative due offset, approval requirement), dependencies between task templates, and client-input templates. |
| FR-BP-3 | Publishing validates the draft (no dependency cycles, no dangling references, at least one task) and makes it **immutable**. Changes require a new draft version. |
| FR-BP-4 | Published versions can be retired (no longer selectable for new projects) but never edited or deleted. |

### 2.4 Projects and delivery (M4)

| ID | Requirement |
|---|---|
| FR-SOW-1 | Record SOW references per client: title, Drive link, version label, status (`draft`, `sent`, `signed`, `superseded`, `void`), signed date and signatory. Signed SOW references are immutable except for status → `superseded`/`void`. |
| FR-PRJ-1 | Generate a project for a client from a published blueprint version in a single transaction: project, tasks, dependencies, client-input requests and approval placeholders. |
| FR-PRJ-2 | Generation is idempotent: a retried or double-submitted request returns the same project and never creates duplicates. |
| FR-PRJ-3 | Generated projects keep a permanent reference to the blueprint version and SOW they were built from. Later blueprint changes never alter existing projects. |
| FR-TASK-1 | Tasks move through `todo → in_progress → in_review → done`, plus `on_hold` and `cancelled`, only via allowed transitions. |
| FR-TASK-2 | A task cannot start while any prerequisite task is incomplete or any blocking client input is outstanding. |
| FR-TASK-3 | A task that requires approval cannot be marked `done` without an approved approval record. |
| FR-TASK-4 | The system shows *why* a task is blocked. It never changes task status automatically when blockers clear. |
| FR-INP-1 | Track client input requests (`requested`, `received`, `accepted`, `rejected`, `waived`) with Drive links for received materials. |
| FR-APR-1 | Approvals record subject, approver type (internal / client), decision, decider, evidence link and note. Decided approvals are immutable. |
| FR-PRJ-4 | Project status and progress are visible per project and in a cross-project list. |

### 2.5 Operations (M5)

| ID | Requirement |
|---|---|
| FR-RTN-1 | Registry of recurring routines (internal or per client) with cadence, runbook link and owner. |
| FR-RTN-2 | Routine occurrences are generated idempotently (one per routine per scheduled date) and marked done/skipped with notes. |
| FR-DIA-1 | Record diagnostics performed for a client (type, date, summary, optional score, report link). |
| FR-ISS-1 | Track issues (severity, status, assignee), optionally originating from a diagnostic or project. |
| FR-INV-1 | Record invoice **metadata** (external number/link, dates, amount, currency, status). No payment processing or card data. |
| FR-RPT-1 | Operational reports: pipeline summary, project health, overdue tasks, routine compliance, open issues, receivables by status. |

### 2.6 Agent work queue (M6)

| ID | Requirement |
|---|---|
| FR-AGT-1 | Register agents (e.g., Grok Bot). Agents are not users and have no database credentials. |
| FR-AGT-2 | A human composes a work item with instructions and an explicitly selected, minimized context. The system flags likely sensitive content before dispatch. |
| FR-AGT-3 | Dispatch is a reviewed, human action. The M6 prototype hands work over manually (copy/export) unless a verified Grok API is approved. |
| FR-AGT-4 | Agent output is stored as a proposal. A human must accept or reject it; accepted output never changes records automatically. |
| FR-AGT-5 | All dispatches, returns and reviews are audited. |

### 2.7 Release (M7)

| ID | Requirement |
|---|---|
| FR-REL-1 | CI runs lint, typecheck, unit, database (RLS) and end-to-end tests on every PR. |
| FR-REL-2 | Documented and rehearsed backup and restore procedure. |
| FR-REL-3 | Production deployment only after owner authorization; acceptance test checklist signed off. |

## 3. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-SEC-1 | Authorization is enforced twice: in the server data access layer and by Postgres RLS. |
| NFR-SEC-2 | Least privilege: the `anon` role has no table access; the server's secret/service key is used only for documented admin scripts. |
| NFR-SEC-3 | No secrets in the repository; fixtures use synthetic data only. |
| NFR-DATA-1 | Relational schema with foreign keys, check constraints and unique constraints; schema changes only via versioned SQL migrations. |
| NFR-DATA-2 | Money stored as integer minor units plus ISO-4217 currency. Timestamps stored as `timestamptz` (UTC); displayed in the workspace timezone. |
| NFR-OPS-1 | Daily backups with a tested restore procedure; documented RPO/RTO. |
| NFR-MAINT-1 | Code organized by business feature; straightforward patterns over abstractions. |
| NFR-MAINT-2 | Every significant feature ships with tests and updated docs. |
| NFR-UX-1 | Usable on desktop and mobile widths; keyboard accessible; WCAG 2.2 AA where practical. |
| NFR-PERF-1 | Typical page loads under 1 s server time for a dataset of ~1,000 clients and ~20,000 tasks. |

## 4. Milestone acceptance criteria (summary)

Each milestone ends with a stop-and-review. Evidence = test output, screenshots or
recordings of key flows, migration list, and an updated limitations list.

| Milestone | Accepted when |
|---|---|
| M1 Foundation | See the M1 plan (on the `archive/full-pioneer-os` branch) §5. |
| M2 Clients & pipeline | FR-CLI/CON/LEAD/ACT/FU satisfied; RLS tests for every new table; E2E: create client → contact → lead → move stage → log activity → complete follow-up. |
| M3 Catalog & blueprints | FR-SVC/BP satisfied; DB tests prove published versions and their templates reject updates/deletes; cycle detection tested. |
| M4 Projects | FR-SOW/PRJ/TASK/INP/APR satisfied; tests for idempotent generation (concurrent double-submit), blocked transitions, approval gating, SOW immutability. |
| M5 Operations | FR-RTN/DIA/ISS/INV/RPT satisfied; idempotent routine generation tested; reports verified against fixture data. |
| M6 Agent queue | FR-AGT satisfied; tests prove agent paths cannot read records outside the work item and cannot apply changes without review. |
| M7 Release | FR-REL satisfied; restore drill evidence; security checklist completed; owner sign-off. |

## 5. Known limitations (living list)

- Single-owner operation is the only tested mode until internal members are invited.
- No client portal: client approvals rely on internal users recording evidence links.
- Google Drive links are not access-checked; Drive sharing settings remain authoritative.
