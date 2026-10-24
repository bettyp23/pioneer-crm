-- Pioneer OS — M1 step 2: workspaces, profiles, memberships, role helpers, RLS.
-- See docs/schema.md §3 and docs/security.md §3.

create type public.workspace_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.member_status as enum ('active', 'suspended');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_name_not_blank check (length(btrim(name)) between 1 and 120),
  constraint workspaces_slug_format check (slug ~ '^[a-z0-9-]{2,40}$'),
  constraint workspaces_slug_key unique (slug),
  constraint workspaces_timezone_valid check (private.is_valid_timezone(timezone))
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_not_blank check (length(btrim(display_name)) between 1 and 120)
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- References profiles (not auth.users directly) so members can be listed with names.
  user_id uuid not null references public.profiles (user_id) on delete restrict,
  role public.workspace_role not null,
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_id_idx on public.workspace_members (user_id);

create trigger workspaces_set_updated_at before update on public.workspaces
  for each row execute function private.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger workspace_members_set_updated_at before update on public.workspace_members
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------
create function private.role_rank(r public.workspace_role)
returns int
language sql
immutable
set search_path = ''
as $$
  select case r
    when 'owner' then 4
    when 'admin' then 3
    when 'member' then 2
    when 'viewer' then 1
  end;
$$;

-- True when the caller is an active member of `ws` with at least `min_role`.
-- security definer so policies on workspace_members can call it without recursion.
create function private.has_role(ws uuid, min_role public.workspace_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and private.role_rank(m.role) >= private.role_rank(min_role)
  );
$$;

-- True when the caller and `other_user` are both active members of a common workspace.
create function private.shares_workspace(other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'active'
      and theirs.user_id = other_user
  );
$$;

revoke all on function private.role_rank(public.workspace_role) from public, anon;
revoke all on function private.has_role(uuid, public.workspace_role) from public, anon;
revoke all on function private.shares_workspace(uuid) from public, anon;
grant execute on function private.role_rank(public.workspace_role) to authenticated;
grant execute on function private.has_role(uuid, public.workspace_role) to authenticated;
grant execute on function private.shares_workspace(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- A workspace always keeps at least one active owner (FR-WS-2).
-- ---------------------------------------------------------------------------
create function private.prevent_last_owner_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role <> 'owner' or old.status <> 'active' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.role = 'owner' and new.status = 'active' then
    return new;
  end if;

  -- Serialize concurrent owner changes within the workspace.
  perform 1 from public.workspaces w where w.id = old.workspace_id for update;

  if not exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = old.workspace_id
      and m.user_id <> old.user_id
      and m.role = 'owner'
      and m.status = 'active'
  ) then
    raise exception 'A workspace must keep at least one active owner'
      using errcode = 'check_violation',
            constraint = 'workspace_members_last_owner';
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function private.prevent_last_owner_removal() from public, anon;

create trigger workspace_members_prevent_last_owner_removal
  before update of role, status or delete on public.workspace_members
  for each row execute function private.prevent_last_owner_removal();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.workspace_members enable row level security;

-- MFA required for every table (restrictive = AND-ed with the permissive policies).
create policy workspaces_require_mfa on public.workspaces
  as restrictive for all to authenticated
  using ((select private.is_mfa())) with check ((select private.is_mfa()));
create policy profiles_require_mfa on public.profiles
  as restrictive for all to authenticated
  using ((select private.is_mfa())) with check ((select private.is_mfa()));
create policy workspace_members_require_mfa on public.workspace_members
  as restrictive for all to authenticated
  using ((select private.is_mfa())) with check ((select private.is_mfa()));

-- workspaces: members read; owners edit settings. Created only by the bootstrap script.
create policy workspaces_select on public.workspaces
  for select to authenticated
  using ((select private.has_role(id, 'viewer')));
create policy workspaces_update on public.workspaces
  for update to authenticated
  using ((select private.has_role(id, 'owner')))
  with check ((select private.has_role(id, 'owner')));

-- profiles: your own, and people you share a workspace with. Edit your own only.
create policy profiles_select on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.shares_workspace(user_id)));
create policy profiles_update on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- workspace_members: members read the roster; only owners manage it.
create policy workspace_members_select on public.workspace_members
  for select to authenticated
  using ((select private.has_role(workspace_id, 'viewer')));
create policy workspace_members_insert on public.workspace_members
  for insert to authenticated
  with check ((select private.has_role(workspace_id, 'owner')));
create policy workspace_members_update on public.workspace_members
  for update to authenticated
  using ((select private.has_role(workspace_id, 'owner')))
  with check ((select private.has_role(workspace_id, 'owner')));
create policy workspace_members_delete on public.workspace_members
  for delete to authenticated
  using ((select private.has_role(workspace_id, 'owner')));

-- ---------------------------------------------------------------------------
-- Grants (explicit; anon gets nothing)
-- ---------------------------------------------------------------------------
grant select on public.workspaces to authenticated;
grant update (name, timezone) on public.workspaces to authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select, delete on public.workspace_members to authenticated;
grant insert (workspace_id, user_id, role, status) on public.workspace_members to authenticated;
grant update (role, status) on public.workspace_members to authenticated;

-- service_role: used only by scripts/bootstrap-owner.ts (docs/security.md §4).
grant select, insert, update on public.workspaces to service_role;
grant select, insert, update on public.profiles to service_role;
grant select, insert, update on public.workspace_members to service_role;
