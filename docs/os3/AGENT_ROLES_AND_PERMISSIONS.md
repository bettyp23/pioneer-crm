# Agent roles and permissions

Status: the eight roles exist as agent records since M7. The tools below are the M10 design.

## How permissions are enforced

An agent's prompt is **not** a security control. Permissions are enforced in three layers:

1. **Pioneer OS database:** what a tool call may change (RLS, security-definer functions,
   `require_approved_action`, `ai_budget_allows`, the kill switch, work-type checks per agent).
2. **`pioneer-mcp`:** each Hermes profile gets its own bearer token. The server maps the token
   to one agent and exposes only that agent's tools; every call is checked again in the database
   and audited as `agent:<key>`.
3. **Hermes profile config:** `tools.include` lists the same tools; terminal commands run in a
   Docker sandbox with approvals on and unattended approvals denied.

Separation: one Hermes **profile per role**, so each has its own memory, sessions and skills,
and receives only its own token. Client context is fetched per job, frozen in the job and not
shared across roles. Memory rules: no secrets, no contact details beyond what the job needs,
no health or payment card data. Memory is reviewed monthly (M16).

## Common to every agent

| Allowed | Never |
|---|---|
| `get_job_context(job_id)`: the frozen, scanned context for this job | Read another role's memory or jobs |
| `submit_output(job_id, text, links)` | Approve anything, including its own proposals |
| `propose_action(job_id, type, target, details, justification, evidence)`: lands in the Approval Center with the risk level from the autonomy rules | Send email, take or refund money, deploy, sign, change permissions |
| `create_internal_task(project_id, title, details)` (Level 1) | See credentials (none are in context; the scanner flags any that slip in) |
| `report_progress(job_id, note)` | Run without a job (cron runs also create a job first) |

## The eight roles

| Agent (key) | Purpose | Work types | Extra tools (M10+) | Typical Level 2 rules | Always Level 3 |
|---|---|---|---|---|---|
| **Operations** (`operations`) | Coordinates workflows, routes tasks, finds stalled or blocked work, prepares the weekly summary | plan, operations, other | `list_stalled_tasks`, `list_overdue_follow_ups`, `enqueue_followup_job` (allowlisted kinds only), `summarize_week` | Schedule approved routine jobs | Changing procedures or agent privileges |
| **Sales** (`sales`) | Captures and qualifies leads under your rules; drafts follow-ups, package recommendations and proposals | research, draft_message, plan | `get_lead`, `update_lead_fields` (non-sensitive: source, score, stage suggestion), `list_packages`, `draft_proposal` | Send a predefined follow-up template to an opted-in lead | Nonstandard price, discount, deadline or scope; any first contact outside policy |
| **Client Onboarding** (`client_onboarding`) | After a verified payment, prepares onboarding, checks for missing inputs, writes the project brief | draft_message, plan, operations | `get_client_inputs`, `mark_input_received` (with evidence), `create_project_brief` | Send the standard onboarding email after `payment.verified` | Changing scope or dates |
| **Development** (`development`) | Turns approved scope into tasks; asks for Codex runs on feature branches; documents changes | code, plan | `create_dev_tasks`, `request_codex_run(repo, branch, task)` → the worker runs the GitHub workflow; `link_pull_request` | Open pull requests on feature branches; create preview deployments | Merge to `main`; production deploy; database migration in production |
| **QA & Security** (`qa_security`) | Runs and reviews tests, accessibility, performance, dependency and security checks; files defects; blocks failing releases | qa | `get_ci_results`, `record_qa_result`, `create_defect`, `block_release(pr, reason)` | Block a release (it can always say no) | Override a required approval or a failed check |
| **Marketing & SEO** (`marketing_seo`) | Technical SEO audits, metadata and content suggestions, analytics reviews, client reports | research, draft_message, qa | `get_site_profile`, `record_seo_audit`, `draft_report` | none at first | Publishing content on a client site |
| **Client Success & Maintenance** (`client_success`) | Watches site health, classifies support requests, prepares status reports, escalates emergencies | operations, qa, draft_message | `list_incidents`, `classify_ticket`, `draft_status_report`, `propose_maintenance(plan)` | Allowlisted low-risk maintenance (e.g. clear a cache, renew a monitored certificate) | Anything not on the allowlist; anything irreversible |
| **Finance & Admin** (`finance_admin`) | Reads invoice and subscription status, tracks receivables, renewals and margins, drafts reminders | operations, draft_message, other | `list_receivables`, `list_renewals`, `project_margin(project)` (read only) | Send a predefined reminder for an invoice that is overdue by the rule's days | Refunds, transfers, changes to billing or payment details, signing |

The work types are enforced today (M6/M7). Tool lists become enforced in M10, when
`agent_tools` and `pioneer-mcp` ship.

## Models (via OpenRouter)

Default routing, to be tuned with measurements in M16:

| Role | Default | Why |
|---|---|---|
| Operations, Sales, Onboarding, Client Success, Finance | A mid-tier Claude model (Sonnet class) | Good writing and reasoning at moderate cost |
| Development (planning) | Sonnet class; the code itself is written by Codex | |
| QA & Security, Marketing & SEO | Sonnet class; a cheaper model for bulk classification | |
| Hard planning or architecture questions | Opus class, only on explicit request | Higher cost |

Fallbacks are set per profile with OpenRouter routing. Only providers on the guardrail
allowlist can serve requests, with zero data retention required.

## Changing an agent

- Name, instructions, model and active/inactive: owner or admin on the Agents tab (audited).
- Tool permissions, Level 2 rules and memory policy are **material privilege changes**. They
  need a proposed action that only the owner can approve (Level 3), and they are versioned in
  GitHub (M16).
- **Kill switch:** the owner can pause all agents at once from any AI Command Center tab.
  Per agent: set it inactive.
