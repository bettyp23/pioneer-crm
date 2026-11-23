-- Pioneer OS — agent chat over webhooks (owner brief 2026-11-23).
-- One chat in Pioneer for several agents. Outbound: the app server POSTs the owner's message to
-- the agent's webhook (Michael Scott, Grok) and records the delivery. Inbound: the agent POSTs
-- its reply to /api/agent-reply, which records it here. Hermes (receptionist) answers through
-- its private API or routes the message to a Grok bot with the same outbound call.
--
-- Security model:
--   * Owners/admins send through public.send_agent_message (session, MFA, role, kill switch).
--   * Everything the app server does on an agent's behalf (claiming and finishing deliveries,
--     recording replies, routing) goes through functions granted to service_role only, called
--     by src/server/agents/store.ts (server-only, import-restricted).
--   * One delivery row per message: a message can be sent to a webhook at most once
--     (pending -> sending -> delivered | failed); nothing moves it back.
--   * Staff read threads, messages and deliveries under the existing RLS rules (viewer+, MFA).
--     Client accounts can't (no membership).
-- The old worker path (send_message, jobs, Google Sheet) is unchanged.

-- ---------------------------------------------------------------------------
-- Threads
-- ---------------------------------------------------------------------------
create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  agent text not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  constraint chat_threads_workspace_id_id_key unique (workspace_id, id),
  constraint chat_threads_agent_known check (agent in ('michael', 'hermes'))
);
create index chat_threads_workspace_agent_idx on public.chat_threads (workspace_id, agent, created_at desc);

-- ---------------------------------------------------------------------------
-- Messages: thread, reply link, agent status, links; Hermes as author/recipient
-- ---------------------------------------------------------------------------
alter table public.messages
  add column thread_id uuid,
  add column in_reply_to uuid,
  add column agent_status text,
  add column links jsonb,
  add constraint messages_thread_fkey foreign key (workspace_id, thread_id)
    references public.chat_threads (workspace_id, id) on delete restrict,
  add constraint messages_in_reply_to_fkey foreign key (workspace_id, in_reply_to)
    references public.messages (workspace_id, id) on delete restrict,
  add constraint messages_agent_status_known
    check (agent_status is null or agent_status in ('working', 'done', 'needs_decision')),
  add constraint messages_links_shape
    check (links is null or (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 10
      and pg_column_size(links) <= 8192));

alter table public.messages drop constraint messages_author_known;
alter table public.messages add constraint messages_author_known
  check (author in ('owner', 'pioneer', 'michael_scott', 'hermes', 'system'));
alter table public.messages drop constraint messages_recipient_known;
alter table public.messages add constraint messages_recipient_known
  check (recipient is null or recipient in ('auto', 'claude', 'michael_scott', 'hermes'));

create index messages_thread_created_idx on public.messages (thread_id, created_at) where thread_id is not null;
-- The same reply posted twice (agent retries) is stored once.
create unique index messages_reply_dedupe_idx
  on public.messages (in_reply_to, author, md5(body), coalesce(agent_status, ''))
  where in_reply_to is not null;

-- ---------------------------------------------------------------------------
-- Deliveries: one per message, never resent
-- ---------------------------------------------------------------------------
create table public.agent_deliveries (
  message_id uuid primary key,
  workspace_id uuid not null,
  target text not null,
  sent_from text not null,
  status text not null default 'pending',
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz,
  constraint agent_deliveries_message_fkey foreign key (workspace_id, message_id)
    references public.messages (workspace_id, id) on delete restrict,
  constraint agent_deliveries_target_known check (target in ('michael')),
  constraint agent_deliveries_from_known check (sent_from in ('bettina', 'hermes')),
  constraint agent_deliveries_status_known check (status in ('pending', 'sending', 'delivered', 'failed')),
  constraint agent_deliveries_attempts_range check (attempts between 0 and 10),
  constraint agent_deliveries_error_length check (last_error is null or length(last_error) <= 300)
);
create index agent_deliveries_workspace_idx on public.agent_deliveries (workspace_id, updated_at desc);

create trigger agent_deliveries_set_updated_at before update on public.agent_deliveries
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: staff read (viewer+), behind the MFA gate; no direct writes for anyone
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['chat_threads', 'agent_deliveries'] loop
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
grant select on public.chat_threads, public.agent_deliveries to authenticated;
-- The app server reads (never writes) these to build outbound calls and Hermes's context.
grant select on public.chat_threads, public.agent_deliveries, public.messages to service_role;

-- ---------------------------------------------------------------------------
-- Owner sends a message to an agent
-- ---------------------------------------------------------------------------
create function private.send_agent_message(p_workspace_id uuid, p_agent text, p_body text, p_flagged boolean)
returns table (thread_id uuid, message_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  body text := btrim(coalesce(p_body, ''));
  tid uuid;
  mid uuid;
begin
  if uid is null or not private.is_mfa() or not private.has_role(p_workspace_id, 'admin') then
    raise exception 'Only owners and admins can message agents' using errcode = 'insufficient_privilege';
  end if;
  if p_agent is null or p_agent not in ('michael', 'hermes') then
    raise exception 'Unknown agent' using errcode = 'check_violation', constraint = 'chat_threads_agent_known';
  end if;
  if private.ai_is_paused(p_workspace_id) then
    raise exception 'All agents are paused' using errcode = 'check_violation', constraint = 'ai_paused';
  end if;

  select t.id into tid from public.chat_threads t
  where t.workspace_id = p_workspace_id and t.agent = p_agent
  order by t.created_at desc limit 1;
  if tid is null then
    insert into public.chat_threads (workspace_id, agent, created_by)
    values (p_workspace_id, p_agent, uid) returning id into tid;
  end if;

  insert into public.messages (workspace_id, author, author_user_id, recipient, body, flagged, thread_id)
  values (p_workspace_id, 'owner', uid,
    case p_agent when 'michael' then 'michael_scott' else 'hermes' end,
    body, coalesce(p_flagged, false), tid)
  returning id into mid;

  if p_agent = 'michael' then
    insert into public.agent_deliveries (message_id, workspace_id, target, sent_from)
    values (mid, p_workspace_id, 'michael', 'bettina');
  end if;

  perform private.log_event(p_workspace_id, 'agent_message.sent', 'message', mid,
    jsonb_build_object('agent', p_agent, 'length', length(body), 'flagged', coalesce(p_flagged, false)));
  return query select tid, mid;
end;
$$;

create function public.send_agent_message(p_workspace_id uuid, p_agent text, p_body text,
  p_flagged boolean default false)
returns table (thread_id uuid, message_id uuid)
language sql
set search_path = ''
as $$ select * from private.send_agent_message(p_workspace_id, p_agent, p_body, p_flagged); $$;

-- ---------------------------------------------------------------------------
-- Server-side (service_role only): deliveries
-- ---------------------------------------------------------------------------

-- Claims a pending delivery for sending. True exactly once per message; false if it was already
-- claimed, sent or failed (so a message is never posted twice, even with concurrent callers).
create function private.claim_agent_delivery(p_message_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.agent_deliveries set status = 'sending'
    where message_id = p_message_id and status = 'pending'
    returning 1
  )
  select exists (select 1 from claimed);
$$;

-- Records one POST attempt's outcome. p_final: no more attempts will follow.
create function private.finish_agent_delivery(p_message_id uuid, p_delivered boolean, p_attempts int,
  p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.agent_deliveries
  set status = case when p_delivered then 'delivered' else 'failed' end,
      attempts = least(greatest(coalesce(p_attempts, 0), 0), 10),
      last_error = case when p_delivered then null else left(p_error, 300) end,
      delivered_at = case when p_delivered then now() else null end
  where message_id = p_message_id and status = 'sending';
  if not found then
    raise exception 'Delivery is not being sent' using errcode = 'check_violation',
      constraint = 'agent_deliveries_status_known';
  end if;
end;
$$;

-- Hermes routes an owner's message to a Grok bot: creates its (single) delivery.
create function private.route_agent_message(p_message_id uuid, p_target text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
begin
  select id, workspace_id, author, recipient into m from public.messages where id = p_message_id;
  if m.id is null or m.author <> 'owner' or m.recipient <> 'hermes' then
    raise exception 'Only messages sent to Hermes can be routed' using errcode = 'check_violation';
  end if;
  insert into public.agent_deliveries (message_id, workspace_id, target, sent_from)
  values (m.id, m.workspace_id, p_target, 'hermes')
  on conflict (message_id) do nothing;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- Server-side (service_role only): an agent's reply
-- ---------------------------------------------------------------------------
-- Michael may only answer a message that was actually delivered (or is being delivered) to him
-- in that thread; Hermes only a message sent to Hermes. The same reply twice is stored once.
create function private.record_agent_reply(p_thread_id uuid, p_in_reply_to uuid, p_author text,
  p_body text, p_status text, p_links jsonb default null, p_kind text default 'answer')
returns table (message_id uuid, duplicate boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
  orig record;
  v_body text := btrim(coalesce(p_body, ''));
  mid uuid;
begin
  if p_author not in ('michael_scott', 'hermes', 'system') then
    raise exception 'Unknown author' using errcode = 'check_violation', constraint = 'messages_author_known';
  end if;
  select id, workspace_id into t from public.chat_threads where id = p_thread_id;
  if t.id is null then
    raise exception 'Unknown thread' using errcode = 'no_data_found';
  end if;
  select id, author, recipient, thread_id into orig from public.messages
  where id = p_in_reply_to and workspace_id = t.workspace_id;
  if orig.id is null or orig.thread_id is distinct from t.id or orig.author <> 'owner' then
    raise exception 'Unknown message in this thread' using errcode = 'no_data_found';
  end if;
  if p_author = 'michael_scott' and not exists (
    select 1 from public.agent_deliveries d
    where d.message_id = orig.id and d.target = 'michael' and d.status in ('sending', 'delivered')
  ) then
    raise exception 'That message was not sent to Michael' using errcode = 'no_data_found';
  end if;
  if p_author = 'hermes' and orig.recipient <> 'hermes' then
    raise exception 'That message was not sent to Hermes' using errcode = 'no_data_found';
  end if;

  select m.id into mid from public.messages m
  where m.in_reply_to = orig.id and m.author = p_author and md5(m.body) = md5(v_body)
    and coalesce(m.agent_status, '') = coalesce(p_status, '');
  if mid is not null then
    return query select mid, true;
    return;
  end if;

  insert into public.messages (workspace_id, author, body, kind, thread_id, in_reply_to, agent_status, links)
  values (t.workspace_id, p_author, v_body, p_kind, t.id, orig.id, p_status, p_links)
  returning id into mid;
  perform private.log_event(t.workspace_id, 'agent_message.reply', 'message', mid,
    jsonb_build_object('author', p_author, 'status', p_status, 'length', length(v_body)));
  return query select mid, false;
end;
$$;

-- Public invoker wrappers (the definer bodies stay in private; docs/security.md).
create function public.claim_agent_delivery(p_message_id uuid)
returns boolean language sql set search_path = ''
as $$ select private.claim_agent_delivery(p_message_id); $$;

create function public.finish_agent_delivery(p_message_id uuid, p_delivered boolean, p_attempts int,
  p_error text default null)
returns void language sql set search_path = ''
as $$ select private.finish_agent_delivery(p_message_id, p_delivered, p_attempts, p_error); $$;

create function public.route_agent_message(p_message_id uuid, p_target text)
returns boolean language sql set search_path = ''
as $$ select private.route_agent_message(p_message_id, p_target); $$;

create function public.record_agent_reply(p_thread_id uuid, p_in_reply_to uuid, p_author text,
  p_body text, p_status text, p_links jsonb default null, p_kind text default 'answer')
returns table (message_id uuid, duplicate boolean) language sql set search_path = ''
as $$ select * from private.record_agent_reply(p_thread_id, p_in_reply_to, p_author, p_body, p_status,
  p_links, p_kind); $$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.send_agent_message(uuid, text, text, boolean)',
    'private.send_agent_message(uuid, text, text, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'public.claim_agent_delivery(uuid)',
    'private.claim_agent_delivery(uuid)',
    'public.finish_agent_delivery(uuid, boolean, int, text)',
    'private.finish_agent_delivery(uuid, boolean, int, text)',
    'public.route_agent_message(uuid, text)',
    'private.route_agent_message(uuid, text)',
    'public.record_agent_reply(uuid, uuid, text, text, text, jsonb, text)',
    'private.record_agent_reply(uuid, uuid, text, text, text, jsonb, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;
