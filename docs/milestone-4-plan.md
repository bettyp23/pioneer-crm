# Milestone 4 — Projects and delivery

Scope: FR-SOW-1, FR-PRJ-1…4, FR-TASK-1…4, FR-INP-1, FR-APR-1 ([requirements.md](requirements.md) §2.4).
Status: **Implemented — awaiting owner review** · 2026-10-20 · Branch `feat/m4-projects` (stacked on
`feat/m3-catalog-blueprints`).

Decisions: D-6 (signed SOW required; "internal / pilot" exception needs a reason, audited),
D-7 (cancelled prerequisites unblock dependents; cancelling asks for confirmation listing
them), D-8 (one published blueprint version per project), D-16 (client approvals recorded
internally with an evidence link).

## Data (`…_projects.sql`)

| Table | Rules |
|---|---|
| `sow_documents` | Per client; Drive link; `draft → sent → signed → superseded/void`. Signing needs date + signatory and is **owner only**. A signed SOW is immutable except its status moving to superseded/void; superseded/void rows are frozen. |
| `projects` | Created only by `generate_project`. Keeps `blueprint_version_id` and `sow_id` permanently. `sow_id` or `no_sow_reason` required. Unique idempotency key per workspace. |
| `project_tasks` | Copied from task templates (due date = start + offset). `status` and `version` are not client-writable — only `transition_task`. |
| `task_dependencies` | Copied by key; same-project FKs. |
| `client_input_requests` | Copied from input templates; `requested → received → accepted/rejected`, or `waived` with a reason. Drive link and response text (for access: *where* the credential lives). |
| `approvals` | One placeholder per approval-requiring task at generation; internal decisions owner/admin; client decisions need the client contact and an evidence link. Decided approvals are immutable; a rejected one can be re-requested. |

Views (`security_invoker`): `task_readiness` (blockers as JSON, `can_start`, `can_finish`),
`project_progress` (counts by status, % done, overdue).

## Functions

- `generate_project(...)` — one transaction, idempotent (`ON CONFLICT DO NOTHING` on the key,
  returns the existing project on retry or concurrent double-submit). Validates published
  version, client, signed SOW of that client or a pilot reason, optional lead of that client.
- `transition_task(task, to_status, expected_version, reason?, confirm_unblock?)` — allowed
  graph, prerequisites done/cancelled, blocking inputs accepted/waived, approved approval for
  `done`, owner/admin + reason to cancel, D-7 confirmation, optimistic concurrency.
- `set_input_request_status(...)`, `request_approval(...)`, `decide_approval(...)`.

Definer functions live in `private`, re-check role + MFA, exposed via invoker wrappers.
Nothing changes task status automatically (FR-TASK-4).

## Screens

`/projects` (progress, overdue) · `/projects/new` (client → SOW or pilot reason → published
blueprint → name/start → generate) · `/projects/[id]` (Tasks with blockers and transitions ·
Client inputs · Approvals · Details) · `/approvals` inbox · client page SOWs and Projects tabs ·
dashboard "Tasks ready to start" and "Pending approvals".

## Evidence (2026-10-20)

| Check | Result |
|---|---|
| pgTAP | 210 assertions pass (57 new): SOW signing/immutability, D-6, generation copy + due dates, idempotent retry, transition graph, blockers, optimistic concurrency, approval gating and immutability, input lifecycle, D-7 confirmation, viewer/outsider/aal1, audit. Mutation check: dropping the SOW guard fails 5 tests. |
| Concurrency | Playwright API test: 5 parallel `generate_project` calls with one key → 1 project, 4 tasks |
| Vitest | 135 tests pass (transition graph, D-6 schema, evidence links) |
| Playwright | SOW → sign → generate → kickoff done → sitemap blocked from done until client approval with evidence → build blocked until input accepted → cancel with D-7 confirmation → audit; viewer read-only |
| Browser QA | projects, project tabs, generate, approvals, client SOW/Projects tabs: no console errors |

## Known limitations (M4)

- Tasks and dependencies come only from the blueprint; adding ad-hoc tasks to a project is not supported yet.
- No board (kanban) view for tasks yet — grouped list by phase.
- Approval subjects other than tasks (deliverable, project phase) exist in the schema but have no UI yet.
