-- Pioneer OS — client portal (D-39).
-- Clients get invite-only accounts tied to one client record and read their own projects,
-- steps, approvals, shared files and requests. Staff ("admin" accounts) keep full access
-- through workspace membership exactly as before.
--
-- Security model (docs/security.md §3a):
--   * profiles.role is 'admin' or 'client'. New profiles are 'client'; nobody can make an
--     account 'admin' through the API (the column is not granted). Only workspace members
--     may be 'admin', and only 'admin' accounts may be workspace members.
--   * A client account sees rows whose client_id equals profiles.client_id, and nothing
--     else. Every policy below also sits behind the restrictive MFA (aal2) policy.
--   * Clients may only INSERT requests and approval responses for their own client.
--   * The clients table itself stays staff-only (it holds internal notes); the portal reads
--     the client's name through public.portal_client().

-- ---------------------------------------------------------------------------
-- Account role on profiles
-- ---------------------------------------------------------------------------
create type public.account_role as enum ('admin', 'client');

alter table public.profiles
  add column role public.account_role not null default 'client',
  add column client_id uuid references public.clients (id) on delete set null,
  add column email extensions.citext,
  add constraint profiles_admin_has_no_client check (role = 'client' or client_id is null),
  add constraint profiles_email_format check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

create index profiles_client_id_idx on public.profiles (client_id) where client_id is not null;

-- Existing staff (everyone with a workspace membership) become 'admin' accounts.
update public.profiles p set role = 'admin'
where exists (select 1 from public.workspace_members m where m.user_id = p.user_id);

-- Only 'admin' accounts can be workspace members, so a client can never gain staff access.
create function private.members_must_be_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p where p.user_id = new.user_id and p.role = 'admin'
  ) then
    raise exception 'Client accounts cannot be workspace members'
      using errcode = 'check_violation', constraint = 'workspace_members_admin_profile';
  end if;
  return new;
end;
$$;
revoke all on function private.members_must_be_admin() from public, anon, authenticated;

create trigger workspace_members_admin_profile
  before insert or update of user_id on public.workspace_members
  for each row execute function private.members_must_be_admin();

-- And an 'admin' account cannot be turned into a client while it is a member.
create function private.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'client' and old.role = 'admin'
     and exists (select 1 from public.workspace_members m where m.user_id = new.user_id) then
    raise exception 'Remove the workspace membership before changing this account to a client'
      using errcode = 'check_violation', constraint = 'profiles_member_is_admin';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_profile_role() from public, anon, authenticated;

create trigger profiles_guard_role
  before update of role on public.profiles
  for each row execute function private.guard_profile_role();

-- ---------------------------------------------------------------------------
-- Helpers (security definer so policies can call them without recursion)
-- ---------------------------------------------------------------------------

-- The caller's client record, or null for staff and unassigned client accounts.
create function private.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.client_id
  from public.profiles p
  where p.user_id = (select auth.uid()) and p.role = 'client';
$$;

create function private.client_workspace_id(c uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select cl.workspace_id from public.clients cl where cl.id = c;
$$;

-- True when the caller is staff with at least `min_role` in the client's workspace.
create function private.is_client_staff(c uuid, min_role public.workspace_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.has_role(private.client_workspace_id(c), min_role), false);
$$;

create function private.project_client_id(p uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select pr.client_id from public.projects pr where pr.id = p;
$$;

-- Parses a uuid; null when the text is not one (storage paths are user-supplied).
create function private.try_uuid(t text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return t::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'private.current_client_id()',
    'private.client_workspace_id(uuid)',
    'private.is_client_staff(uuid, public.workspace_role)',
    'private.project_client_id(uuid)',
    'private.try_uuid(text)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- Staff see the client accounts of their workspace's clients (for the admin page).
create policy profiles_select_portal_users on public.profiles
  for select to authenticated
  using (
    role = 'client' and client_id is not null
    and (select private.is_client_staff(client_id, 'viewer'))
  );

-- ---------------------------------------------------------------------------
-- Projects: plain-language portal fields; projects without a blueprint
-- ---------------------------------------------------------------------------
alter table public.projects
  alter column blueprint_version_id drop not null,
  add column current_phase text,
  add column next_steps text,
  add column launch_on date,
  add constraint projects_current_phase_length check (current_phase is null or length(current_phase) <= 120),
  add constraint projects_next_steps_length check (next_steps is null or length(next_steps) <= 2000);

grant update (current_phase, next_steps, launch_on) on public.projects to authenticated;

drop trigger projects_audit on public.projects;
create trigger projects_audit after update on public.projects
  for each row execute function private.audit_row_change(
    'project', 'id', 'workspace_id', 'name', 'status', 'target_end_on', 'current_phase',
    'launch_on');

create policy projects_select_client on public.projects
  for select to authenticated
  using (client_id = (select private.current_client_id()));

create policy project_tasks_select_client on public.project_tasks
  for select to authenticated
  using ((select private.current_client_id()) is not null
         and private.project_client_id(project_id) = (select private.current_client_id()));

-- ---------------------------------------------------------------------------
-- Approvals: client-facing details, decisions made in the portal
-- ---------------------------------------------------------------------------
alter table public.approvals
  add column details text,
  add column decided_in_portal boolean not null default false,
  add constraint approvals_details_length check (details is null or length(details) <= 2000);

-- A yes/no given by the client's own signed-in account is its own evidence.
alter table public.approvals drop constraint approvals_client_evidence;
alter table public.approvals add constraint approvals_client_evidence check (
  approver_type <> 'client' or status not in ('approved', 'rejected')
  or (client_contact_id is not null and evidence_url is not null)
  or decided_in_portal
);

create policy approvals_select_client on public.approvals
  for select to authenticated
  using (client_id = (select private.current_client_id()) and approver_type = 'client');

create table public.approval_responses (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references public.approvals (id) on delete restrict,
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete restrict,
  decision public.approval_status not null,
  comment text,
  responded_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  constraint approval_responses_one_per_approval unique (approval_id),
  constraint approval_responses_decision check (decision in ('approved', 'rejected')),
  constraint approval_responses_comment_length check (comment is null or length(comment) <= 2000)
);
create index approval_responses_client_id_idx on public.approval_responses (client_id);

-- Fills workspace/client from the approval and checks it is the caller's and still open.
-- RLS then requires client_id = the caller's client (WITH CHECK sees the final row).
create function private.approval_responses_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.approvals;
begin
  select * into a from public.approvals where id = new.approval_id for update;
  if not found or a.client_id is distinct from private.current_client_id()
     or a.approver_type <> 'client' then
    raise exception 'Not allowed to answer this approval' using errcode = 'insufficient_privilege';
  end if;
  if a.status <> 'pending' then
    raise exception 'This approval has already been answered'
      using errcode = 'check_violation', constraint = 'approvals_immutable';
  end if;
  new.workspace_id := a.workspace_id;
  new.client_id := a.client_id;
  new.responded_by := (select auth.uid());
  new.comment := nullif(btrim(coalesce(new.comment, '')), '');
  new.created_at := now();
  return new;
end;
$$;

create function private.approval_responses_apply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.approvals set
    status = new.decision,
    decided_by_user_id = new.responded_by,
    decided_at = new.created_at,
    decision_note = new.comment,
    decided_in_portal = true,
    version = version + 1
  where id = new.approval_id;
  return null;
end;
$$;
revoke all on function private.approval_responses_prepare() from public, anon, authenticated;
revoke all on function private.approval_responses_apply() from public, anon, authenticated;

create trigger approval_responses_prepare before insert on public.approval_responses
  for each row execute function private.approval_responses_prepare();
create trigger approval_responses_apply after insert on public.approval_responses
  for each row execute function private.approval_responses_apply();
create trigger approval_responses_audit after insert on public.approval_responses
  for each row execute function private.audit_row_change(
    'approval_response', 'id', 'workspace_id', 'approval_id', 'client_id', 'decision',
    'responded_by');

-- ---------------------------------------------------------------------------
-- Client requests (change requests and questions from the portal)
-- ---------------------------------------------------------------------------
create type public.client_request_kind as enum ('change', 'question');
create type public.client_request_status as enum ('open', 'in_progress', 'done', 'declined');

create table public.client_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_id uuid not null,
  project_id uuid,
  kind public.client_request_kind not null,
  subject text not null,
  body text not null,
  status public.client_request_status not null default 'open',
  admin_reply text,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_requests_client_fkey foreign key (workspace_id, client_id)
    references public.clients (workspace_id, id) on delete restrict,
  constraint client_requests_project_fkey foreign key (client_id, project_id)
    references public.projects (client_id, id) on delete restrict,
  constraint client_requests_subject_length check (length(btrim(subject)) between 1 and 200),
  constraint client_requests_body_length check (length(btrim(body)) between 1 and 5000),
  constraint client_requests_reply_length check (admin_reply is null or length(admin_reply) <= 5000)
);
create index client_requests_client_id_idx on public.client_requests (client_id, created_at desc);
create index client_requests_workspace_status_idx on public.client_requests (workspace_id, status);

-- workspace_id always comes from the client record; clients cannot set status or reply.
create function private.client_requests_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.workspace_id := private.client_workspace_id(new.client_id);
  new.subject := btrim(new.subject);
  new.body := btrim(new.body);
  if private.current_client_id() is not null then
    new.status := 'open';
    new.admin_reply := null;
    new.created_by := (select auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function private.client_requests_prepare() from public, anon, authenticated;

create trigger client_requests_prepare before insert on public.client_requests
  for each row execute function private.client_requests_prepare();
create trigger client_requests_set_updated_at before update on public.client_requests
  for each row execute function private.set_updated_at();
create trigger client_requests_audit after insert or update on public.client_requests
  for each row execute function private.audit_row_change(
    'client_request', 'id', 'workspace_id', 'client_id', 'kind', 'status');

-- ---------------------------------------------------------------------------
-- Shared files (metadata; the bytes live in the private `client-files` bucket)
-- ---------------------------------------------------------------------------
create table public.client_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_id uuid not null,
  project_id uuid,
  title text not null,
  storage_path text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  constraint client_files_client_fkey foreign key (workspace_id, client_id)
    references public.clients (workspace_id, id) on delete restrict,
  constraint client_files_project_fkey foreign key (client_id, project_id)
    references public.projects (client_id, id) on delete restrict,
  constraint client_files_storage_path_key unique (storage_path),
  -- Objects are stored under "<client_id>/…" so storage policies can scope by folder.
  constraint client_files_path_in_client_folder check (
    split_part(storage_path, '/', 1) = client_id::text and storage_path !~ '\.\.'
  ),
  constraint client_files_title_length check (length(btrim(title)) between 1 and 200),
  constraint client_files_file_name_length check (length(file_name) between 1 and 255),
  constraint client_files_size check (size_bytes is null or size_bytes >= 0)
);
create index client_files_client_id_idx on public.client_files (client_id, created_at desc);

create function private.client_files_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.workspace_id := private.client_workspace_id(new.client_id);
  new.uploaded_by := (select auth.uid());
  return new;
end;
$$;
revoke all on function private.client_files_prepare() from public, anon, authenticated;

create trigger client_files_prepare before insert on public.client_files
  for each row execute function private.client_files_prepare();
create trigger client_files_audit after insert or delete on public.client_files
  for each row execute function private.audit_row_change(
    'client_file', 'id', 'workspace_id', 'client_id', 'title', 'file_name');

-- ---------------------------------------------------------------------------
-- RLS for the new tables
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['approval_responses', 'client_requests', 'client_files']
  loop
    execute format('alter table public.%1$s enable row level security', t);
    execute format(
      'create policy %1$s_require_mfa on public.%1$s as restrictive for all to authenticated
         using ((select private.is_mfa())) with check ((select private.is_mfa()))', t);
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated
         using ((select private.has_role(workspace_id, ''viewer''))
                or client_id = (select private.current_client_id()))', t);
  end loop;
end;
$$;

-- approval_responses: only the client answers (staff decide through decide_approval()).
create policy approval_responses_insert_client on public.approval_responses
  for insert to authenticated
  with check (
    client_id = (select private.current_client_id())
    and responded_by = (select auth.uid())
  );

-- client_requests: clients open requests for themselves; staff manage all of them.
create policy client_requests_insert on public.client_requests
  for insert to authenticated
  with check (
    (client_id = (select private.current_client_id())
      and status = 'open' and admin_reply is null and created_by = (select auth.uid()))
    or (select private.is_client_staff(client_id, 'member'))
  );
create policy client_requests_update on public.client_requests
  for update to authenticated
  using ((select private.has_role(workspace_id, 'member')))
  with check ((select private.has_role(workspace_id, 'member')));

-- client_files: staff add and remove; clients only read (select policy above).
create policy client_files_insert on public.client_files
  for insert to authenticated
  with check ((select private.is_client_staff(client_id, 'member')));
create policy client_files_delete on public.client_files
  for delete to authenticated
  using ((select private.has_role(workspace_id, 'member')));

grant select on public.approval_responses, public.client_requests, public.client_files
  to authenticated;
grant insert (approval_id, decision, comment) on public.approval_responses to authenticated;
grant insert (client_id, project_id, kind, subject, body) on public.client_requests to authenticated;
grant update (status, admin_reply) on public.client_requests to authenticated;
grant insert (client_id, project_id, title, storage_path, file_name, content_type, size_bytes)
  on public.client_files to authenticated;
grant delete on public.client_files to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket, scoped by the client folder
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('client-files', 'client-files', false, 52428800)
on conflict (id) do nothing;

create policy pioneer_client_files_staff_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'client-files'
    and (select private.is_mfa())
    and private.is_client_staff(private.try_uuid(split_part(name, '/', 1)), 'viewer')
  );
create policy pioneer_client_files_staff_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'client-files'
    and (select private.is_mfa())
    and private.is_client_staff(private.try_uuid(split_part(name, '/', 1)), 'member')
  );
create policy pioneer_client_files_staff_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'client-files'
    and (select private.is_mfa())
    and private.is_client_staff(private.try_uuid(split_part(name, '/', 1)), 'member')
  );
-- Clients read an object only when a client_files row for their client points at it.
create policy pioneer_client_files_client_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'client-files'
    and (select private.is_mfa())
    and exists (
      select 1 from public.client_files f
      where f.storage_path = storage.objects.name
        and f.client_id = (select private.current_client_id())
    )
  );

-- ---------------------------------------------------------------------------
-- Functions: portal reads, admin actions
-- ---------------------------------------------------------------------------

-- The caller's own client record (name and timezone only; never internal notes).
create function private.portal_client()
returns table (id uuid, name text, timezone text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, w.timezone
  from public.clients c
  join public.workspaces w on w.id = c.workspace_id
  where private.is_mfa() and c.id = private.current_client_id();
$$;

-- Links an invited auth user to a client record (owner only). Creates the profile as a
-- 'client' account; refuses staff accounts.
create function private.attach_portal_user(
  p_user_id uuid, p_client_id uuid, p_display_name text, p_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.profiles;
begin
  if not private.is_mfa() or not private.is_client_staff(p_client_id, 'owner') then
    raise exception 'Only the workspace owner can give clients portal access'
      using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'That account does not exist' using errcode = 'invalid_parameter_value';
  end if;

  select * into existing from public.profiles where user_id = p_user_id for update;
  if found and existing.role <> 'client' then
    raise exception 'That email belongs to a staff account'
      using errcode = 'check_violation', constraint = 'profiles_member_is_admin';
  end if;

  if found then
    update public.profiles
      set client_id = p_client_id, email = coalesce(nullif(btrim(p_email), ''), email)
      where user_id = p_user_id;
  else
    insert into public.profiles (user_id, display_name, role, client_id, email)
    values (p_user_id, btrim(p_display_name), 'client', p_client_id, nullif(btrim(p_email), ''));
  end if;

  perform private.log_event(private.client_workspace_id(p_client_id), 'portal_user.attached',
    'profiles', p_user_id, jsonb_build_object('client_id', p_client_id), null);
end;
$$;

-- Removes a client account's access (keeps the account; owner only).
create function private.detach_portal_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.profiles;
begin
  select * into existing from public.profiles where user_id = p_user_id and role = 'client' for update;
  if not found or existing.client_id is null or not private.is_mfa()
     or not private.is_client_staff(existing.client_id, 'owner') then
    raise exception 'Not allowed to change this account' using errcode = 'insufficient_privilege';
  end if;
  update public.profiles set client_id = null where user_id = p_user_id;
  perform private.log_event(private.client_workspace_id(existing.client_id),
    'portal_user.detached', 'profiles', p_user_id,
    jsonb_build_object('client_id', existing.client_id), null);
end;
$$;

-- A project without a blueprint, for clients whose work isn't templated.
create function private.create_portal_project(
  p_client_id uuid, p_name text, p_start_on date, p_launch_on date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.clients;
  new_id uuid;
begin
  select * into c from public.clients where id = p_client_id;
  if not found or not private.is_mfa() or not private.has_role(c.workspace_id, 'member') then
    raise exception 'Not allowed to add a project for this client' using errcode = 'insufficient_privilege';
  end if;
  if c.archived_at is not null then
    raise exception 'This client is archived'
      using errcode = 'check_violation', constraint = 'projects_client_archived';
  end if;
  insert into public.projects (workspace_id, client_id, no_sow_reason, name, start_on, launch_on,
    idempotency_key, generated_by)
  values (c.workspace_id, c.id, 'Added from the Clients page', btrim(p_name), p_start_on,
    p_launch_on, gen_random_uuid(), (select auth.uid()))
  returning id into new_id;
  perform private.log_event(c.workspace_id, 'project.created', 'projects', new_id,
    jsonb_build_object('client_id', c.id, 'name', btrim(p_name)), null);
  return new_id;
end;
$$;

-- Adds a step to a project (appended at the end).
create function private.add_project_task(
  p_project_id uuid, p_title text, p_phase text, p_due_on date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.projects;
  new_id uuid;
begin
  select * into p from public.projects where id = p_project_id;
  if not found or not private.is_mfa() or not private.has_role(p.workspace_id, 'member') then
    raise exception 'Not allowed to add a step to this project' using errcode = 'insufficient_privilege';
  end if;
  insert into public.project_tasks (workspace_id, project_id, key, title, phase, position, due_on)
  values (p.workspace_id, p.id, 'step-' || replace(gen_random_uuid()::text, '-', ''),
    btrim(p_title), nullif(btrim(coalesce(p_phase, '')), ''),
    coalesce((select max(t.position) from public.project_tasks t where t.project_id = p.id), 0) + 1,
    p_due_on)
  returning id into new_id;
  perform private.log_event(p.workspace_id, 'task.created', 'project_tasks', new_id,
    jsonb_build_object('project_id', p.id, 'title', btrim(p_title)), null);
  return new_id;
end;
$$;

-- Asks the client for a yes/no on something (not tied to a task).
create function private.create_client_approval(p_project_id uuid, p_title text, p_details text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.projects;
  new_id uuid;
begin
  select * into p from public.projects where id = p_project_id;
  if not found or not private.is_mfa() or not private.has_role(p.workspace_id, 'member') then
    raise exception 'Not allowed to request an approval on this project'
      using errcode = 'insufficient_privilege';
  end if;
  insert into public.approvals (workspace_id, project_id, client_id, subject, title, details,
    approver_type, requested_by)
  values (p.workspace_id, p.id, p.client_id, 'deliverable', btrim(p_title),
    nullif(btrim(coalesce(p_details, '')), ''), 'client', (select auth.uid()))
  returning id into new_id;
  return new_id;
end;
$$;

-- Public invoker wrappers (the private schema is not exposed by the Data API).
create function public.portal_client()
returns table (id uuid, name text, timezone text)
language sql stable set search_path = '' as $$ select * from private.portal_client(); $$;

create function public.attach_portal_user(
  p_user_id uuid, p_client_id uuid, p_display_name text, p_email text default null)
returns void language sql set search_path = '' as $$
  select private.attach_portal_user(p_user_id, p_client_id, p_display_name, p_email); $$;

create function public.detach_portal_user(p_user_id uuid)
returns void language sql set search_path = '' as $$
  select private.detach_portal_user(p_user_id); $$;

create function public.create_portal_project(
  p_client_id uuid, p_name text, p_start_on date, p_launch_on date default null)
returns uuid language sql set search_path = '' as $$
  select private.create_portal_project(p_client_id, p_name, p_start_on, p_launch_on); $$;

create function public.add_project_task(
  p_project_id uuid, p_title text, p_phase text default null, p_due_on date default null)
returns uuid language sql set search_path = '' as $$
  select private.add_project_task(p_project_id, p_title, p_phase, p_due_on); $$;

create function public.create_client_approval(
  p_project_id uuid, p_title text, p_details text default null)
returns uuid language sql set search_path = '' as $$
  select private.create_client_approval(p_project_id, p_title, p_details); $$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.portal_client()',
    'public.attach_portal_user(uuid, uuid, text, text)',
    'public.detach_portal_user(uuid)',
    'public.create_portal_project(uuid, text, date, date)',
    'public.add_project_task(uuid, text, text, date)',
    'public.create_client_approval(uuid, text, text)',
    'private.portal_client()',
    'private.attach_portal_user(uuid, uuid, text, text)',
    'private.detach_portal_user(uuid)',
    'private.create_portal_project(uuid, text, date, date)',
    'private.add_project_task(uuid, text, text, date)',
    'private.create_client_approval(uuid, text, text)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- service_role (bootstrap script) sets the account role when it creates the owner.
grant update (role) on public.profiles to service_role;
