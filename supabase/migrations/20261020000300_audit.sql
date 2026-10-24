-- Pioneer OS — M1 step 3: append-only audit log (FR-AUD-1, FR-AUD-2).
-- See docs/schema.md §3 (`audit_events`).

create type public.actor_type as enum ('user', 'system', 'agent');

create table public.audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  occurred_at timestamptz not null default now(),
  actor_type public.actor_type not null,
  -- No ON DELETE action: audit rows are immutable, so users with history are suspended, not deleted.
  actor_user_id uuid references auth.users (id),
  actor_agent_id uuid, -- FK to agents added in M6
  action text not null,
  entity_type text not null,
  entity_id uuid,
  changes jsonb,
  context jsonb,
  constraint audit_events_action_format check (action ~ '^[a-z_]+\.[a-z_]+$'),
  constraint audit_events_actor_consistent check (
    (actor_type = 'user' and actor_user_id is not null and actor_agent_id is null)
    or (actor_type = 'agent' and actor_agent_id is not null)
    or (actor_type = 'system' and actor_agent_id is null)
  )
);

create index audit_events_workspace_occurred_idx
  on public.audit_events (workspace_id, occurred_at desc);
create index audit_events_entity_idx on public.audit_events (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Writers (security definer; the only way rows get in)
-- ---------------------------------------------------------------------------

-- Explicit events from RPC functions (M2+).
create function private.log_event(
  ws uuid,
  action text,
  entity_type text,
  entity_id uuid,
  changes jsonb default null,
  context jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  insert into public.audit_events
    (workspace_id, actor_type, actor_user_id, action, entity_type, entity_id, changes, context)
  values
    (ws, case when uid is null then 'system' else 'user' end::public.actor_type, uid,
     action, entity_type, entity_id, changes, context);
end;
$$;

-- Row-change trigger. Arguments:
--   TG_ARGV[0]  entity name used in `action` (e.g. 'workspace_member' → 'workspace_member.updated')
--   TG_ARGV[1]  column holding the entity id
--   TG_ARGV[2]  column holding the workspace id
--   TG_ARGV[3+] allowlisted columns recorded in `changes` (sensitive columns are never listed)
create function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  entity_name text := tg_argv[0];
  id_col text := tg_argv[1];
  ws_col text := tg_argv[2];
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  cur_row jsonb := coalesce(new_row, old_row);
  diff jsonb := '{}'::jsonb;
  col text;
  i int;
begin
  for i in 3 .. tg_nargs - 1 loop
    col := tg_argv[i];
    if tg_op = 'UPDATE' then
      if (old_row -> col) is distinct from (new_row -> col) then
        diff := diff || jsonb_build_object(col, jsonb_build_array(old_row -> col, new_row -> col));
      end if;
    else
      diff := diff || jsonb_build_object(col, cur_row -> col);
    end if;
  end loop;

  -- Updates that touch no audited column (e.g. only updated_at) are not recorded.
  if tg_op = 'UPDATE' and diff = '{}'::jsonb then
    return null;
  end if;

  perform private.log_event(
    (cur_row ->> ws_col)::uuid,
    entity_name || '.' || case tg_op
      when 'INSERT' then 'created'
      when 'UPDATE' then 'updated'
      else 'deleted'
    end,
    tg_table_name,
    (cur_row ->> id_col)::uuid,
    diff,
    jsonb_build_object('source', 'trigger')
  );
  return null;
end;
$$;

-- Append-only, even for privileged roles that bypass grants.
create function private.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_events is append-only'
    using errcode = 'insufficient_privilege';
end;
$$;

revoke all on function private.log_event(uuid, text, text, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.audit_row_change() from public, anon, authenticated;
revoke all on function private.prevent_audit_mutation() from public, anon, authenticated;

create trigger audit_events_prevent_update_delete
  before update or delete on public.audit_events
  for each row execute function private.prevent_audit_mutation();
create trigger audit_events_prevent_truncate
  before truncate on public.audit_events
  for each statement execute function private.prevent_audit_mutation();

-- ---------------------------------------------------------------------------
-- Audited tables (M1)
-- ---------------------------------------------------------------------------
-- Workspaces are never deleted (audit_events references them), so only insert/update are audited.
create trigger workspaces_audit
  after insert or update on public.workspaces
  for each row execute function private.audit_row_change('workspace', 'id', 'id', 'name', 'slug', 'timezone');

create trigger workspace_members_audit
  after insert or update or delete on public.workspace_members
  for each row execute function private.audit_row_change(
    'workspace_member', 'user_id', 'workspace_id', 'user_id', 'role', 'status');

-- ---------------------------------------------------------------------------
-- RLS and grants: owners/admins read; nobody writes through the API.
-- ---------------------------------------------------------------------------
alter table public.audit_events enable row level security;

create policy audit_events_require_mfa on public.audit_events
  as restrictive for all to authenticated
  using ((select private.is_mfa())) with check ((select private.is_mfa()));

create policy audit_events_select on public.audit_events
  for select to authenticated
  using ((select private.has_role(workspace_id, 'admin')));

grant select on public.audit_events to authenticated;
grant select on public.audit_events to service_role;
