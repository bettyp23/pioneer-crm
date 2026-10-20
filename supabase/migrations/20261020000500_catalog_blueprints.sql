-- Pioneer OS — M3: service catalog, packages, versioned immutable blueprints.
-- See docs/milestone-3-plan.md, docs/schema.md §5, docs/architecture.md §6.1.

create type public.blueprint_version_status as enum ('draft', 'published', 'retired');
create type public.approval_approver as enum ('internal', 'client');
create type public.input_kind as enum ('file', 'text', 'access_confirmation', 'decision');

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  code text not null,
  name text not null,
  category text,
  description text,
  list_price_minor bigint,
  currency char(3) not null default 'USD',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_workspace_id_id_key unique (workspace_id, id),
  constraint services_code_key unique (workspace_id, code),
  constraint services_code_format check (code ~ '^[a-z0-9-]{2,40}$'),
  constraint services_name_not_blank check (length(btrim(name)) between 1 and 200),
  constraint services_category_length check (category is null or length(category) <= 80),
  constraint services_description_length check (description is null or length(description) <= 5000),
  constraint services_price_non_negative check (list_price_minor is null or list_price_minor >= 0),
  constraint services_currency_format check (currency ~ '^[A-Z]{3}$')
);
create index services_workspace_id_idx on public.services (workspace_id);

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  name text not null,
  description text,
  list_price_minor bigint,
  currency char(3) not null default 'USD',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint packages_workspace_id_id_key unique (workspace_id, id),
  constraint packages_name_not_blank check (length(btrim(name)) between 1 and 200),
  constraint packages_description_length check (description is null or length(description) <= 5000),
  constraint packages_price_non_negative check (list_price_minor is null or list_price_minor >= 0),
  constraint packages_currency_format check (currency ~ '^[A-Z]{3}$')
);
create index packages_workspace_id_idx on public.packages (workspace_id);

create table public.package_services (
  workspace_id uuid not null,
  package_id uuid not null,
  service_id uuid not null,
  quantity int not null default 1,
  position int not null default 1,
  created_at timestamptz not null default now(),
  primary key (package_id, service_id),
  constraint package_services_package_fkey foreign key (workspace_id, package_id)
    references public.packages (workspace_id, id) on delete cascade,
  constraint package_services_service_fkey foreign key (workspace_id, service_id)
    references public.services (workspace_id, id) on delete restrict,
  constraint package_services_quantity_positive check (quantity between 1 and 1000),
  constraint package_services_position_positive check (position > 0)
);
create index package_services_workspace_id_idx on public.package_services (workspace_id);
create index package_services_service_id_idx on public.package_services (service_id);

-- ---------------------------------------------------------------------------
-- Blueprints
-- ---------------------------------------------------------------------------
create table public.blueprints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  service_id uuid,
  name text not null,
  description text,
  archived_at timestamptz,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blueprints_workspace_id_id_key unique (workspace_id, id),
  constraint blueprints_service_fkey foreign key (workspace_id, service_id)
    references public.services (workspace_id, id) on delete restrict,
  constraint blueprints_name_not_blank check (length(btrim(name)) between 1 and 200),
  constraint blueprints_description_length check (description is null or length(description) <= 5000)
);
create index blueprints_workspace_id_idx on public.blueprints (workspace_id);

create table public.blueprint_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  blueprint_id uuid not null,
  version_number int not null,
  status public.blueprint_version_status not null default 'draft',
  change_summary text,
  content_hash text,
  published_at timestamptz,
  published_by uuid references auth.users (id),
  retired_at timestamptz,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blueprint_versions_blueprint_fkey foreign key (workspace_id, blueprint_id)
    references public.blueprints (workspace_id, id) on delete restrict,
  constraint blueprint_versions_workspace_id_id_key unique (workspace_id, id),
  constraint blueprint_versions_number_key unique (blueprint_id, version_number),
  constraint blueprint_versions_number_positive check (version_number > 0),
  constraint blueprint_versions_change_summary_length check (
    change_summary is null or length(change_summary) <= 2000
  ),
  constraint blueprint_versions_published_fields check (
    (status = 'draft' and published_at is null and content_hash is null and retired_at is null)
    or (status = 'published' and published_at is not null and content_hash is not null and retired_at is null)
    or (status = 'retired' and published_at is not null and content_hash is not null and retired_at is not null)
  )
);
create unique index blueprint_versions_one_draft
  on public.blueprint_versions (blueprint_id) where status = 'draft';
create index blueprint_versions_workspace_id_idx on public.blueprint_versions (workspace_id);

create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  blueprint_version_id uuid not null,
  key text not null,
  title text not null,
  description text,
  phase text,
  position int not null default 1,
  estimated_hours numeric(6, 2),
  due_offset_days int,
  requires_approval boolean not null default false,
  approval_approver public.approval_approver,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_templates_version_fkey foreign key (workspace_id, blueprint_version_id)
    references public.blueprint_versions (workspace_id, id) on delete cascade,
  constraint task_templates_version_id_id_key unique (blueprint_version_id, id),
  constraint task_templates_key_key unique (blueprint_version_id, key),
  constraint task_templates_key_format check (key ~ '^[a-z0-9_]{1,60}$'),
  constraint task_templates_title_not_blank check (length(btrim(title)) between 1 and 200),
  constraint task_templates_description_length check (description is null or length(description) <= 5000),
  constraint task_templates_phase_length check (phase is null or length(phase) <= 80),
  constraint task_templates_position_positive check (position > 0),
  constraint task_templates_estimate_range check (
    estimated_hours is null or (estimated_hours >= 0 and estimated_hours <= 1000)
  ),
  constraint task_templates_due_offset_range check (
    due_offset_days is null or due_offset_days between 0 and 730
  ),
  constraint task_templates_approver_iff_required check (
    requires_approval = (approval_approver is not null)
  )
);
create index task_templates_workspace_id_idx on public.task_templates (workspace_id);

create table public.task_template_dependencies (
  workspace_id uuid not null,
  blueprint_version_id uuid not null,
  task_template_id uuid not null,
  depends_on_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (task_template_id, depends_on_id),
  -- Ties the row to its version's workspace (RLS checks workspace_id; FKs bypass RLS).
  constraint task_template_dependencies_version_fkey foreign key (workspace_id, blueprint_version_id)
    references public.blueprint_versions (workspace_id, id) on delete cascade,
  constraint task_template_dependencies_task_fkey foreign key (blueprint_version_id, task_template_id)
    references public.task_templates (blueprint_version_id, id) on delete cascade,
  constraint task_template_dependencies_depends_on_fkey foreign key (blueprint_version_id, depends_on_id)
    references public.task_templates (blueprint_version_id, id) on delete cascade,
  constraint task_template_dependencies_not_self check (task_template_id <> depends_on_id)
);
create index task_template_dependencies_version_idx
  on public.task_template_dependencies (blueprint_version_id);
create index task_template_dependencies_depends_on_idx
  on public.task_template_dependencies (depends_on_id);

create table public.input_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  blueprint_version_id uuid not null,
  key text not null,
  label text not null,
  description text,
  input_kind public.input_kind not null,
  required boolean not null default true,
  blocks_task_template_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint input_templates_version_fkey foreign key (workspace_id, blueprint_version_id)
    references public.blueprint_versions (workspace_id, id) on delete cascade,
  constraint input_templates_blocks_fkey foreign key (blueprint_version_id, blocks_task_template_id)
    references public.task_templates (blueprint_version_id, id) on delete set null (blocks_task_template_id),
  constraint input_templates_key_key unique (blueprint_version_id, key),
  constraint input_templates_key_format check (key ~ '^[a-z0-9_]{1,60}$'),
  constraint input_templates_label_not_blank check (length(btrim(label)) between 1 and 200),
  constraint input_templates_description_length check (description is null or length(description) <= 5000)
);
create index input_templates_workspace_id_idx on public.input_templates (workspace_id);

-- ---------------------------------------------------------------------------
-- Immutability (FR-BP-3, FR-BP-4)
-- ---------------------------------------------------------------------------

-- Templates may only change while their version is a draft. Cascading deletes from a draft
-- version pass (the version row is still visible as draft inside the delete).
create function private.require_draft_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  version_id uuid := coalesce(new.blueprint_version_id, old.blueprint_version_id);
  st public.blueprint_version_status;
begin
  if tg_op = 'UPDATE' and new.blueprint_version_id is distinct from old.blueprint_version_id then
    raise exception 'Templates cannot move between versions'
      using errcode = 'check_violation', constraint = 'blueprint_template_immutable';
  end if;
  select status into st from public.blueprint_versions where id = version_id;
  if st is distinct from 'draft' and st is not null then
    raise exception 'Published blueprint versions are immutable; create a new draft'
      using errcode = 'check_violation', constraint = 'blueprint_version_immutable';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger task_templates_require_draft
  before insert or update or delete on public.task_templates
  for each row execute function private.require_draft_version();
create trigger task_template_dependencies_require_draft
  before insert or update or delete on public.task_template_dependencies
  for each row execute function private.require_draft_version();
create trigger input_templates_require_draft
  before insert or update or delete on public.input_templates
  for each row execute function private.require_draft_version();

-- Versions: drafts are editable (summary only — status changes go through functions);
-- published → retired is the only change allowed after publishing; only drafts can be deleted.
create function private.guard_blueprint_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Published blueprint versions cannot be deleted'
        using errcode = 'check_violation', constraint = 'blueprint_version_immutable';
    end if;
    return old;
  end if;

  if new.blueprint_id <> old.blueprint_id or new.version_number <> old.version_number
     or new.workspace_id <> old.workspace_id then
    raise exception 'Blueprint version identity cannot change'
      using errcode = 'check_violation', constraint = 'blueprint_version_immutable';
  end if;

  if old.status = 'draft' then
    return new; -- publishing is validated by publish_blueprint_version()
  end if;

  if old.status = 'published' and new.status = 'retired'
     and new.change_summary is not distinct from old.change_summary
     and new.content_hash is not distinct from old.content_hash
     and new.published_at is not distinct from old.published_at
     and new.published_by is not distinct from old.published_by then
    return new;
  end if;

  raise exception 'Published blueprint versions are immutable; create a new draft'
    using errcode = 'check_violation', constraint = 'blueprint_version_immutable';
end;
$$;

create trigger blueprint_versions_guard
  before update or delete on public.blueprint_versions
  for each row execute function private.guard_blueprint_version();

-- ---------------------------------------------------------------------------
-- Draft / publish / retire
-- ---------------------------------------------------------------------------

-- Copies `from_version` (or nothing) into the next-numbered draft. security invoker:
-- RLS decides whether the caller may create versions and templates.
create function public.create_draft_version(p_blueprint_id uuid, p_from_version_id uuid default null)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  bp public.blueprints;
  new_id uuid;
  next_number int;
begin
  select * into bp from public.blueprints where id = p_blueprint_id;
  if not found then
    raise exception 'Blueprint not found' using errcode = 'no_data_found';
  end if;
  if bp.archived_at is not null then
    raise exception 'Archived blueprints cannot get new versions'
      using errcode = 'check_violation', constraint = 'blueprint_archived';
  end if;
  if exists (select 1 from public.blueprint_versions
             where blueprint_id = p_blueprint_id and status = 'draft') then
    raise exception 'This blueprint already has a draft'
      using errcode = 'unique_violation', constraint = 'blueprint_versions_one_draft';
  end if;
  if p_from_version_id is not null and not exists (
    select 1 from public.blueprint_versions where id = p_from_version_id and blueprint_id = p_blueprint_id
  ) then
    raise exception 'Source version does not belong to this blueprint' using errcode = 'no_data_found';
  end if;

  select coalesce(max(version_number), 0) + 1 into next_number
    from public.blueprint_versions where blueprint_id = p_blueprint_id;

  insert into public.blueprint_versions (workspace_id, blueprint_id, version_number)
    values (bp.workspace_id, p_blueprint_id, next_number)
    returning id into new_id;

  if p_from_version_id is not null then
    insert into public.task_templates (workspace_id, blueprint_version_id, key, title, description,
      phase, position, estimated_hours, due_offset_days, requires_approval, approval_approver)
    select workspace_id, new_id, key, title, description, phase, position, estimated_hours,
      due_offset_days, requires_approval, approval_approver
    from public.task_templates where blueprint_version_id = p_from_version_id;

    insert into public.task_template_dependencies (workspace_id, blueprint_version_id,
      task_template_id, depends_on_id)
    select bp.workspace_id, new_id, nt.id, nd.id
    from public.task_template_dependencies d
    join public.task_templates ot on ot.id = d.task_template_id
    join public.task_templates od on od.id = d.depends_on_id
    join public.task_templates nt on nt.blueprint_version_id = new_id and nt.key = ot.key
    join public.task_templates nd on nd.blueprint_version_id = new_id and nd.key = od.key
    where d.blueprint_version_id = p_from_version_id;

    insert into public.input_templates (workspace_id, blueprint_version_id, key, label, description,
      input_kind, required, blocks_task_template_id)
    select i.workspace_id, new_id, i.key, i.label, i.description, i.input_kind, i.required, nt.id
    from public.input_templates i
    left join public.task_templates ot on ot.id = i.blocks_task_template_id
    left join public.task_templates nt on nt.blueprint_version_id = new_id and nt.key = ot.key
    where i.blueprint_version_id = p_from_version_id;
  end if;

  return new_id;
end;
$$;

-- Canonical content for hashing: ordered by keys, independent of row ids.
create function private.blueprint_version_content(p_version_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', t.key, 'title', t.title, 'description', t.description, 'phase', t.phase,
        'position', t.position, 'estimated_hours', t.estimated_hours,
        'due_offset_days', t.due_offset_days, 'requires_approval', t.requires_approval,
        'approval_approver', t.approval_approver,
        'depends_on', coalesce((
          select jsonb_agg(dt.key order by dt.key)
          from public.task_template_dependencies d
          join public.task_templates dt on dt.id = d.depends_on_id
          where d.task_template_id = t.id), '[]'::jsonb)
      ) order by t.key)
      from public.task_templates t where t.blueprint_version_id = p_version_id), '[]'::jsonb),
    'inputs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', i.key, 'label', i.label, 'description', i.description, 'kind', i.input_kind,
        'required', i.required, 'blocks', bt.key
      ) order by i.key)
      from public.input_templates i
      left join public.task_templates bt on bt.id = i.blocks_task_template_id
      where i.blueprint_version_id = p_version_id), '[]'::jsonb)
  );
$$;

-- Validation messages for a draft (empty array = publishable). Used by publish and the UI.
create function public.blueprint_version_problems(p_version_id uuid)
returns text[]
language plpgsql
stable
set search_path = ''
as $$
declare
  problems text[] := array[]::text[];
  cycle_key text;
begin
  if not exists (select 1 from public.task_templates where blueprint_version_id = p_version_id) then
    problems := array_append(problems, 'Add at least one task.');
  end if;

  -- A task that reaches itself by following dependencies is in a cycle. UNION (not ALL)
  -- deduplicates (start, current) pairs, so the walk is O(n²) and always terminates.
  with recursive walk(start_id, current_id) as (
    select d.task_template_id, d.depends_on_id
    from public.task_template_dependencies d
    where d.blueprint_version_id = p_version_id
    union
    select w.start_id, d.depends_on_id
    from walk w
    join public.task_template_dependencies d on d.task_template_id = w.current_id
  )
  select t.key into cycle_key
  from walk w join public.task_templates t on t.id = w.start_id
  where w.current_id = w.start_id
  order by t.key
  limit 1;
  if cycle_key is not null then
    problems := array_append(problems,
      format('Dependencies form a cycle (involving task "%s").', cycle_key));
  end if;

  return problems;
end;
$$;

create function private.publish_blueprint_version(p_version_id uuid, p_change_summary text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.blueprint_versions;
  problems text[];
begin
  select * into v from public.blueprint_versions where id = p_version_id for update;
  if not found or not private.is_mfa() or not private.has_role(v.workspace_id, 'admin') then
    raise exception 'Not allowed to publish this blueprint version'
      using errcode = 'insufficient_privilege';
  end if;
  if v.status <> 'draft' then
    raise exception 'Only drafts can be published'
      using errcode = 'check_violation', constraint = 'blueprint_version_immutable';
  end if;
  if p_change_summary is not null and length(p_change_summary) > 2000 then
    raise exception 'Change summary is too long'
      using errcode = 'check_violation', constraint = 'blueprint_versions_change_summary_length';
  end if;

  problems := public.blueprint_version_problems(p_version_id);
  if cardinality(problems) > 0 then
    raise exception '%', array_to_string(problems, ' ')
      using errcode = 'check_violation', constraint = 'blueprint_version_invalid';
  end if;

  update public.blueprint_versions
    set status = 'published',
        change_summary = nullif(btrim(coalesce(p_change_summary, '')), ''),
        published_at = now(),
        published_by = (select auth.uid()),
        content_hash = encode(
          extensions.digest(private.blueprint_version_content(p_version_id)::text, 'sha256'), 'hex')
    where id = p_version_id;
end;
$$;

create function private.retire_blueprint_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.blueprint_versions;
begin
  select * into v from public.blueprint_versions where id = p_version_id for update;
  if not found or not private.is_mfa() or not private.has_role(v.workspace_id, 'admin') then
    raise exception 'Not allowed to retire this blueprint version'
      using errcode = 'insufficient_privilege';
  end if;
  if v.status <> 'published' then
    raise exception 'Only published versions can be retired'
      using errcode = 'check_violation', constraint = 'blueprint_version_not_published';
  end if;
  update public.blueprint_versions set status = 'retired', retired_at = now() where id = p_version_id;
end;
$$;

-- Thin public wrappers (security invoker) so the definer functions stay in `private`.
create function public.publish_blueprint_version(p_version_id uuid, p_change_summary text default null)
returns void
language sql
set search_path = ''
as $$ select private.publish_blueprint_version(p_version_id, p_change_summary); $$;

create function public.retire_blueprint_version(p_version_id uuid)
returns void
language sql
set search_path = ''
as $$ select private.retire_blueprint_version(p_version_id); $$;

-- ---------------------------------------------------------------------------
-- updated_at + audit
-- ---------------------------------------------------------------------------
create trigger services_set_updated_at before update on public.services
  for each row execute function private.set_updated_at();
create trigger packages_set_updated_at before update on public.packages
  for each row execute function private.set_updated_at();
create trigger blueprints_set_updated_at before update on public.blueprints
  for each row execute function private.set_updated_at();
create trigger blueprint_versions_set_updated_at before update on public.blueprint_versions
  for each row execute function private.set_updated_at();
create trigger task_templates_set_updated_at before update on public.task_templates
  for each row execute function private.set_updated_at();
create trigger input_templates_set_updated_at before update on public.input_templates
  for each row execute function private.set_updated_at();

create trigger services_audit after insert or update on public.services
  for each row execute function private.audit_row_change(
    'service', 'id', 'workspace_id', 'code', 'name', 'list_price_minor', 'currency', 'is_active');
create trigger packages_audit after insert or update on public.packages
  for each row execute function private.audit_row_change(
    'package', 'id', 'workspace_id', 'name', 'list_price_minor', 'currency', 'is_active');
create trigger blueprints_audit after insert or update on public.blueprints
  for each row execute function private.audit_row_change(
    'blueprint', 'id', 'workspace_id', 'name', 'service_id', 'archived_at');
create trigger blueprint_versions_audit after insert or update or delete on public.blueprint_versions
  for each row execute function private.audit_row_change(
    'blueprint_version', 'id', 'workspace_id', 'blueprint_id', 'version_number', 'status',
    'content_hash', 'change_summary');

-- ---------------------------------------------------------------------------
-- RLS: everyone reads; owner/admin manage catalog and blueprints.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['services', 'packages', 'package_services', 'blueprints',
    'blueprint_versions', 'task_templates', 'task_template_dependencies', 'input_templates']
  loop
    execute format('alter table public.%1$s enable row level security', t);
    execute format(
      'create policy %1$s_require_mfa on public.%1$s as restrictive for all to authenticated
         using ((select private.is_mfa())) with check ((select private.is_mfa()))', t);
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated
         using ((select private.has_role(workspace_id, ''viewer'')))', t);
    execute format(
      'create policy %1$s_insert on public.%1$s for insert to authenticated
         with check ((select private.has_role(workspace_id, ''admin'')))', t);
    execute format(
      'create policy %1$s_update on public.%1$s for update to authenticated
         using ((select private.has_role(workspace_id, ''admin'')))
         with check ((select private.has_role(workspace_id, ''admin'')))', t);
    execute format(
      'create policy %1$s_delete on public.%1$s for delete to authenticated
         using ((select private.has_role(workspace_id, ''admin'')))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. Status/publish columns are not writable: they change only via functions.
-- Deletes: package lines, draft versions and draft templates (triggers protect the rest).
-- ---------------------------------------------------------------------------
grant select on public.services, public.packages, public.package_services, public.blueprints,
  public.blueprint_versions, public.task_templates, public.task_template_dependencies,
  public.input_templates to authenticated;

grant insert (workspace_id, code, name, category, description, list_price_minor, currency, is_active)
  on public.services to authenticated;
grant update (code, name, category, description, list_price_minor, currency, is_active)
  on public.services to authenticated;

grant insert (workspace_id, name, description, list_price_minor, currency, is_active)
  on public.packages to authenticated;
grant update (name, description, list_price_minor, currency, is_active)
  on public.packages to authenticated;

grant insert (workspace_id, package_id, service_id, quantity, position)
  on public.package_services to authenticated;
grant update (quantity, position) on public.package_services to authenticated;
grant delete on public.package_services to authenticated;

grant insert (workspace_id, service_id, name, description) on public.blueprints to authenticated;
grant update (service_id, name, description, archived_at) on public.blueprints to authenticated;

grant insert (workspace_id, blueprint_id, version_number) on public.blueprint_versions to authenticated;
grant update (change_summary) on public.blueprint_versions to authenticated;
grant delete on public.blueprint_versions to authenticated;

grant insert (workspace_id, blueprint_version_id, key, title, description, phase, position,
  estimated_hours, due_offset_days, requires_approval, approval_approver)
  on public.task_templates to authenticated;
grant update (key, title, description, phase, position, estimated_hours, due_offset_days,
  requires_approval, approval_approver) on public.task_templates to authenticated;
grant delete on public.task_templates to authenticated;

grant insert (workspace_id, blueprint_version_id, task_template_id, depends_on_id)
  on public.task_template_dependencies to authenticated;
grant delete on public.task_template_dependencies to authenticated;

grant insert (workspace_id, blueprint_version_id, key, label, description, input_kind, required,
  blocks_task_template_id) on public.input_templates to authenticated;
grant update (key, label, description, input_kind, required, blocks_task_template_id)
  on public.input_templates to authenticated;
grant delete on public.input_templates to authenticated;

-- Functions
revoke all on function public.create_draft_version(uuid, uuid) from public, anon;
revoke all on function public.blueprint_version_problems(uuid) from public, anon;
revoke all on function public.publish_blueprint_version(uuid, text) from public, anon;
revoke all on function public.retire_blueprint_version(uuid) from public, anon;
grant execute on function public.create_draft_version(uuid, uuid) to authenticated;
grant execute on function public.blueprint_version_problems(uuid) to authenticated;
grant execute on function public.publish_blueprint_version(uuid, text) to authenticated;
grant execute on function public.retire_blueprint_version(uuid) to authenticated;

revoke all on function private.require_draft_version() from public, anon, authenticated;
revoke all on function private.guard_blueprint_version() from public, anon, authenticated;
revoke all on function private.blueprint_version_content(uuid) from public, anon, authenticated;
revoke all on function private.publish_blueprint_version(uuid, text) from public, anon;
revoke all on function private.retire_blueprint_version(uuid) from public, anon;
-- Wrappers run as the caller, so the caller needs EXECUTE on the private definer functions.
-- They re-check owner/admin + MFA themselves.
grant execute on function private.publish_blueprint_version(uuid, text) to authenticated;
grant execute on function private.retire_blueprint_version(uuid) to authenticated;
