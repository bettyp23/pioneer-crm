# Milestone 2 — Clients and pipeline

Scope: FR-CLI-1/2, FR-CON-1, FR-LEAD-1/2, FR-ACT-1, FR-FU-1 ([requirements.md](requirements.md) §2.2).
Status: **Implemented — awaiting owner review** · 2026-10-20 · Branch `feat/m2-clients-pipeline` (stacked on
`feat/m1-foundation`).

Decisions applied: D-2 (lead = opportunity on a client), D-3 (default six stages),
D-17 (activities editable 24 h by author, then owner only; audited).

## Data (one migration, `…_clients_pipeline.sql`)

| Table | Notes |
|---|---|
| `clients` | name, legal_name, kind, status (`prospect`/`active`/`paused`/`former`), industry, website_url (https), drive_folder_url (https on drive/docs.google.com), notes, archived_at, created_by. Trigram index on name. Audited: name, kind, status, archived_at. |
| `contacts` | composite FK to client; email `citext`; one active primary per client (partial unique + trigger that clears the previous primary). |
| `pipeline_stages` | name, position, kind (`open`/`won`/`lost`). Seeded with the D-3 defaults for every workspace (existing ones and, by trigger, new ones). Owner/admin configure: rename, reorder, add open stages, delete unused open stages. Audited. |
| `leads` | client, primary contact (must belong to the client), stage, title, source, estimated value (minor units + currency), expected close, owner (must be a member), lost_reason (required in a lost stage), closed_at (set by trigger), archived_at. Audited incl. stage changes. |
| `activities` | type, subject, body, occurred_at; client required, lead/contact optional and must belong to the same client. D-17 enforced in RLS; updates audited. No deletes. |
| `follow_ups` | title, **due_on (date)**, status (`open`/`done`/`cancelled`), assignee (must be a member), completed_at iff done. |

Deviation from schema.md: follow-ups use `due_on date` instead of `due_at timestamptz` —
FR-FU-1 asks for a due date, and a date avoids timezone ambiguity for "overdue / due today"
(computed in the workspace timezone).

All tables: `workspace_id`, composite FKs preventing cross-workspace references, restrictive
MFA policy, viewer read / member write, explicit column grants, no hard deletes (archive or
cancel instead).

## Screens

`/clients` (search, status filter, archived toggle) · `/clients/new` · `/clients/[id]` (tabs:
Overview, Contacts, Leads, Activity, Follow-ups; later modules shown as upcoming) ·
`/clients/[id]/edit` · contact create/edit · `/contacts` · `/pipeline` (board + list) ·
`/leads/new` · `/leads/[id]` (move stage, activity, follow-ups) · `/leads/[id]/edit` ·
`/follow-ups` (overdue / today / upcoming) · `/settings/pipeline` · dashboard follow-up
widget. Viewers see everything read-only.

Board moves use an accessible "Move to stage" control instead of drag-and-drop (no extra
dependency; keyboard friendly). Drag-and-drop can be added later.

## Tests and acceptance

- pgTAP per new table: aal1, non-member, viewer, member; cross-workspace FK rejection;
  lost reason; closed_at; primary contact switch; D-17 window; follow-up completion check;
  stage seeding; audit on stage change.
- Vitest: schemas, money parsing/formatting, workspace-timezone day bounds.
- Playwright (requirements §4): create client → contact → lead → move stage → log activity →
  complete follow-up; viewer read-only.

## Evidence (2026-10-20)

| Check | Result |
|---|---|
| pgTAP | 111 assertions pass (50 new in `005_clients_pipeline.test.sql`) |
| Vitest | 111 tests pass (money, timezone dates incl. DST, M2 schemas) |
| Playwright | client → contact → lead → lost (reason required) → proposal → activity → follow-up done; stage rename; viewer read-only (404 on write pages) |
| Browser QA | all M2 pages load with no console errors |

Bug found by the E2E flow and fixed: forms sent Zod-*transformed* values (nulls) to Server
Actions that re-parse the raw shape; forms now send raw input and the server validates.

## Known limitations (M2)

- Board moves use a stage selector, not drag-and-drop.
- No UI to edit an activity yet (the database allows the author for 24 h, owner after — D-17).
- Currency is fixed to USD in the lead form (the schema supports others).
- Leads list loads up to 500 non-archived leads (fine for the expected volume; paginate later).
