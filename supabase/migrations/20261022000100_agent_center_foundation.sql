-- Pioneer OS — M7: Agent Center foundation (Pioneer OS 3.0, phase 2 start).
-- Hermes-era agent roster, supported providers (no Grok/Perplexity), workspace AI kill switch,
-- durable job queue for the VPS worker. See docs/milestone-7-plan.md, docs/os3/, D-23…D-27.

-- ---------------------------------------------------------------------------
-- 1. Kill switch (D-26): one owner-only switch pauses every agent in a workspace.
-- ---------------------------------------------------------------------------
alter table public.workspaces
  add column ai_paused_at timestamptz,
  add column ai_paused_by uuid references auth.users (id),
  add column ai_pause_reason text,
  add constraint workspaces_ai_pause_reason_length check (ai_pause_reason is null or length(ai_pause_reason) <= 500),
  add constraint workspaces_ai_pause_fields check (ai_paused_at is not null or (ai_paused_by is null and ai_pause_reason is null));

-- Fails closed: an unknown workspace counts as paused.
create function private.ai_is_paused(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select w.ai_paused_at is not null from public.workspaces w where w.id = p_workspace_id), true);
$$;

create function private.set_ai_paused(p_workspace_id uuid, p_paused boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  was_paused boolean;
begin
  if not private.is_mfa() or not private.has_role(p_workspace_id, 'owner') then
    raise exception 'Only the owner can pause or resume agents' using errcode = 'insufficient_privilege';
  end if;
  select ai_paused_at is not null into was_paused from public.workspaces where id = p_workspace_id for update;
  if was_paused = p_paused then
    return;
  end if;
  update public.workspaces set
    ai_paused_at = case when p_paused then now() end,
    ai_paused_by = case when p_paused then (select auth.uid()) end,
    ai_pause_reason = case when p_paused then nullif(btrim(left(coalesce(p_reason, ''), 500)), '') end
  where id = p_workspace_id;
  perform private.log_event(p_workspace_id, case when p_paused then 'ai.paused' else 'ai.resumed' end,
    'workspace', p_workspace_id,
    case when p_paused then jsonb_build_object('reason', nullif(btrim(left(coalesce(p_reason, ''), 500)), '')) end);
end;
$$;

create function public.set_ai_paused(p_workspace_id uuid, p_paused boolean, p_reason text default null)
returns void language sql set search_path = '' as $$
  select private.set_ai_paused(p_workspace_id, p_paused, p_reason); $$;

-- Automated spending stops while paused.
create or replace function private.ai_budget_allows(p_workspace_id uuid, p_provider public.ai_provider, p_estimate_microusd bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not private.ai_is_paused(p_workspace_id) and coalesce((
    select s.remaining_microusd >= p_estimate_microusd
    from public.ai_spend_this_month s
    where s.workspace_id = p_workspace_id and s.provider = p_provider), false);
$$;

-- Dispatch is blocked while paused or when the agent is inactive. Otherwise unchanged from M6.
create or replace function private.transition_work_item(
  p_id uuid,
  p_to public.work_item_status,
  p_expected_version int,
  p_override_reason text,
  p_output_text text,
  p_output_url text,
  p_review_note text
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.agent_work_items;
  a public.agents;
  need_admin boolean;
begin
  select * into w from public.agent_work_items where id = p_id for update;
  if not found or not private.is_mfa() or not private.has_role(w.workspace_id, 'member') then
    raise exception 'Not allowed to change this work item' using errcode = 'insufficient_privilege';
  end if;
  if w.version <> p_expected_version then
    raise exception 'This work item was changed by someone else. Reload and try again.'
      using errcode = 'check_violation', constraint = 'agent_work_items_version_conflict';
  end if;
  if (w.status, p_to) not in (
    ('draft', 'ready'), ('ready', 'draft'), ('ready', 'dispatched'), ('dispatched', 'returned'),
    ('returned', 'accepted'), ('returned', 'rejected'),
    ('draft', 'cancelled'), ('ready', 'cancelled'), ('dispatched', 'cancelled'), ('returned', 'cancelled')
  ) then
    raise exception 'A work item can''t move from % to %', w.status, p_to
      using errcode = 'check_violation', constraint = 'agent_work_items_transition';
  end if;

  -- Dispatching and reviewing are owner/admin decisions (security.md §3 "Dispatch / accept").
  need_admin := p_to in ('dispatched', 'accepted', 'rejected') or (p_to = 'cancelled' and w.status <> 'draft');
  if need_admin and not private.has_role(w.workspace_id, 'admin') then
    raise exception 'Only owners and admins can dispatch, review or cancel work items'
      using errcode = 'insufficient_privilege';
  end if;

  select * into a from public.agents where id = w.agent_id;
  if p_to in ('ready', 'dispatched') and not a.is_active then
    raise exception 'This agent is inactive' using errcode = 'check_violation', constraint = 'agents_inactive';
  end if;
  if p_to = 'dispatched' and private.ai_is_paused(w.workspace_id) then
    raise exception 'Agents are paused. Resume them in the AI Command Center first.'
      using errcode = 'check_violation', constraint = 'workspaces_ai_paused';
  end if;

  if p_to = 'ready' then
    if not (w.work_type = any (a.allowed_work_types)) then
      raise exception '% does not take % work', a.name, replace(w.work_type::text, '_', ' ')
        using errcode = 'check_violation', constraint = 'agents_work_type';
    end if;
    if w.context_snapshot is null or w.sensitivity_flags is null then
      raise exception 'Build the context before marking it ready'
        using errcode = 'check_violation', constraint = 'agent_work_items_ready_has_snapshot';
    end if;
    if w.sensitivity_flags <> '[]'::jsonb and length(btrim(coalesce(p_override_reason, ''))) = 0 then
      raise exception 'Sensitive content was flagged; give a reason to send it anyway'
        using errcode = 'check_violation', constraint = 'agent_work_items_flags_need_reason';
    end if;
  end if;

  update public.agent_work_items set
    status = p_to,
    override_reason = case when p_to = 'ready' then nullif(btrim(coalesce(p_override_reason, '')), '')
                           when p_to = 'draft' then null else override_reason end,
    dispatched_by = case when p_to = 'dispatched' then (select auth.uid()) else dispatched_by end,
    dispatched_at = case when p_to = 'dispatched' then now() else dispatched_at end,
    output_text = case when p_to = 'returned' then nullif(btrim(coalesce(p_output_text, '')), '') else output_text end,
    output_url = case when p_to = 'returned' then nullif(btrim(coalesce(p_output_url, '')), '') else output_url end,
    returned_at = case when p_to = 'returned' then now() else returned_at end,
    reviewed_by = case when p_to in ('accepted', 'rejected') then (select auth.uid()) else reviewed_by end,
    reviewed_at = case when p_to in ('accepted', 'rejected') then now() else reviewed_at end,
    review_note = case when p_to in ('accepted', 'rejected') then nullif(btrim(coalesce(p_review_note, '')), '')
                       else review_note end
  where id = w.id;
  return w.version + 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Providers (D-24): Grok and Perplexity are no longer part of the stack.
--    Enum values stay so historic ledger rows remain readable; new rows can't use them.
-- ---------------------------------------------------------------------------
update public.agents set provider = 'openrouter' where provider in ('xai', 'perplexity');
update public.ai_budgets b set provider = 'openrouter'
where b.provider = 'xai'
  and not exists (select 1 from public.ai_budgets o where o.workspace_id = b.workspace_id and o.provider = 'openrouter');
delete from public.ai_budgets where provider in ('xai', 'perplexity');

alter table public.agents
  add constraint agents_provider_supported check (provider not in ('xai', 'perplexity'));
alter table public.ai_budgets
  add constraint ai_budgets_provider_supported check (provider not in ('xai', 'perplexity'));
-- NOT VALID: the append-only ledger keeps its history; only new rows are checked.
alter table public.ai_usage
  add constraint ai_usage_provider_supported check (provider not in ('xai', 'perplexity')) not valid;

create or replace function private.seed_ai_budgets(ws uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.ai_budgets (workspace_id, provider, monthly_cap_minor) values
    (ws, 'anthropic', 5000), (ws, 'openrouter', 5000)
  on conflict (workspace_id, provider) do nothing;
$$;

-- ---------------------------------------------------------------------------
-- 3. Roster (D-25): the eight Pioneer OS 3.0 roles, coordinated by Hermes.
--    Existing records are renamed in place (ids, instructions and history kept); the two
--    roles with no 3.0 counterpart are retired, not deleted.
-- ---------------------------------------------------------------------------
create or replace function private.seed_agents(ws uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.agents (workspace_id, key, name, role_summary, provider, allowed_work_types) values
    (ws, 'operations', 'Operations Agent', 'Coordinates workflows, schedules and task routing; flags stalled or blocked work and escalates decisions to you.', 'openrouter', '{plan,operations,other}'),
    (ws, 'sales', 'Sales Agent', 'Qualifies leads under approved rules; drafts follow-ups, package recommendations and proposals. Never promises nonstandard prices, dates or scope.', 'openrouter', '{research,draft_message,plan}'),
    (ws, 'client_onboarding', 'Client Onboarding Agent', 'After verified events, prepares onboarding material, finds missing information and writes project briefs.', 'openrouter', '{draft_message,plan,operations}'),
    (ws, 'development', 'Development Agent', 'Turns approved scope into tasks and coordinates Codex on feature branches and pull requests. Never changes production without approval.', 'openai', '{code,plan}'),
    (ws, 'qa_security', 'QA & Security Agent', 'Runs reproducible checks — tests, accessibility, performance, dependencies, security — and blocks releases that fail.', 'openrouter', '{qa}'),
    (ws, 'marketing_seo', 'Marketing & SEO Agent', 'Technical SEO audits, metadata and content suggestions, analytics reviews and client reports.', 'openrouter', '{research,draft_message,qa}'),
    (ws, 'client_success', 'Client Success & Maintenance Agent', 'Watches site health, classifies support requests, prepares status reports and escalates emergencies.', 'openrouter', '{operations,qa,draft_message}'),
    (ws, 'finance_admin', 'Finance & Admin Agent', 'Reads invoice and subscription status, tracks receivables and renewals, drafts reminders. Never moves money or signs.', 'openrouter', '{operations,draft_message,other}')
  on conflict (workspace_id, key) do nothing;
$$;

update public.agents a set
  key = m.new_key,
  name = m.name,
  role_summary = m.summary,
  allowed_work_types = m.work_types::public.agent_work_type[],
  provider = case when m.new_key = 'development' and a.provider = 'openrouter' then 'openai' else a.provider end
from (values
  ('micheal_scott', 'operations', 'Operations Agent', 'Coordinates workflows, schedules and task routing; flags stalled or blocked work and escalates decisions to you.', '{plan,operations,other}'),
  ('client_desk', 'sales', 'Sales Agent', 'Qualifies leads under approved rules; drafts follow-ups, package recommendations and proposals. Never promises nonstandard prices, dates or scope.', '{research,draft_message,plan}'),
  ('developer', 'development', 'Development Agent', 'Turns approved scope into tasks and coordinates Codex on feature branches and pull requests. Never changes production without approval.', '{code,plan}'),
  ('reviewer_qa', 'qa_security', 'QA & Security Agent', 'Runs reproducible checks — tests, accessibility, performance, dependencies, security — and blocks releases that fail.', '{qa}'),
  ('maintenance', 'client_success', 'Client Success & Maintenance Agent', 'Watches site health, classifies support requests, prepares status reports and escalates emergencies.', '{operations,qa,draft_message}'),
  ('operations_finance', 'finance_admin', 'Finance & Admin Agent', 'Reads invoice and subscription status, tracks receivables and renewals, drafts reminders. Never moves money or signs.', '{operations,draft_message,other}')
) as m (old_key, new_key, name, summary, work_types)
where a.key = m.old_key
  and not exists (select 1 from public.agents b where b.workspace_id = a.workspace_id and b.key = m.new_key);

update public.agents set is_active = false, name = left(name, 110) || ' (retired)'
where key in ('research', 'setup') and is_active;

select private.seed_agents(id), private.seed_ai_budgets(id) from public.workspaces;

-- ---------------------------------------------------------------------------
-- 4. Durable job queue (D-27). Postgres is the queue: jobs survive restarts, are claimed with
--    leases (FOR UPDATE SKIP LOCKED), retried with backoff and dead-lettered. Users and the app
--    never write jobs directly; the VPS worker uses only the functions in schema `worker`.
-- ---------------------------------------------------------------------------
create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed', 'dead', 'cancelled');

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  kind text not null,
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  agent_id uuid,
  work_item_id uuid,
  status public.job_status not null default 'queued',
  priority smallint not null default 100,
  run_after timestamptz not null default now(),
  attempts int not null default 0,
  max_attempts int not null default 5,
  timeout_seconds int not null default 900,
  locked_by text,
  locked_until timestamptz,
  last_error text,
  result jsonb,
  enqueued_by uuid references auth.users (id),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_workspace_id_id_key unique (workspace_id, id),
  constraint jobs_idempotency_key unique (workspace_id, kind, idempotency_key),
  constraint jobs_agent_fkey foreign key (workspace_id, agent_id)
    references public.agents (workspace_id, id) on delete restrict,
  constraint jobs_work_item_fkey foreign key (workspace_id, work_item_id)
    references public.agent_work_items (workspace_id, id) on delete restrict,
  constraint jobs_kind_format check (kind ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$' and length(kind) <= 80),
  constraint jobs_agent_kind_needs_agent check (kind !~ '^agent\.' or agent_id is not null),
  constraint jobs_idempotency_key_length check (length(btrim(idempotency_key)) between 1 and 200),
  constraint jobs_payload_object check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 65536),
  constraint jobs_result_size check (result is null or pg_column_size(result) <= 262144),
  constraint jobs_priority_range check (priority between 0 and 1000),
  constraint jobs_attempts_range check (attempts between 0 and max_attempts),
  constraint jobs_max_attempts_range check (max_attempts between 1 and 20),
  constraint jobs_timeout_range check (timeout_seconds between 10 and 86400),
  constraint jobs_last_error_length check (last_error is null or length(last_error) <= 2000),
  constraint jobs_locked_by_length check (locked_by is null or length(locked_by) between 1 and 100),
  constraint jobs_running_is_locked check ((status = 'running') = (locked_by is not null and locked_until is not null)),
  constraint jobs_finished_fields check (
    (status in ('succeeded', 'failed', 'dead', 'cancelled')) = (finished_at is not null))
);
create index jobs_claim_idx on public.jobs (priority, run_after) where status = 'queued';
create index jobs_lease_idx on public.jobs (locked_until) where status = 'running';
create index jobs_workspace_status_idx on public.jobs (workspace_id, status, created_at desc);

-- One row per attempt: the failure and retry history (Agent Center).
create table public.job_attempts (
  id bigint generated always as identity primary key,
  workspace_id uuid not null,
  job_id uuid not null,
  attempt int not null,
  worker text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text not null default 'running',
  error text,
  constraint job_attempts_job_fkey foreign key (workspace_id, job_id)
    references public.jobs (workspace_id, id) on delete restrict,
  constraint job_attempts_outcome check (
    outcome in ('running', 'succeeded', 'retry', 'failed', 'dead', 'timed_out', 'cancelled')),
  constraint job_attempts_finished check ((outcome = 'running') = (finished_at is null)),
  constraint job_attempts_error_length check (error is null or length(error) <= 2000)
);
create index job_attempts_job_idx on public.job_attempts (job_id, attempt);

create trigger jobs_set_updated_at before update on public.jobs
  for each row execute function private.set_updated_at();

-- Error text from workers is stored and shown in the UI; strip anything shaped like a credential.
create function private.redact_secrets(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(regexp_replace(regexp_replace(coalesce(p_text, ''),
    '\m(?:sk|pk|rk|sb_secret|sb_publishable|ghp|gho|ghs|ghu|github_pat|AKIA|AIza|whsec|xox[abp])[-_]?[A-Za-z0-9_-]{8,}',
    '[redacted]', 'g'),
    '(bearer|authorization:|password=|token=|apikey=|api_key=)\s*\S+', '\1 [redacted]', 'gi'), 2000);
$$;

create function private.job_backoff(p_attempts int)
returns interval
language sql
immutable
set search_path = ''
as $$
  select make_interval(secs => least(30 * power(2, greatest(p_attempts - 1, 0)), 3600));
$$;

-- Agent jobs may run only while the workspace isn't paused and the agent is active.
create function private.job_may_run(p_workspace_id uuid, p_agent_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_agent_id is null or (
    not private.ai_is_paused(p_workspace_id)
    and coalesce((select a.is_active from public.agents a where a.id = p_agent_id), false));
$$;

-- Used by the app (admins) and by deterministic triggers in later milestones.
-- Idempotent: the same (workspace, kind, key) returns the existing job.
create function private.enqueue_job(
  p_workspace_id uuid,
  p_kind text,
  p_idempotency_key text,
  p_payload jsonb,
  p_agent_id uuid,
  p_work_item_id uuid,
  p_run_after timestamptz,
  p_max_attempts int
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  jid uuid;
begin
  if (select auth.uid()) is not null
     and (not private.is_mfa() or not private.has_role(p_workspace_id, 'admin')) then
    raise exception 'Only owners and admins can queue jobs' using errcode = 'insufficient_privilege';
  end if;
  insert into public.jobs (workspace_id, kind, idempotency_key, payload, agent_id, work_item_id,
    run_after, max_attempts, enqueued_by)
  values (p_workspace_id, p_kind, p_idempotency_key, coalesce(p_payload, '{}'::jsonb), p_agent_id,
    p_work_item_id, coalesce(p_run_after, now()), coalesce(p_max_attempts, 5), (select auth.uid()))
  on conflict on constraint jobs_idempotency_key do nothing
  returning id into jid;
  if jid is null then
    select id into jid from public.jobs
    where workspace_id = p_workspace_id and kind = p_kind and idempotency_key = p_idempotency_key;
  else
    perform private.log_event(p_workspace_id, 'job.enqueued', 'job', jid,
      jsonb_build_object('kind', p_kind, 'agent_id', p_agent_id));
  end if;
  return jid;
end;
$$;

create function private.cancel_job(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.jobs;
begin
  select * into j from public.jobs where id = p_id for update;
  if not found or not private.is_mfa() or not private.has_role(j.workspace_id, 'admin') then
    raise exception 'Only owners and admins can cancel jobs' using errcode = 'insufficient_privilege';
  end if;
  if j.status not in ('queued', 'running') then
    raise exception 'Only queued or running jobs can be cancelled'
      using errcode = 'check_violation', constraint = 'jobs_cancel_state';
  end if;
  update public.jobs set status = 'cancelled', locked_by = null, locked_until = null, finished_at = now()
  where id = j.id;
  update public.job_attempts set outcome = 'cancelled', finished_at = now()
  where job_id = j.id and outcome = 'running';
  perform private.log_event(j.workspace_id, 'job.cancelled', 'job', j.id, jsonb_build_object('kind', j.kind));
end;
$$;

create function private.retry_job(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.jobs;
begin
  select * into j from public.jobs where id = p_id for update;
  if not found or not private.is_mfa() or not private.has_role(j.workspace_id, 'admin') then
    raise exception 'Only owners and admins can retry jobs' using errcode = 'insufficient_privilege';
  end if;
  if j.status not in ('failed', 'dead', 'cancelled') then
    raise exception 'Only failed, dead or cancelled jobs can be retried'
      using errcode = 'check_violation', constraint = 'jobs_retry_state';
  end if;
  if j.attempts >= 20 then
    raise exception 'This job has used all 20 attempts; queue a new one instead'
      using errcode = 'check_violation', constraint = 'jobs_retry_limit';
  end if;
  update public.jobs set status = 'queued', run_after = now(), finished_at = null,
    max_attempts = least(j.attempts + 3, 20)
  where id = j.id;
  perform private.log_event(j.workspace_id, 'job.retried', 'job', j.id,
    jsonb_build_object('kind', j.kind, 'attempts', j.attempts));
end;
$$;

create function public.enqueue_job(
  p_workspace_id uuid, p_kind text, p_idempotency_key text, p_payload jsonb default '{}'::jsonb,
  p_agent_id uuid default null, p_work_item_id uuid default null, p_run_after timestamptz default null,
  p_max_attempts int default 5)
returns uuid language sql set search_path = '' as $$
  select private.enqueue_job(p_workspace_id, p_kind, p_idempotency_key, p_payload, p_agent_id,
    p_work_item_id, p_run_after, p_max_attempts); $$;

create function public.cancel_job(p_id uuid)
returns void language sql set search_path = '' as $$ select private.cancel_job(p_id); $$;

create function public.retry_job(p_id uuid)
returns void language sql set search_path = '' as $$ select private.retry_job(p_id); $$;

-- ---------------------------------------------------------------------------
-- Worker API: schema `worker`, callable only by the `pioneer_worker` role. The role has no
-- table privileges and no login until an operator enables it (docs/os3/OPERATIONS_RUNBOOK.md).
-- ---------------------------------------------------------------------------
create schema worker;
revoke all on schema worker from public;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'pioneer_worker') then
    create role pioneer_worker nologin noinherit;
  end if;
end;
$$;
grant usage on schema worker to pioneer_worker;

-- Expired leases go back to the queue (or dead-letter when out of attempts).
create function worker.reap_expired()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  with expired as (
    select id from public.jobs
    where status = 'running' and locked_until < now()
    for update skip locked
  ), moved as (
    update public.jobs j set
      status = case when j.attempts >= j.max_attempts then 'dead'::public.job_status else 'queued'::public.job_status end,
      run_after = case when j.attempts >= j.max_attempts then j.run_after else now() + private.job_backoff(j.attempts) end,
      finished_at = case when j.attempts >= j.max_attempts then now() end,
      locked_by = null, locked_until = null,
      last_error = 'Timed out: the worker stopped reporting progress'
    from expired e where j.id = e.id
    returning j.id, j.workspace_id, j.kind, j.status
  ), closed as (
    update public.job_attempts a set outcome = 'timed_out', finished_at = now()
    from moved m where a.job_id = m.id and a.outcome = 'running'
    returning a.id
  ), logged as (
    insert into public.audit_events (workspace_id, actor_type, action, entity_type, entity_id, changes)
    select m.workspace_id, 'system', 'job.dead', 'job', m.id, jsonb_build_object('kind', m.kind, 'reason', 'timed_out')
    from moved m where m.status = 'dead'
    returning id
  )
  select count(*) into n from moved;
  return n;
end;
$$;

create function worker.claim_jobs(p_worker text, p_kinds text[], p_limit int default 1)
returns setof public.jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_worker is null or length(btrim(p_worker)) not between 1 and 100 then
    raise exception 'worker name must be 1–100 characters' using errcode = 'check_violation';
  end if;
  perform worker.reap_expired();
  return query
  with picked as (
    select j.id from public.jobs j
    where j.status = 'queued' and j.run_after <= now() and j.kind = any (p_kinds)
      and j.attempts < j.max_attempts
      and private.job_may_run(j.workspace_id, j.agent_id)
    order by j.priority, j.run_after, j.created_at
    limit greatest(1, least(coalesce(p_limit, 1), 50))
    for update skip locked
  ), claimed as (
    update public.jobs j set
      status = 'running', attempts = j.attempts + 1, locked_by = btrim(p_worker),
      locked_until = now() + make_interval(secs => j.timeout_seconds),
      started_at = coalesce(j.started_at, now())
    from picked p where j.id = p.id
    returning j.*
  ), logged as (
    insert into public.job_attempts (workspace_id, job_id, attempt, worker)
    select c.workspace_id, c.id, c.attempts, c.locked_by from claimed c
    returning id
  )
  select * from claimed;
end;
$$;

-- Returns false when the worker must stop: lease lost, job cancelled, agents paused, agent inactive.
create function worker.heartbeat(p_job_id uuid, p_worker text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.jobs;
begin
  select * into j from public.jobs where id = p_job_id for update;
  if not found or j.status <> 'running' or j.locked_by is distinct from btrim(p_worker)
     or not private.job_may_run(j.workspace_id, j.agent_id) then
    return false;
  end if;
  update public.jobs set locked_until = now() + make_interval(secs => j.timeout_seconds) where id = j.id;
  return true;
end;
$$;

-- Returns false when the worker no longer holds the job; it must then discard its result.
create function worker.complete_job(p_job_id uuid, p_worker text, p_result jsonb default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.jobs;
begin
  select * into j from public.jobs where id = p_job_id for update;
  if not found or j.status <> 'running' or j.locked_by is distinct from btrim(p_worker) then
    return false;
  end if;
  update public.jobs set status = 'succeeded', result = p_result, locked_by = null, locked_until = null,
    finished_at = now(), last_error = null
  where id = j.id;
  update public.job_attempts set outcome = 'succeeded', finished_at = now()
  where job_id = j.id and attempt = j.attempts and outcome = 'running';
  return true;
end;
$$;

-- Retryable failures go back to the queue with exponential backoff until max_attempts, then
-- dead-letter. Permanent failures stop at once. Returns the new status (null if not held).
create function worker.fail_job(p_job_id uuid, p_worker text, p_error text, p_retryable boolean default true)
returns public.job_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.jobs;
  next_status public.job_status;
  err text := private.redact_secrets(p_error);
begin
  select * into j from public.jobs where id = p_job_id for update;
  if not found or j.status <> 'running' or j.locked_by is distinct from btrim(p_worker) then
    return null;
  end if;
  next_status := case
    when not coalesce(p_retryable, true) then 'failed'::public.job_status
    when j.attempts >= j.max_attempts then 'dead'::public.job_status
    else 'queued'::public.job_status end;
  update public.jobs set
    status = next_status,
    run_after = case when next_status = 'queued' then now() + private.job_backoff(j.attempts) else run_after end,
    finished_at = case when next_status <> 'queued' then now() end,
    locked_by = null, locked_until = null, last_error = nullif(err, '')
  where id = j.id;
  update public.job_attempts set
    outcome = case next_status when 'queued' then 'retry' else next_status::text end,
    finished_at = now(), error = nullif(err, '')
  where job_id = j.id and attempt = j.attempts and outcome = 'running';
  if next_status <> 'queued' then
    perform private.log_event(j.workspace_id, 'job.' || next_status::text, 'job', j.id,
      jsonb_build_object('kind', j.kind, 'attempts', j.attempts));
  end if;
  return next_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['jobs', 'job_attempts'] loop
    execute format('alter table public.%1$s enable row level security', t);
    execute format(
      'create policy %1$s_require_mfa on public.%1$s as restrictive for all to authenticated
         using ((select private.is_mfa())) with check ((select private.is_mfa()))', t);
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated
         using ((select private.has_role(workspace_id, ''viewer'')))', t);
  end loop;
end;
$$;

-- Payloads and results stay server-side; the UI reads status columns only.
grant select (id, workspace_id, kind, agent_id, work_item_id, status, priority, run_after, attempts,
  max_attempts, timeout_seconds, locked_by, locked_until, last_error, started_at, finished_at,
  created_at, updated_at, enqueued_by) on public.jobs to authenticated;
grant select on public.job_attempts to authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.set_ai_paused(uuid, boolean, text)',
    'private.set_ai_paused(uuid, boolean, text)',
    'public.enqueue_job(uuid, text, text, jsonb, uuid, uuid, timestamptz, int)',
    'private.enqueue_job(uuid, text, text, jsonb, uuid, uuid, timestamptz, int)',
    'public.cancel_job(uuid)',
    'private.cancel_job(uuid)',
    'public.retry_job(uuid)',
    'private.retry_job(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'worker.reap_expired()',
    'worker.claim_jobs(text, text[], int)',
    'worker.heartbeat(uuid, text)',
    'worker.complete_job(uuid, text, jsonb)',
    'worker.fail_job(uuid, text, text, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to pioneer_worker', f);
  end loop;
end;
$$;
revoke all on function private.ai_is_paused(uuid) from public, anon, authenticated;
revoke all on function private.job_may_run(uuid, uuid) from public, anon, authenticated;
revoke all on function private.redact_secrets(text) from public, anon, authenticated;
revoke all on function private.job_backoff(int) from public, anon, authenticated;
