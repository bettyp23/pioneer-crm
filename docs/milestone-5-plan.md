# Milestone 5 — Operations

Scope: FR-RTN-1/2, FR-DIA-1, FR-ISS-1, FR-INV-1, FR-RPT-1 ([requirements.md](requirements.md) §2.5).
Status: **Implemented — awaiting owner review** · 2026-10-20 · Branch `feat/m5-operations` (stacked on `feat/m4-projects`).

## Decisions taken in this milestone

- **D-9 (invoice system) still OPEN:** each invoice records its issuing system
  (QuickBooks, Stripe, Wave, Xero, FreshBooks, Other), external number and link. Answering
  D-9 only sets the default — no schema change. Metadata only; no payments or card data.
- **D-15 (scheduling):** occurrence generation is an idempotent SQL function
  (`unique(routine_id, scheduled_for)`). Until hosting exists (M7) it runs when someone opens
  Routines or the Dashboard; M7 adds the Vercel Cron trigger. Cron never changes task or
  project status.
- **Diagnostic type:** free text with suggestions (no lookup table) — fewer moving parts.

## Data (`…_operations.sql`)

| Table | Rules |
|---|---|
| `routines` | Internal or per client (optionally per project of that client); cadence × interval from an anchor date; owner must be a member; https runbook link; active flag; `next_due_on` maintained by the generator. |
| `routine_runs` | One per routine per date (unique); `pending → done/skipped/failed` with notes and evidence link; completion stamped by trigger. |
| `diagnostics` | Client (+ optional project), type, date, performer, summary, score 0–100, https report link. |
| `issues` | Client (+ optional project / diagnostic of that client), severity, status, assignee; `resolved_at` iff resolved/won't fix, resolution text required then. |
| `invoices` | Client (+ optional project), system + external number (unique), https link, issued/due dates, amount in minor units + currency, status; `paid_on` iff paid. |

Reporting views (`security_invoker`): `pipeline_summary`, `project_health`, `overdue_tasks`,
`routine_compliance`, `open_issues_by_severity`, `receivables_by_status`.

## Screens

`/routines` (due occurrences with Done/Skip/Failed, registry) · `/routines/new|[id]|[id]/edit` ·
`/diagnostics` (+ new) · `/issues` (+ new, detail) · `/invoices` (+ new, edit, mark paid) ·
`/reports` · client tabs Diagnostics, Issues, Invoices · dashboard "Routines due" and
"High-severity issues".

## Evidence (2026-10-20)

| Check | Result |
|---|---|
| pgTAP | 250 assertions pass (40 new): occurrence math (month-end, leap day), idempotent generation, no history flood, run stamping, compliance counts, issue resolution rules, invoice uniqueness/paid/due rules, receivables overdue, RLS on report views |
| Vitest | 141 tests pass |
| Playwright | routine due today → done → 100 %; diagnostic (score validation) → issue from it → resolve needs resolution; invoice recorded, duplicate rejected, marked paid; all six reports render; viewer read-only |
| Browser QA | operations pages and client Diagnostics/Issues/Invoices tabs: no console errors |

Bugs found by the tests and fixed: routine generation and report "today" used the UTC date, so
after 8 pm New York time a routine created for today was skipped and today's runs counted as
missed. All of these now use the workspace's local date.

## Known limitations (M5)

- No scheduled (cron) generation until hosting exists (M7); occurrences appear when Routines or
  the Dashboard is opened.
- No reminders/notifications.
- Invoice and catalog amounts are USD in the forms; reports sum per currency.
