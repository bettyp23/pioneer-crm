# Michael + Hermes: integration blueprint

Written 2026-11-23 from the owner's brief "Finalize infrastructure and prepare Grok + Hermes
integration". Everything under "Today" was checked against the repository, the database
migrations and the VPS on that date. Nothing here is built yet beyond what "Today" lists.

## Decision this needs (proposed D-40)

The owner's 2026-11-23 brief changes D-37 (2026-11-08, in PR #16):

| | D-37 (Nov 8) | 2026-11-23 brief |
|---|---|---|
| Michael | Becomes a new Hermes bot on a Grok model via OpenRouter; the Grok-app Michael retires | **Stays the Grok-app Michael**, reached through his webhook; Sheets/Drive read-back keeps working at first |
| Hermes | Hosts both bots | **A second, independent agent** with its own worker connection |
| OpenRouter | Required (pay per use) | **Optional**; no new paid infrastructure without a concrete need |
| Collaboration | Inside Hermes | **Through Pioneer OS**: neither agent calls the other directly |

Record it as D-40 (superseding the parts of D-37 above) before building.

## Today (verified)

| Piece | State |
|---|---|
| Pioneer OS app | VPS container behind Traefik at `https://os.pioneerdigitalai.com/login`. Chat with Michael (`messages`, `send_message`). |
| Job queue | `jobs` with `kind`, `agent_id`, `payload`/`result` (jsonb, 64 KB), `status` (queued → running → succeeded/failed/dead/cancelled), priority, `run_after`, attempts/max, per-job timeout, leases (`locked_by`/`locked_until`), idempotency key per kind, `enqueued_by`. `job_attempts` history. `job_dispatches`: one-time reply codes (hash only) and the "may already have gone out" state. `connection_brakes`: max sends per hour per connection. Kill switch (`ai_paused`). |
| Worker API | Schema `worker`, role `pioneer_worker` (no table access, `noinherit`): `claim_jobs(worker, kinds[], limit)` with `for update skip locked`, `heartbeat`, `complete_job`, `fail_job`, `reap_expired`, `begin_dispatch`, `mark_waiting`, `accept_result`, `filter_new_rows`, `expire_waiting`. |
| Michael's worker | `worker/` (TypeScript). Kinds `grok.dispatch` and `claude.task`. Sends with a one-time code, reads replies from the Sheet/Drive folder every 60 s. Container-ready with health check and hold mode (PR #20). |
| Approvals | `proposed_actions` (`send_email`, `deploy`, `price_quote`, `sign_contract`, `publish_content`, `other`; pending → approved/rejected → executed/cancelled), audited. `private.require_approved_action`. No screen on `main` (D-38). |
| Agents registry | `agents` (key, name, role, instructions, provider, model, allowed work types), audited. |
| Hermes | Hermes Agent v0.23.1 (Hostinger template) on the VPS. Dashboard behind its own login at `https://hermes-agent-wp0p.srv2185949.hstgr.cloud`. **API server platform enabled with a key**, listening on port 8642 **inside the container only**. **No AI model connected** ("Providers: none connected"), so it can't do any work yet. Has its own kanban, cron, memory and sessions. MCP not configured. |

## Target architecture

```
                         ┌──────────────────────────────────────────────┐
  Owner (browser) ──────▶│ Pioneer OS app (Next.js, os.pioneerdigitalai)│
   one chat, pick agent  │  send_message(recipient = michael | hermes)  │
   approvals, history    │  approvals UI · task status · cancel         │
                         └───────────────┬──────────────────────────────┘
                                         │ RLS, owner session (aal2)
                         ┌───────────────▼──────────────────────────────┐
                         │ Supabase: messages · jobs · job_dispatches   │
                         │ proposed_actions · agents · audit · brakes   │
                         └──────┬──────────────────────────────┬────────┘
              worker.claim_jobs │ kinds = grok.dispatch        │ kinds = hermes.task
              (pioneer_worker)  │                              │ (pioneer_worker)
                  ┌─────────────▼─────────┐        ┌───────────▼───────────┐
                  │ michael-worker        │        │ hermes-worker         │
                  │ (container, net:      │        │ (container, net:      │
                  │  pioneer-worker)      │        │  pioneer-hermes)      │
                  └─────────────┬─────────┘        └───────────┬───────────┘
          HTTPS webhook + code  │                              │ HTTP + API key, internal network only
                  ┌─────────────▼─────────┐        ┌───────────▼───────────┐
                  │ Michael (Grok routine)│        │ Hermes API server     │
                  │ replies → Sheet/Drive │        │ (no published port)   │
                  └───────────────────────┘        └───────────────────────┘
```

Principles:

1. **Pioneer OS is the only control plane.** Every request, hand-off, result, approval and
   cancellation is a row in Supabase. Agents never call each other.
2. **One queue, one job kind per agent connection.** `grok.dispatch` → Michael's worker,
   `hermes.task` → Hermes's worker. Workers claim only their kinds (`claim_jobs` already takes
   a kinds list).
3. **Same worker code, separate runtime services.** `hermes-worker` is the existing worker
   program started with a different kinds list and sender, in its own container. The two share
   the tested claim/lease/retry code but fail, restart and scale independently. Hermes is never
   coupled to Michael's Sheets polling.
4. **Least privilege at every hop.** Workers use `pioneer_worker` (functions only). Hermes gets
   no database credentials. Each worker holds only its own agent's secret. Hermes's API is
   reachable only from `hermes-worker`, on a private Docker network.
5. **The owner approves anything external or destructive** (deploys, emails, pushes, spending):
   `proposed_actions` must be approved and unexpired before a worker or tool acts.

## Routing and hand-offs

**Direct message.** The owner picks Michael or Hermes in the chat → `send_message(recipient)`
writes the message and enqueues `grok.dispatch` or `hermes.task` with
`payload = {message_id, text, correlation_id}` → the agent's worker sends it → the reply is
recorded as a message (`author = michael_scott | hermes`) linked to the job.

**Michael → Hermes (example: plan a client website).**

1. Owner → Michael: "Plan the Northwind site." (`grok.dispatch`, correlation C)
2. Michael replies with requirements **plus a structured hand-off block** (e.g. a fenced
   `handoff` JSON: target agent, task, inputs, what needs approval).
3. Pioneer parses it into a **pending `proposed_action`** ("Send implementation task to
   Hermes"). Nothing is sent yet.
4. Owner approves → Pioneer enqueues `hermes.task` with `parent_job_id` = Michael's job,
   same correlation C.
5. Hermes works (its own tools, scoped later through MCP) and returns a result; any production
   step it wants comes back as another `proposed_action` (`deploy`) and waits.
6. Optional: Pioneer enqueues `grok.dispatch` "Summarize this result" for Michael, parent =
   Hermes's job, same correlation C.
7. The chat shows the whole thread by correlation C, with each agent's replies and statuses.

Guards: a hand-off always becomes an approval first (auto-approve rules can come later, per
action type). Chain depth is capped (e.g. 4 jobs per correlation). The loop brake applies per
connection. The kill switch stops both workers' claims. Neither agent can see the other's
secrets, and neither can enqueue jobs directly: only Pioneer creates jobs.

## Can the current queue do this?

| Need | Today | For the next phase |
|---|---|---|
| Multiple agent identifiers | ✅ `jobs.agent_id` → `agents` | Add a `hermes` agent row |
| Different job types | ✅ `jobs.kind` (dotted, validated) | Add kind `hermes.task` |
| Agent-specific workers | ✅ `claim_jobs(worker, kinds[])` | Worker setting for its kinds list |
| Parent/child tasks | ⚠️ only `payload.parent_job_id` (no foreign key) | Column `parent_job_id` (FK to jobs) |
| Correlation IDs | ⚠️ none (idempotency key is per kind) | Column `correlation_id` |
| Structured inputs/outputs | ✅ `payload`/`result` jsonb, 64 KB | Document a schema per kind |
| Execution state | ✅ `status`, leases, `job_dispatches` | — |
| Approval states | ✅ `proposed_actions` (separate table) | Link column `proposed_actions.job_id`; action type for hand-offs (use `other` first) |
| Retry / cancellation | ✅ attempts, `retry_job`, `cancel_job`, dead-letter | Hermes worker must honour cancel (stop polling, tell Hermes to stop if its API supports it) |
| Error reporting | ✅ `last_error` (secrets scrubbed), `job_attempts` | — |
| Audit | ✅ audit triggers on agents, work items, approvals; `job_attempts`; `log_event` | Audit hand-offs via `log_event` |
| Allowed values | ❌ `messages.author/recipient`, `job_dispatches.connection/expected_from`, `connection_brakes.connection` list only Michael/Claude | Add `hermes` / `hermes_api` |

Verdict: **extend, don't replace.** The extensions are a handful of check-constraint updates and
three columns. No new tables are needed for the first working version.

## Michael's Sheets path, later

The Sheet/Drive read-back stays as it is. A more direct path is possible if Michael's Grok
routine can make an outbound HTTPS request: a Pioneer endpoint
(`POST /api/agents/michael/reply`) that accepts `{job_id, code, text}`, checks the code's hash
like `accept_result` does today, and records the reply at once. This keeps the same
one-time-code security and removes the 60-second polling. Verify the routine can make that
request before building it.

## What must still be built

1. **A model for Hermes.** It has no AI provider, so it can't answer anything. This is an owner
   decision about cost: OpenRouter, a direct provider key (xAI, Anthropic, OpenAI), or a
   subscription sign-in if this Hermes version supports one. Check Hermes's provider list first.
2. **Hermes reachable from a worker, privately.** Its API server must listen on the container's
   network interface (not only localhost) and join a private `pioneer-hermes` network shared
   with `hermes-worker` only. Still no published port.
3. **Database extension migration** (list above), with pgTAP tests.
4. **`send_message` routing** for recipient `hermes`.
5. **Hermes sender in the worker** (`worker/hermes.ts`): call the API with the key, a per-job
   idempotency key, a timeout and a size limit; record the reply; map Hermes errors to
   retry/no-retry. Plus a `WORKER_KINDS` setting so one codebase runs as two services.
6. **Chat UI**: choose the agent, show who replied, per-message status, cancel.
7. **Hand-offs**: parse the structured block, create the approval, enqueue the child job.
8. **Approvals screen** on the dashboard (D-38 removed it from `main`; the archive branch has
   one to reuse).
9. **Later: MCP.** A role-scoped Pioneer MCP server (D-23) so Hermes can ask for approval or
   post progress itself, with a per-agent token mapped to a narrow database role. Not needed
   for the first version.

## Next-phase plan (in order)

Each step on its own branch, with tests, stopping for the owner's approval.

| # | Step | Work | Done when |
|---|---|---|---|
| 0 | Decisions | Record D-40. Choose Hermes's model provider and a monthly cost cap. | Both written in `docs/decisions.md` |
| 1 | Hermes can think | Connect the chosen provider in Hermes (owner enters the key in Hermes's dashboard or `.env`). | A chat in Hermes's own dashboard answers |
| 2 | Hermes reachable privately | Hermes compose: API server on the container's network interface; new network `pioneer-hermes` (Hermes + a test container). No published port. | `curl` with the key from a throwaway container on that network gets a reply; from the internet and from the app container it's refused |
| 3 | Database | Migration: `hermes` in the allowed-value checks, `hermes.task` kind, `jobs.parent_job_id` + `correlation_id`, `proposed_actions.job_id`, a `hermes` agent row; `send_message` routes `hermes`. | pgTAP: owner can send to Hermes; job created with the right kind; workers can't create jobs; old Michael flow unchanged |
| 4 | Hermes worker | `worker/hermes.ts` sender + `hermes.task` handler; `WORKER_KINDS`; second container `hermes-worker` on `pioneer-hermes` (same hardening as Michael's). | Unit tests with a fake Hermes server (success, timeout, 4xx, 5xx, cancel); on the VPS in hold mode, then a real message to Hermes gets a reply in the chat |
| 5 | One chat, two agents | Agent picker, author badges, status, cancel. | Playwright: send to Michael and to Hermes; both replies appear; cancel a queued task |
| 6 | Hand-off with approval | Parse Michael's `handoff` block → pending approval → on approve, child `hermes.task` (same correlation) → optional summary job back to Michael. Chain-depth cap. | Test: hand-off waits for approval; reject stops it; approve runs it; depth cap enforced |
| 7 | Approvals screen | Bring back the approvals view for `proposed_actions`. | Owner can approve or reject from the dashboard; Playwright covers it |
| 8 | Optional | Direct Michael reply endpoint (if the routine supports it); Pioneer MCP server for Hermes. | Separate decisions |

Out of scope unless a concrete need appears: n8n, extra databases, message brokers,
orchestration frameworks. OpenRouter only if chosen as Hermes's provider in step 0.
