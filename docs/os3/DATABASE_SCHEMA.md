# Database schema: existing and proposed

The authoritative as-built reference is [../schema.md](../schema.md) and the migrations in
`supabase/migrations/`. This page summarises what exists and proposes what each later
milestone adds. Conventions stay the same for new tables:

- `workspace_id` on every table, with composite foreign keys `(workspace_id, id)`;
- RLS with a restrictive two-factor (MFA) policy;
- column-level grants;
- state changes through security-definer functions in `private`, with invoker wrappers in `public`;
- audit triggers listing only allowlisted columns;
- money in minor units (cents, or micro-USD for AI costs);
- workspace-local dates via `private.workspace_today`.

## Existing (M1–M7)

| Area | Tables / views |
|---|---|
| Identity and access | `workspaces` (+ AI pause columns since M7), `profiles`, `workspace_members`, `audit_events` (append-only) |
| CRM | `clients`, `contacts`, `pipeline_stages`, `leads`, `activities`, `follow_ups` |
| Catalog | `services`, `packages`, `package_services`, `blueprints`, `blueprint_versions`, `task_templates`, `task_template_dependencies`, `input_templates` |
| Delivery | `sow_documents`, `projects`, `project_tasks`, `task_dependencies`, `client_input_requests`, `approvals`; views `task_readiness`, `project_progress` |
| Operations | `routines`, `routine_runs`, `diagnostics`, `issues`, `invoices`; report views |
| AI | `agents`, `ai_budgets`, `agent_work_items`, `proposed_actions`, `ai_usage`, view `ai_spend_this_month` |
| **M7 jobs** | `jobs`, `job_attempts`; schema `worker` (role `pioneer_worker`): `claim_jobs`, `heartbeat`, `complete_job`, `fail_job`, `reap_expired`; `public.enqueue_job`, `cancel_job`, `retry_job`, `set_ai_paused` |

### M7 `jobs` in brief

| Column | Notes |
|---|---|
| `kind` | `area.action`, e.g. `agent.run`, `stripe.process_event`; `agent.*` kinds must name an agent |
| `idempotency_key` | unique per `(workspace_id, kind)`; queueing again returns the same job |
| `payload`, `result` | JSON; **not readable through the API**; payloads hold ids, never client content or secrets |
| `status` | queued → running → succeeded, or failed (permanent) / dead ("gave up") / cancelled |
| `attempts`, `max_attempts`, `run_after` | exponential backoff 30 s × 2ⁿ, capped at 1 h |
| `locked_by`, `locked_until`, `timeout_seconds` | lease; expired leases are reaped |
| `last_error` | credential-shaped text redacted by `private.redact_secrets` |

## Proposed additions by milestone

### M9: autonomy and approvals v2, workflow runs, tamper-evident audit

| Table / change | Purpose | Key columns / rules |
|---|---|---|
| `action_type` enum + values | Finer action types | add `refund`, `billing_change`, `production_deploy`, `destructive_change`, `grant_access`, `security_change`, `send_template`, `maintenance_op` |
| `autonomy_rules` | Level 2 rules | `action_type`, `agent_id`, `template_key` / `operation_key`, `conditions jsonb`, `daily_max`, `version`, `active`; **check: never for the Level-3-only types**; owner-only writes |
| `proposed_actions` + columns | Approval request detail | `risk_level smallint (1–3)`, `risk_category`, `justification`, `artifacts jsonb` (https links), `job_id`, `matched_rule_id`, `status += 'changes_requested'` |
| `workflow_runs` | Explicit workflow state | `workflow_key`, `subject_type/id`, `state`, `version`, `started_at`, `finished_at`; transitions via a function with an allowed-transition table |
| `audit_events` + `prev_hash`, `hash` | Tamper evidence | `hash = sha256(prev_hash ‖ canonical row)`, computed in the insert trigger; nightly verification job |

### M10: Hermes bridge

| Table | Purpose |
|---|---|
| `agent_tools` | Allowed MCP tools per agent (`agent_id`, `tool_key`), owner-managed |
| `agent_tokens` | Hashed MCP bearer tokens per agent (`token_hash`, `expires_at`, `revoked_at`); plain token shown once |
| `agent_runs` | One per Hermes run: `job_id`, `hermes_run_id`, `profile`, `model`, `input_tokens`, `output_tokens`, `cost_microusd`, `status`, `started_at`, `finished_at` |
| `worker_heartbeats` | `worker`, `seen_at`, `version`; watchdog alert when stale |
| schema `mcp` + role `pioneer_mcp` | Functions behind each MCP tool; each takes the agent id resolved from the token |

### M12: Stripe and finance

| Table | Purpose |
|---|---|
| `stripe_events` | `id` (Stripe event id, PK), `type`, `livemode`, `received_at`, `processed_at`; minimal payload (ids only) |
| `stripe_customers` | `client_id` ↔ `stripe_customer_id` |
| `payments` | `client_id`, `project_id`, `stripe_payment_intent`, `amount_minor`, `currency`, `status`, `paid_at` |
| `subscriptions` | `client_id`, `stripe_subscription_id`, `plan` (package), `status`, `current_period_end` |
| `invoices` + columns | `stripe_invoice_id`, `hosted_invoice_url`, sync status |
| `expenses` | `category`, `vendor`, `amount_minor`, `incurred_on`, optional `project_id`, receipt link |
| `packages` + `stripe_price_id` | Price mapping (no duplicated prices) |
| schema `ingest` + role `pioneer_ingest` | `record_event()` only |
| views | `project_profitability`, `service_margins`, `receivables_aging`, `mrr` |

### M13: sales and onboarding

`lead_sources`, `intake_forms` (versioned questions), `intake_submissions` (rate-limited
public endpoint), `proposals` + `proposal_items` (from catalog packages; any custom line makes
the proposal L3), `meetings`, `message_templates` (versioned, owner-approved), `email_messages`
(outbound log with action id and rule version), `google_connections` (encrypted refresh token).

### M14: development pipeline

`repositories`, `pull_requests`, `ci_runs`, `preview_deployments`, `qa_results`,
`revision_requests`, `deployments` (production, requires `approval_id`), `acceptance_criteria`
on `project_tasks`.

### M15: maintenance and monitoring

`monitored_sites`, `monitor_checks` (summaries only), `incidents` + `incident_events`,
`maintenance_plans`, `support_tickets`, `sla_policies`, `maintenance_reports`,
`domain_ssl_status`, `backup_status`.

### M16: knowledge and self-improvement

`knowledge_articles` (versioned, approved), `skills` (name, version, git ref, status: draft /
evaluating / promoted / retired), `eval_cases`, `eval_runs`, `improvement_proposals`,
`model_routing_rules`, `incident_lessons`.
