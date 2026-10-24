-- M8: Pioneer loop (docs/milestone-8-plan.md; decisions D-29, D-30, D-33…D-35).
-- You write to Pioneer; the worker sends the message to Pioneer (Claude, a scheduled task on
-- your subscription) or to Michael Scott (Grok webhook). Replies come back as rows in the
-- Agency Dashboard sheet, and count only with the job ID and one-time code they were sent with.

-- ---------------------------------------------------------------------------
-- 1. Roster (D-29, D-30): Pioneer (Claude) and Michael Scott (Grok). The eight M7 roles are
--    retired, not deleted, so their work items and history stay.
-- ---------------------------------------------------------------------------
alter table public.agents
  add column kind text not null default 'manual',
  add column integration_state text not null default 'not_connected',
  add column last_verified_at timestamptz,
  add constraint agents_kind_known check (kind in ('manual', 'claude_task', 'grok_team')),
  add constraint agents_integration_state_known check (integration_state in ('not_connected', 'verified', 'error'));

-- Michael Scott runs on the owner's Grok plan (no xAI API key), so Grok is allowed for agents
-- again. Perplexity stays blocked; budgets and the cost ledger keep the M7 rules.
alter table public.agents drop constraint agents_provider_supported;
alter table public.agents add constraint agents_provider_supported check (provider <> 'perplexity');

update public.agents set is_active = false, name = left(name, 110) || ' (retired)'
where is_active and key in ('operations', 'sales', 'client_onboarding', 'development', 'qa_security',
  'marketing_seo', 'client_success', 'finance_admin');

-- Loop brake per connection (D-33): spending is capped by the owner's plans; this only stops
-- runaway back-and-forth. Max tasks per rolling hour; when hit, the connection pauses until the
-- owner resumes it.
create table public.connection_brakes (
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  connection text not null,
  hourly_limit int not null default 20,
  paused_at timestamptz,
  paused_reason text,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, connection),
  constraint connection_brakes_connection_known check (connection in ('claude_task', 'grok_webhook')),
  constraint connection_brakes_limit_range check (hourly_limit between 1 and 30),
  constraint connection_brakes_reason_length check (paused_reason is null or length(paused_reason) <= 300)
);
create trigger connection_brakes_set_updated_at before update on public.connection_brakes
  for each row execute function private.set_updated_at();

create or replace function private.seed_agents(ws uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.agents (workspace_id, key, name, role_summary, provider, allowed_work_types, kind) values
    (ws, 'pioneer', 'Pioneer (Claude)', 'The brain inside Pioneer: reads your messages, answers them or routes agency work to Michael Scott. Runs as a Claude Code scheduled task on your Claude plan.', 'anthropic', '{research,draft_message,plan,other}', 'claude_task'),
    (ws, 'michael_scott', 'Michael Scott (Grok)', 'Leads your Grok team (Client Desk, Reviewer, Setup, Developer and the others) and assigns their work. Reached through his "Pioneer OS task intake" webhook.', 'xai', '{research,draft_message,plan,code,qa,operations,other}', 'grok_team')
  on conflict (workspace_id, key) do nothing;
  insert into public.connection_brakes (workspace_id, connection) values (ws, 'claude_task'), (ws, 'grok_webhook')
  on conflict do nothing;
$$;
select private.seed_agents(id) from public.workspaces;

create function private.agent_connection(p_agent_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case a.kind when 'claude_task' then 'claude_task' when 'grok_team' then 'grok_webhook' end
  from public.agents a where a.id = p_agent_id;
$$;

-- Agent jobs also stop while their connection's brake is on.
create or replace function private.job_may_run(p_workspace_id uuid, p_agent_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_agent_id is null or (
    not private.ai_is_paused(p_workspace_id)
    and coalesce((select a.is_active from public.agents a where a.id = p_agent_id), false)
    and not exists (
      select 1 from public.connection_brakes b
      where b.workspace_id = p_workspace_id and b.connection = private.agent_connection(p_agent_id)
        and b.paused_at is not null));
$$;

-- ---------------------------------------------------------------------------
-- 2. Jobs that wait for a reply, and are sent at most once
-- ---------------------------------------------------------------------------
-- Neither the Claude fire endpoint nor the Grok webhook removes duplicates, so these jobs are
-- never retried automatically: a lost or failed send stops for the owner to retry by hand.
alter table public.jobs
  add column at_most_once boolean not null default false,
  add column waiting_until timestamptz,
  add column external_ref text,
  add constraint jobs_at_most_once_attempts check (not at_most_once or max_attempts <= attempts + 1),
  add constraint jobs_waiting_fields check ((status = 'waiting_external') = (waiting_until is not null)),
  add constraint jobs_external_ref_length check (external_ref is null or length(external_ref) <= 500);
create index jobs_waiting_idx on public.jobs (waiting_until) where status = 'waiting_external';
grant select (at_most_once, waiting_until, external_ref) on public.jobs to authenticated;

alter table public.job_attempts drop constraint job_attempts_outcome;
alter table public.job_attempts add constraint job_attempts_outcome check (
  outcome in ('running', 'succeeded', 'retry', 'failed', 'dead', 'timed_out', 'cancelled', 'dispatched'));

create or replace function private.cancel_job(p_id uuid)
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
  if j.status not in ('queued', 'running', 'waiting_external') then
    raise exception 'Only queued, running or waiting jobs can be cancelled'
      using errcode = 'check_violation', constraint = 'jobs_cancel_state';
  end if;
  update public.jobs set status = 'cancelled', locked_by = null, locked_until = null, waiting_until = null,
    finished_at = now()
  where id = j.id;
  update public.job_attempts set outcome = 'cancelled', finished_at = now()
  where job_id = j.id and outcome = 'running';
  perform private.log_event(j.workspace_id, 'job.cancelled', 'job', j.id, jsonb_build_object('kind', j.kind));
end;
$$;

-- A manual retry of an at-most-once job allows exactly one more send.
create or replace function private.retry_job(p_id uuid)
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
    max_attempts = case when j.at_most_once then j.attempts + 1 else least(j.attempts + 3, 20) end
  where id = j.id;
  perform private.log_event(j.workspace_id, 'job.retried', 'job', j.id,
    jsonb_build_object('kind', j.kind, 'attempts', j.attempts));
end;
$$;

-- At-most-once jobs never go back to the queue on a failure.
create or replace function worker.fail_job(p_job_id uuid, p_worker text, p_error text, p_retryable boolean default true)
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
    when not coalesce(p_retryable, true) or j.at_most_once then 'failed'::public.job_status
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
-- 3. Sends and one-time codes. Only the SHA-256 of each code is stored; the worker keeps the
--    code in memory just long enough to send it.
-- ---------------------------------------------------------------------------
create table public.job_dispatches (
  workspace_id uuid not null,
  job_id uuid not null,
  attempt int not null,
  connection text not null,
  expected_from text not null,
  code_sha256 text not null,
  dispatched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  primary key (job_id, attempt),
  constraint job_dispatches_job_fkey foreign key (workspace_id, job_id)
    references public.jobs (workspace_id, id) on delete restrict,
  constraint job_dispatches_connection_known check (connection in ('claude_task', 'grok_webhook')),
  constraint job_dispatches_from_known check (expected_from in ('pioneer_brain', 'michael_scott')),
  constraint job_dispatches_code_format check (code_sha256 ~ '^[0-9a-f]{64}$'),
  constraint job_dispatches_expiry check (expires_at > dispatched_at)
);
create index job_dispatches_brake_idx on public.job_dispatches (workspace_id, connection, dispatched_at desc);

-- Every sheet row the worker has looked at, so each one is processed once. Rows that match no
-- open job have no workspace and are visible only in the worker's own log.
create table public.result_rows (
  row_key text primary key,
  workspace_id uuid references public.workspaces (id) on delete restrict,
  job_id uuid,
  outcome text not null,
  reason text,
  seen_at timestamptz not null default now(),
  constraint result_rows_job_fkey foreign key (workspace_id, job_id)
    references public.jobs (workspace_id, id) on delete restrict,
  constraint result_rows_key_format check (row_key ~ '^[0-9a-f]{64}$'),
  constraint result_rows_outcome_known check (outcome in ('accepted', 'ignored')),
  constraint result_rows_reason_length check (reason is null or length(reason) <= 200)
);
create index result_rows_job_idx on public.result_rows (job_id);

-- ---------------------------------------------------------------------------
-- 4. Chat: one conversation per workspace. Messages are never edited or deleted.
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  author text not null,
  author_user_id uuid references auth.users (id),
  recipient text,
  kind text not null default 'message',
  body text not null,
  job_id uuid,
  flagged boolean not null default false,
  created_at timestamptz not null default now(),
  constraint messages_workspace_id_id_key unique (workspace_id, id),
  constraint messages_job_fkey foreign key (workspace_id, job_id)
    references public.jobs (workspace_id, id) on delete restrict,
  constraint messages_author_known check (author in ('owner', 'pioneer', 'michael_scott', 'system')),
  constraint messages_recipient_known check (recipient is null or recipient in ('auto', 'claude', 'michael_scott')),
  constraint messages_kind_known check (kind in ('message', 'answer', 'routed', 'result', 'needs_decision', 'notice')),
  constraint messages_owner_fields check ((author = 'owner') = (author_user_id is not null and recipient is not null)),
  constraint messages_body_length check (length(btrim(body)) between 1 and 20000)
);
create index messages_workspace_created_idx on public.messages (workspace_id, created_at desc);
create index messages_job_idx on public.messages (job_id);

-- Like private.redact_secrets, for long text (replies are shown in full).
create function private.redact_secrets_long(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(regexp_replace(regexp_replace(coalesce(p_text, ''),
    '\m(?:sk|pk|rk|sb_secret|sb_publishable|ghp|gho|ghs|ghu|github_pat|AKIA|AIza|whsec|xox[abp])[-_]?[A-Za-z0-9_-]{8,}',
    '[redacted]', 'g'),
    '(bearer|authorization:|password=|token=|apikey=|api_key=)\s*\S+', '\1 [redacted]', 'gi'), 20000);
$$;

-- Queues one at-most-once send. Used by send_message and when Pioneer routes to Michael Scott.
create function private.enqueue_send(
  p_workspace_id uuid, p_agent_key text, p_idempotency_key text, p_payload jsonb, p_enqueued_by uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.agents;
  jid uuid;
begin
  select * into a from public.agents where workspace_id = p_workspace_id and key = p_agent_key;
  if not found or not a.is_active then
    raise exception '% is not available', coalesce(a.name, p_agent_key)
      using errcode = 'check_violation', constraint = 'agents_active';
  end if;
  insert into public.jobs (workspace_id, kind, idempotency_key, payload, agent_id, at_most_once, max_attempts,
    timeout_seconds, enqueued_by)
  values (p_workspace_id, case a.kind when 'claude_task' then 'claude.task' else 'grok.dispatch' end,
    p_idempotency_key, p_payload, a.id, true, 1, 120, p_enqueued_by)
  on conflict on constraint jobs_idempotency_key do nothing
  returning id into jid;
  if jid is not null then
    perform private.log_event(p_workspace_id, 'job.enqueued', 'job', jid,
      jsonb_build_object('kind', case a.kind when 'claude_task' then 'claude.task' else 'grok.dispatch' end,
        'agent_id', a.id));
  end if;
  return jid;
end;
$$;

-- Owners and admins write to Pioneer. 'auto' and 'claude' go to Pioneer (Claude); 'auto' lets it
-- route agency work on to Michael Scott. 'michael_scott' goes straight to his webhook.
create function private.send_message(p_workspace_id uuid, p_body text, p_recipient text, p_flagged boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  mid uuid;
  jid uuid;
  body text := btrim(coalesce(p_body, ''));
begin
  if uid is null or not private.is_mfa() or not private.has_role(p_workspace_id, 'admin') then
    raise exception 'Only owners and admins can write to Pioneer' using errcode = 'insufficient_privilege';
  end if;
  if p_recipient is null or p_recipient not in ('auto', 'claude', 'michael_scott') then
    raise exception 'Unknown recipient' using errcode = 'check_violation', constraint = 'messages_recipient_known';
  end if;
  insert into public.messages (workspace_id, author, author_user_id, recipient, body, flagged)
  values (p_workspace_id, 'owner', uid, p_recipient, body, coalesce(p_flagged, false))
  returning id into mid;
  jid := private.enqueue_send(p_workspace_id,
    case p_recipient when 'michael_scott' then 'michael_scott' else 'pioneer' end,
    'message:' || mid,
    case p_recipient
      when 'michael_scott' then jsonb_build_object('message_id', mid, 'client', null, 'task', body)
      else jsonb_build_object('message_id', mid, 'mode', case p_recipient when 'claude' then 'answer' else 'auto' end,
        'message', body) end,
    uid);
  update public.messages set job_id = jid where id = mid;
  perform private.log_event(p_workspace_id, 'message.sent', 'message', mid,
    jsonb_build_object('recipient', p_recipient, 'length', length(body), 'flagged', coalesce(p_flagged, false)));
  return mid;
end;
$$;

create function public.send_message(p_workspace_id uuid, p_body text, p_recipient text default 'auto',
  p_flagged boolean default false)
returns uuid language sql set search_path = '' as $$
  select private.send_message(p_workspace_id, p_body, p_recipient, p_flagged); $$;

create function private.resume_connection(p_workspace_id uuid, p_connection text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_mfa() or not private.has_role(p_workspace_id, 'owner') then
    raise exception 'Only the owner can resume a connection' using errcode = 'insufficient_privilege';
  end if;
  update public.connection_brakes set paused_at = null, paused_reason = null
  where workspace_id = p_workspace_id and connection = p_connection and paused_at is not null;
  if found then
    perform private.log_event(p_workspace_id, 'connection.resumed', 'connection_brake', null,
      jsonb_build_object('connection', p_connection));
  end if;
end;
$$;

create function public.resume_connection(p_workspace_id uuid, p_connection text)
returns void language sql set search_path = '' as $$
  select private.resume_connection(p_workspace_id, p_connection); $$;

-- ---------------------------------------------------------------------------
-- 5. Worker API for sends and replies (role pioneer_worker, no table access)
-- ---------------------------------------------------------------------------
-- Call before sending. 'ok': send now. 'braked': the hourly brake tripped, the job goes back to
-- the queue and waits for the owner. 'already_sent': this attempt was already sent (a crash
-- after sending); the worker must fail the job instead of sending again. 'not_held'.
create function worker.begin_dispatch(p_job_id uuid, p_worker text, p_code_sha256 text, p_wait_seconds int)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.jobs;
  conn text;
  b public.connection_brakes;
  recent int;
begin
  select * into j from public.jobs where id = p_job_id for update;
  if not found or j.status <> 'running' or j.locked_by is distinct from btrim(p_worker) then
    return 'not_held';
  end if;
  conn := private.agent_connection(j.agent_id);
  if conn is null or not j.at_most_once then
    raise exception 'Job % is not a send', j.id using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.job_dispatches d where d.job_id = j.id and d.attempt = j.attempts) then
    return 'already_sent';
  end if;
  select * into b from public.connection_brakes
  where workspace_id = j.workspace_id and connection = conn for update;
  select count(*) into recent from public.job_dispatches d
  where d.workspace_id = j.workspace_id and d.connection = conn and d.dispatched_at > now() - interval '1 hour';
  if b.paused_at is null and recent >= b.hourly_limit then
    update public.connection_brakes set paused_at = now(),
      paused_reason = format('Loop brake: %s tasks in the last hour', recent)
    where workspace_id = j.workspace_id and connection = conn;
    perform private.log_event(j.workspace_id, 'connection.braked', 'connection_brake', null,
      jsonb_build_object('connection', conn, 'tasks_last_hour', recent));
    insert into public.messages (workspace_id, author, kind, body, job_id)
    values (j.workspace_id, 'system', 'notice', format(
      '%s is paused: %s tasks were sent in the last hour (limit %s). Check for a loop, then resume it on Agents → Usage.',
      case conn when 'claude_task' then 'Pioneer (Claude)' else 'Michael Scott (Grok)' end, recent, b.hourly_limit), j.id);
  end if;
  if b.paused_at is not null or recent >= b.hourly_limit then
    update public.jobs set status = 'queued', locked_by = null, locked_until = null, run_after = now(),
      max_attempts = j.attempts + 1
    where id = j.id;
    update public.job_attempts set outcome = 'retry', finished_at = now(), error = 'Connection paused by the loop brake'
    where job_id = j.id and attempt = j.attempts and outcome = 'running';
    return 'braked';
  end if;
  if p_code_sha256 is null or p_code_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'code_sha256 must be 64 hex characters' using errcode = 'check_violation';
  end if;
  insert into public.job_dispatches (workspace_id, job_id, attempt, connection, expected_from, code_sha256, expires_at)
  values (j.workspace_id, j.id, j.attempts, conn,
    case conn when 'claude_task' then 'pioneer_brain' else 'michael_scott' end, p_code_sha256,
    now() + make_interval(secs => greatest(60, least(coalesce(p_wait_seconds, 1800), 172800))));
  return 'ok';
end;
$$;

-- After a successful send: the job waits for its reply row until the code expires.
create function worker.mark_waiting(p_job_id uuid, p_worker text, p_external_ref text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.jobs;
  d public.job_dispatches;
begin
  select * into j from public.jobs where id = p_job_id for update;
  if not found or j.status <> 'running' or j.locked_by is distinct from btrim(p_worker) then
    return false;
  end if;
  select * into d from public.job_dispatches where job_id = j.id and attempt = j.attempts;
  if not found then
    return false;
  end if;
  update public.jobs set status = 'waiting_external', waiting_until = d.expires_at,
    external_ref = left(nullif(btrim(p_external_ref), ''), 500), locked_by = null, locked_until = null
  where id = j.id;
  update public.job_attempts set outcome = 'dispatched', finished_at = now()
  where job_id = j.id and attempt = j.attempts and outcome = 'running';
  perform private.log_event(j.workspace_id, 'job.dispatched', 'job', j.id,
    jsonb_build_object('kind', j.kind, 'connection', d.connection, 'expires_at', d.expires_at));
  return true;
end;
$$;

-- Of the given row keys, the ones not processed yet.
create function worker.filter_new_rows(p_row_keys text[])
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(k), '{}') from unnest(p_row_keys) as k
  where not exists (select 1 from public.result_rows r where r.row_key = k);
$$;

-- One row from the Pioneer Results tab. Returns 'accepted', 'duplicate' or 'ignored: <reason>'.
-- The text is stored as a plain-text message; nothing in it is ever executed or treated as an
-- approval.
create function worker.accept_result(
  p_row_key text, p_job_id uuid, p_code text, p_from text, p_kind text, p_client text, p_text text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.jobs;
  d public.job_dispatches;
  reason text;
  body text := private.redact_secrets_long(btrim(coalesce(p_text, '')));
  msg_kind text;
  route boolean := false;
begin
  if p_row_key is null or p_row_key !~ '^[0-9a-f]{64}$' then
    raise exception 'row_key must be 64 hex characters' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.result_rows where row_key = p_row_key) then
    return 'duplicate';
  end if;

  if p_job_id is not null then
    select * into j from public.jobs where id = p_job_id for update;
  end if;
  if j.id is null then
    reason := 'unknown job';
  elsif j.status <> 'waiting_external' then
    reason := 'job is not waiting for a reply';
  else
    select * into d from public.job_dispatches where job_id = j.id and attempt = j.attempts for update;
    if d.job_id is null or p_code is null
       or encode(extensions.digest(p_code, 'sha256'), 'hex') <> d.code_sha256 then
      reason := 'wrong code';
    elsif d.used_at is not null then
      reason := 'code already used';
    elsif d.expires_at < now() then
      reason := 'code expired';
    elsif p_from is distinct from d.expected_from then
      reason := 'wrong sender';
    elsif not ((p_from = 'pioneer_brain' and p_kind in ('answer', 'route'))
            or (p_from = 'michael_scott' and p_kind in ('result', 'needs_decision'))) then
      reason := 'unknown kind';
    elsif length(body) = 0 then
      reason := 'empty text';
    end if;
  end if;

  if reason is not null then
    insert into public.result_rows (row_key, workspace_id, job_id, outcome, reason)
    values (p_row_key, j.workspace_id, j.id, 'ignored', reason);
    if j.id is not null then
      perform private.log_event(j.workspace_id, 'job.reply_ignored', 'job', j.id, jsonb_build_object('reason', reason));
    end if;
    return 'ignored: ' || reason;
  end if;

  update public.job_dispatches set used_at = now() where job_id = d.job_id and attempt = d.attempt;
  insert into public.result_rows (row_key, workspace_id, job_id, outcome)
  values (p_row_key, j.workspace_id, j.id, 'accepted');

  route := p_kind = 'route' and j.kind = 'claude.task' and coalesce(j.payload ->> 'mode', 'auto') = 'auto';
  msg_kind := case
    when route then 'routed'
    when p_kind = 'route' then 'answer'
    else p_kind end;
  insert into public.messages (workspace_id, author, kind, body, job_id)
  values (j.workspace_id, case p_from when 'pioneer_brain' then 'pioneer' else 'michael_scott' end, msg_kind, body, j.id);

  update public.jobs set status = 'succeeded', waiting_until = null, finished_at = now(), last_error = null,
    result = jsonb_build_object('from', p_from, 'kind', p_kind, 'row_key', p_row_key)
  where id = j.id;
  update public.agents set integration_state = 'verified', last_verified_at = now() where id = j.agent_id;
  perform private.log_event(j.workspace_id, 'job.reply_accepted', 'job', j.id,
    jsonb_build_object('from', p_from, 'kind', p_kind));

  if route then
    begin
      perform private.enqueue_send(j.workspace_id, 'michael_scott', 'route:' || j.id,
        jsonb_build_object('message_id', j.payload ->> 'message_id', 'parent_job_id', j.id,
          'client', nullif(left(btrim(coalesce(p_client, '')), 200), ''), 'task', body),
        j.enqueued_by);
    exception when check_violation then
      insert into public.messages (workspace_id, author, kind, body, job_id)
      values (j.workspace_id, 'system', 'notice', 'Michael Scott is not available, so this task was not sent.', j.id);
    end;
  end if;
  return 'accepted';
end;
$$;

-- Sends whose reply didn't arrive before the code expired: failed, with a notice in the chat.
create function worker.expire_waiting()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  with expired as (
    select id from public.jobs where status = 'waiting_external' and waiting_until < now()
    for update skip locked
  ), moved as (
    update public.jobs j set status = 'failed', waiting_until = null, finished_at = now(),
      last_error = 'No reply in the Pioneer Results sheet before the deadline'
    from expired e where j.id = e.id
    returning j.id, j.workspace_id, j.kind, j.agent_id
  ), noticed as (
    insert into public.messages (workspace_id, author, kind, body, job_id)
    select m.workspace_id, 'system', 'notice',
      format('No reply from %s before the deadline. You can retry it on Agents → Jobs.', a.name), m.id
    from moved m join public.agents a on a.id = m.agent_id
    returning id
  ), logged as (
    insert into public.audit_events (workspace_id, actor_type, action, entity_type, entity_id, changes)
    select m.workspace_id, 'system', 'job.failed', 'job', m.id, jsonb_build_object('kind', m.kind, 'reason', 'no_reply')
    from moved m
    returning id
  )
  select count(*) into n from moved;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. RLS + grants
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['connection_brakes', 'job_dispatches', 'result_rows', 'messages'] loop
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

grant select on public.connection_brakes, public.result_rows, public.messages to authenticated;
-- The code hash stays server-side.
grant select (workspace_id, job_id, attempt, connection, expected_from, dispatched_at, expires_at, used_at)
  on public.job_dispatches to authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.send_message(uuid, text, text, boolean)',
    'private.send_message(uuid, text, text, boolean)',
    'public.resume_connection(uuid, text)',
    'private.resume_connection(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'worker.begin_dispatch(uuid, text, text, int)',
    'worker.mark_waiting(uuid, text, text)',
    'worker.filter_new_rows(text[])',
    'worker.accept_result(text, uuid, text, text, text, text, text)',
    'worker.expire_waiting()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to pioneer_worker', f);
  end loop;
end;
$$;
revoke all on function private.agent_connection(uuid) from public, anon, authenticated;
revoke all on function private.enqueue_send(uuid, text, text, jsonb, uuid) from public, anon, authenticated;
revoke all on function private.redact_secrets_long(text) from public, anon, authenticated;
