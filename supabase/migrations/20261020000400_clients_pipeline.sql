-- Pioneer OS — M2: clients, contacts, pipeline stages, leads, activities, follow-ups.
-- See docs/milestone-2-plan.md and docs/schema.md §4.

-- Child tables use composite FKs (workspace_id, parent_id) so they can only reference rows in
-- the same workspace. workspace_members' primary key (workspace_id, user_id) is the target
-- for owner/assignee references.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.client_kind as enum ('organization', 'individual');
create type public.client_status as enum ('prospect', 'active', 'paused', 'former');
create type public.stage_kind as enum ('open', 'won', 'lost');
create type public.activity_type as enum ('note', 'call', 'email', 'meeting');
create type public.follow_up_status as enum ('open', 'done', 'cancelled');

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  name text not null,
  legal_name text,
  kind public.client_kind not null default 'organization',
  status public.client_status not null default 'prospect',
  industry text,
  website_url text,
  drive_folder_url text,
  notes text,
  archived_at timestamptz,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_workspace_id_id_key unique (workspace_id, id),
  constraint clients_name_not_blank check (length(btrim(name)) between 1 and 200),
  constraint clients_legal_name_length check (legal_name is null or length(legal_name) <= 200),
  constraint clients_industry_length check (industry is null or length(industry) <= 120),
  constraint clients_notes_length check (notes is null or length(notes) <= 10000),
  constraint clients_website_url_https check (
    website_url is null or website_url ~ '^https://[^\s/]+\.[^\s]+$'
  ),
  constraint clients_drive_folder_url_google check (
    drive_folder_url is null or drive_folder_url ~ '^https://(drive|docs)\.google\.com/\S*$'
  )
);

create index clients_workspace_id_idx on public.clients (workspace_id);
create index clients_name_trgm_idx on public.clients using gin (name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_id uuid not null,
  first_name text not null,
  last_name text,
  email extensions.citext,
  phone text,
  job_title text,
  is_primary boolean not null default false,
  notes text,
  archived_at timestamptz,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_client_fkey foreign key (workspace_id, client_id)
    references public.clients (workspace_id, id) on delete restrict,
  constraint contacts_client_id_id_key unique (client_id, id),
  constraint contacts_first_name_not_blank check (length(btrim(first_name)) between 1 and 100),
  constraint contacts_last_name_length check (last_name is null or length(last_name) <= 100),
  constraint contacts_email_format check (
    email is null or (length(email) <= 320 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  ),
  constraint contacts_phone_length check (phone is null or length(phone) <= 40),
  constraint contacts_job_title_length check (job_title is null or length(job_title) <= 120),
  constraint contacts_notes_length check (notes is null or length(notes) <= 10000),
  constraint contacts_primary_not_archived check (not (is_primary and archived_at is not null))
);

create index contacts_workspace_id_idx on public.contacts (workspace_id);
create index contacts_client_id_idx on public.contacts (client_id);
create unique index contacts_one_primary_per_client
  on public.contacts (client_id) where is_primary;

-- Setting a contact as primary clears the client's previous primary.
create function private.contacts_single_primary()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_primary and (tg_op = 'INSERT' or not old.is_primary) then
    update public.contacts
      set is_primary = false
      where client_id = new.client_id and id <> new.id and is_primary;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- pipeline_stages
-- ---------------------------------------------------------------------------
create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  name text not null,
  position int not null,
  kind public.stage_kind not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pipeline_stages_workspace_id_id_key unique (workspace_id, id),
  constraint pipeline_stages_position_key unique (workspace_id, position)
    deferrable initially immediate,
  constraint pipeline_stages_name_not_blank check (length(btrim(name)) between 1 and 60),
  constraint pipeline_stages_position_positive check (position > 0)
);

create function private.seed_pipeline_stages(ws uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.pipeline_stages (workspace_id, name, position, kind) values
    (ws, 'Inquiry', 1, 'open'),
    (ws, 'Discovery', 2, 'open'),
    (ws, 'Proposal', 3, 'open'),
    (ws, 'Negotiation', 4, 'open'),
    (ws, 'Won', 5, 'won'),
    (ws, 'Lost', 6, 'lost');
$$;

create function private.workspaces_seed_stages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_pipeline_stages(new.id);
  return null;
end;
$$;

create trigger workspaces_seed_pipeline_stages
  after insert on public.workspaces
  for each row execute function private.workspaces_seed_stages();

-- Existing workspaces (D-3 defaults).
select private.seed_pipeline_stages(id) from public.workspaces;

-- Move a stage one step up (-1) or down (+1), swapping positions atomically.
-- security invoker: RLS decides whether the caller may update stages.
create function public.move_pipeline_stage(stage_id uuid, direction int)
returns void
language plpgsql
set search_path = ''
as $$
declare
  cur public.pipeline_stages;
  other public.pipeline_stages;
begin
  if direction not in (-1, 1) then
    raise exception 'direction must be -1 or 1' using errcode = 'invalid_parameter_value';
  end if;

  select * into cur from public.pipeline_stages where id = stage_id for update;
  if not found then
    raise exception 'stage not found' using errcode = 'no_data_found';
  end if;

  select * into other from public.pipeline_stages
    where workspace_id = cur.workspace_id
      and (case when direction < 0 then position < cur.position else position > cur.position end)
    order by case when direction < 0 then -position else position end
    limit 1
    for update;
  if not found then
    return; -- already first/last
  end if;

  set constraints public.pipeline_stages_position_key deferred;
  update public.pipeline_stages set position = other.position where id = cur.id;
  update public.pipeline_stages set position = cur.position where id = other.id;
  if not found then
    raise exception 'not allowed to reorder stages' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- leads (opportunities on a client — D-2)
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_id uuid not null,
  primary_contact_id uuid,
  title text not null,
  source text,
  stage_id uuid not null,
  estimated_value_minor bigint,
  currency char(3) not null default 'USD',
  expected_close_on date,
  owner_user_id uuid,
  lost_reason text,
  closed_at timestamptz,
  archived_at timestamptz,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_client_fkey foreign key (workspace_id, client_id)
    references public.clients (workspace_id, id) on delete restrict,
  constraint leads_primary_contact_fkey foreign key (client_id, primary_contact_id)
    references public.contacts (client_id, id) on delete restrict,
  constraint leads_stage_fkey foreign key (workspace_id, stage_id)
    references public.pipeline_stages (workspace_id, id) on delete restrict,
  constraint leads_owner_fkey foreign key (workspace_id, owner_user_id)
    references public.workspace_members (workspace_id, user_id) on delete restrict,
  constraint leads_client_id_id_key unique (client_id, id),
  constraint leads_title_not_blank check (length(btrim(title)) between 1 and 200),
  constraint leads_source_length check (source is null or length(source) <= 120),
  constraint leads_estimated_value_non_negative check (
    estimated_value_minor is null or estimated_value_minor >= 0
  ),
  constraint leads_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint leads_lost_reason_length check (lost_reason is null or length(lost_reason) <= 1000)
);

create index leads_workspace_id_idx on public.leads (workspace_id);
create index leads_client_id_idx on public.leads (client_id);
create index leads_stage_id_idx on public.leads (stage_id);

-- Outcome rules: a lost stage requires a reason; won/lost stamp closed_at; reopening clears it.
create function private.leads_apply_stage_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  k public.stage_kind;
begin
  select kind into k from public.pipeline_stages where id = new.stage_id;

  if k = 'lost' then
    if new.lost_reason is null or length(btrim(new.lost_reason)) = 0 then
      raise exception 'A lost reason is required when a lead is marked lost'
        using errcode = 'check_violation', constraint = 'leads_lost_reason_required';
    end if;
  else
    new.lost_reason := null;
  end if;

  if k in ('won', 'lost') then
    if tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id or old.closed_at is null then
      new.closed_at := now();
    end if;
  else
    new.closed_at := null;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- activities (D-17)
-- ---------------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_id uuid not null,
  lead_id uuid,
  contact_id uuid,
  type public.activity_type not null,
  subject text not null,
  body text,
  occurred_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_client_fkey foreign key (workspace_id, client_id)
    references public.clients (workspace_id, id) on delete restrict,
  constraint activities_lead_fkey foreign key (client_id, lead_id)
    references public.leads (client_id, id) on delete restrict,
  constraint activities_contact_fkey foreign key (client_id, contact_id)
    references public.contacts (client_id, id) on delete restrict,
  constraint activities_subject_not_blank check (length(btrim(subject)) between 1 and 200),
  constraint activities_body_length check (body is null or length(body) <= 20000)
);

create index activities_workspace_id_idx on public.activities (workspace_id);
create index activities_client_occurred_idx on public.activities (client_id, occurred_at desc);
create index activities_lead_id_idx on public.activities (lead_id) where lead_id is not null;

-- ---------------------------------------------------------------------------
-- follow_ups
-- ---------------------------------------------------------------------------
create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_id uuid not null,
  lead_id uuid,
  contact_id uuid,
  title text not null,
  due_on date not null,
  status public.follow_up_status not null default 'open',
  assignee_user_id uuid,
  completed_at timestamptz,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint follow_ups_client_fkey foreign key (workspace_id, client_id)
    references public.clients (workspace_id, id) on delete restrict,
  constraint follow_ups_lead_fkey foreign key (client_id, lead_id)
    references public.leads (client_id, id) on delete restrict,
  constraint follow_ups_contact_fkey foreign key (client_id, contact_id)
    references public.contacts (client_id, id) on delete restrict,
  constraint follow_ups_assignee_fkey foreign key (workspace_id, assignee_user_id)
    references public.workspace_members (workspace_id, user_id) on delete restrict,
  constraint follow_ups_title_not_blank check (length(btrim(title)) between 1 and 200),
  constraint follow_ups_completed_at_iff_done check ((status = 'done') = (completed_at is not null))
);

create index follow_ups_workspace_due_idx on public.follow_ups (workspace_id, due_on)
  where status = 'open';
create index follow_ups_client_id_idx on public.follow_ups (client_id);

-- completed_at follows status (the client never sets it).
create function private.follow_ups_set_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' then
    if tg_op = 'INSERT' or old.status <> 'done' then
      new.completed_at := now();
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create trigger clients_set_updated_at before update on public.clients
  for each row execute function private.set_updated_at();
create trigger contacts_set_updated_at before update on public.contacts
  for each row execute function private.set_updated_at();
create trigger pipeline_stages_set_updated_at before update on public.pipeline_stages
  for each row execute function private.set_updated_at();
create trigger leads_set_updated_at before update on public.leads
  for each row execute function private.set_updated_at();
create trigger activities_set_updated_at before update on public.activities
  for each row execute function private.set_updated_at();
create trigger follow_ups_set_updated_at before update on public.follow_ups
  for each row execute function private.set_updated_at();

create trigger contacts_single_primary
  before insert or update of is_primary on public.contacts
  for each row execute function private.contacts_single_primary();
create trigger leads_apply_stage_rules
  before insert or update of stage_id, lost_reason on public.leads
  for each row execute function private.leads_apply_stage_rules();
create trigger follow_ups_set_completed_at
  before insert or update of status on public.follow_ups
  for each row execute function private.follow_ups_set_completed_at();

-- Audit (docs/security.md §5: client status changes, stage changes).
create trigger clients_audit
  after insert or update on public.clients
  for each row execute function private.audit_row_change(
    'client', 'id', 'workspace_id', 'name', 'kind', 'status', 'archived_at');
create trigger leads_audit
  after insert or update on public.leads
  for each row execute function private.audit_row_change(
    'lead', 'id', 'workspace_id', 'client_id', 'title', 'stage_id', 'estimated_value_minor',
    'currency', 'owner_user_id', 'lost_reason', 'archived_at');
create trigger pipeline_stages_audit
  after insert or update or delete on public.pipeline_stages
  for each row execute function private.audit_row_change(
    'pipeline_stage', 'id', 'workspace_id', 'name', 'position', 'kind');
-- Activities: creation is routine; edits are audited (D-17). Body text is not copied.
create trigger activities_audit
  after update on public.activities
  for each row execute function private.audit_row_change(
    'activity', 'id', 'workspace_id', 'type', 'subject', 'occurred_at');

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.clients enable row level security;
alter table public.contacts enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.leads enable row level security;
alter table public.activities enable row level security;
alter table public.follow_ups enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['clients', 'contacts', 'pipeline_stages', 'leads', 'activities', 'follow_ups']
  loop
    execute format(
      'create policy %1$s_require_mfa on public.%1$s as restrictive for all to authenticated
         using ((select private.is_mfa())) with check ((select private.is_mfa()))', t);
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated
         using ((select private.has_role(workspace_id, ''viewer'')))', t);
  end loop;

  foreach t in array array['clients', 'contacts', 'leads', 'follow_ups']
  loop
    execute format(
      'create policy %1$s_insert on public.%1$s for insert to authenticated
         with check ((select private.has_role(workspace_id, ''member'')))', t);
    execute format(
      'create policy %1$s_update on public.%1$s for update to authenticated
         using ((select private.has_role(workspace_id, ''member'')))
         with check ((select private.has_role(workspace_id, ''member'')))', t);
  end loop;
end;
$$;

-- Pipeline configuration: owner/admin.
create policy pipeline_stages_insert on public.pipeline_stages
  for insert to authenticated
  with check ((select private.has_role(workspace_id, 'admin')));
create policy pipeline_stages_update on public.pipeline_stages
  for update to authenticated
  using ((select private.has_role(workspace_id, 'admin')))
  with check ((select private.has_role(workspace_id, 'admin')));
create policy pipeline_stages_delete on public.pipeline_stages
  for delete to authenticated
  using ((select private.has_role(workspace_id, 'admin')) and kind = 'open');

-- Activities: members log; the author edits for 24 h, the owner any time (D-17).
create policy activities_insert on public.activities
  for insert to authenticated
  with check (
    (select private.has_role(workspace_id, 'member')) and created_by = (select auth.uid())
  );
create policy activities_update on public.activities
  for update to authenticated
  using (
    (select private.has_role(workspace_id, 'owner'))
    or (
      (select private.has_role(workspace_id, 'member'))
      and created_by = (select auth.uid())
      and created_at > now() - interval '24 hours'
    )
  )
  with check ((select private.has_role(workspace_id, 'member')));

-- ---------------------------------------------------------------------------
-- Grants (explicit column lists; no hard deletes except unused open stages)
-- ---------------------------------------------------------------------------
grant select on public.clients, public.contacts, public.pipeline_stages, public.leads,
  public.activities, public.follow_ups to authenticated;

grant insert (workspace_id, name, legal_name, kind, status, industry, website_url,
  drive_folder_url, notes) on public.clients to authenticated;
grant update (name, legal_name, kind, status, industry, website_url, drive_folder_url, notes,
  archived_at) on public.clients to authenticated;

grant insert (workspace_id, client_id, first_name, last_name, email, phone, job_title,
  is_primary, notes) on public.contacts to authenticated;
grant update (first_name, last_name, email, phone, job_title, is_primary, notes, archived_at)
  on public.contacts to authenticated;

grant insert (workspace_id, name, position, kind) on public.pipeline_stages to authenticated;
grant update (name, position) on public.pipeline_stages to authenticated;
grant delete on public.pipeline_stages to authenticated;

grant insert (workspace_id, client_id, primary_contact_id, title, source, stage_id,
  estimated_value_minor, currency, expected_close_on, owner_user_id, lost_reason)
  on public.leads to authenticated;
grant update (primary_contact_id, title, source, stage_id, estimated_value_minor, currency,
  expected_close_on, owner_user_id, lost_reason, archived_at) on public.leads to authenticated;

grant insert (workspace_id, client_id, lead_id, contact_id, type, subject, body, occurred_at)
  on public.activities to authenticated;
grant update (type, subject, body, occurred_at) on public.activities to authenticated;

grant insert (workspace_id, client_id, lead_id, contact_id, title, due_on, status,
  assignee_user_id) on public.follow_ups to authenticated;
grant update (title, due_on, status, assignee_user_id) on public.follow_ups to authenticated;

revoke all on function public.move_pipeline_stage(uuid, int) from public, anon;
grant execute on function public.move_pipeline_stage(uuid, int) to authenticated;

revoke all on function private.seed_pipeline_stages(uuid) from public, anon, authenticated;
revoke all on function private.workspaces_seed_stages() from public, anon, authenticated;
revoke all on function private.contacts_single_primary() from public, anon, authenticated;
revoke all on function private.leads_apply_stage_rules() from public, anon, authenticated;
revoke all on function private.follow_ups_set_completed_at() from public, anon, authenticated;

-- service_role: bootstrap needs nothing new; the workspace trigger seeds stages itself.
