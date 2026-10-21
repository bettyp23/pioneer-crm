-- Pioneer OS — M4: SOWs, project generation, tasks, dependencies, client inputs, approvals.
-- See docs/milestone-4-plan.md, docs/schema.md §6, docs/architecture.md §6.2–6.4.

create type public.sow_status as enum ('draft', 'sent', 'signed', 'superseded', 'void');
create type public.project_status as enum ('active', 'on_hold', 'completed', 'cancelled');
create type public.task_status as enum ('todo', 'in_progress', 'in_review', 'on_hold', 'done', 'cancelled');
create type public.input_request_status as enum ('requested', 'received', 'accepted', 'rejected', 'waived');
create type public.approval_subject as enum ('task', 'deliverable', 'project_phase');
create type public.approval_status as enum ('pending', 'approved', 'rejected', 'withdrawn');

-- ---------------------------------------------------------------------------
-- SOW references (FR-SOW-1)
-- ---------------------------------------------------------------------------
create table public.sow_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_id uuid not null,
  title text not null,
  version_label text,
  drive_url text,
  status public.sow_status not null default 'draft',
  signed_on date,
  client_signatory text,
  supersedes_id uuid,
  scope_summary text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sow_documents_client_fkey foreign key (workspace_id, client_id)
    references public.clients (workspace_id, id) on delete restrict,
  constraint sow_documents_client_id_id_key unique (client_id, id),
  constraint sow_documents_supersedes_fkey foreign key (client_id, supersedes_id)
    references public.sow_documents (client_id, id) on delete restrict,
  constraint sow_documents_title_not_blank check (length(btrim(title)) between 1 and 200),
  constraint sow_documents_version_label_length check (version_label is null or length(version_label) <= 40),
  constraint sow_documents_drive_url_google check (
    drive_url is null or drive_url ~ '^https://(drive|docs)\.google\.com/\S*$'
  ),
  constraint sow_documents_signatory_length check (
    client_signatory is null or length(client_signatory) <= 200
  ),
  constraint sow_documents_scope_length check (scope_summary is null or length(scope_summary) <= 10000),
  constraint sow_documents_signed_fields check (
    status <> 'signed' or (signed_on is not null and length(btrim(coalesce(client_signatory, ''))) > 0)
  ),
  constraint sow_documents_not_self_superseding check (supersedes_id is null or supersedes_id <> id)
);
create index sow_documents_workspace_id_idx on public.sow_documents (workspace_id);
create index sow_documents_client_id_idx on public.sow_documents (client_id);

-- Allowed status moves; signed SOWs are frozen except → superseded/void; signing is owner-only.
create function private.guard_sow_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'sent') then
      raise exception 'New SOW references start as draft or sent; record signing as a separate step'
        using errcode = 'check_violation', constraint = 'sow_documents_status_transition';
    end if;
    return new;
  end if;

  if new.client_id <> old.client_id or new.workspace_id <> old.workspace_id then
    raise exception 'A SOW cannot move to another client'
      using errcode = 'check_violation', constraint = 'sow_documents_immutable';
  end if;

  if old.status in ('superseded', 'void') then
    raise exception 'Superseded and void SOW references cannot be changed'
      using errcode = 'check_violation', constraint = 'sow_documents_immutable';
  end if;

  if old.status = 'signed' then
    if new.status not in ('superseded', 'void')
       or (to_jsonb(new) - array['status', 'updated_at'])
          is distinct from (to_jsonb(old) - array['status', 'updated_at']) then
      raise exception 'Signed SOW references are immutable; mark them superseded or void instead'
        using errcode = 'check_violation', constraint = 'sow_documents_immutable';
    end if;
    return new;
  end if;

  -- draft / sent
  if new.status = 'superseded' then
    raise exception 'Only signed SOWs can be superseded'
      using errcode = 'check_violation', constraint = 'sow_documents_status_transition';
  end if;
  if new.status = 'draft' and old.status = 'sent' then
    raise exception 'A sent SOW cannot go back to draft'
      using errcode = 'check_violation', constraint = 'sow_documents_status_transition';
  end if;
  if new.status = 'signed' and not private.has_role(new.workspace_id, 'owner') then
    raise exception 'Only the workspace owner can record a SOW as signed'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger sow_documents_guard
  before insert or update on public.sow_documents
  for each row execute function private.guard_sow_document();

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_id uuid not null,
  lead_id uuid,
  sow_id uuid,
  no_sow_reason text,
  blueprint_version_id uuid not null,
  name text not null,
  status public.project_status not null default 'active',
  start_on date not null,
  target_end_on date,
  idempotency_key uuid not null,
  generated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_client_fkey foreign key (workspace_id, client_id)
    references public.clients (workspace_id, id) on delete restrict,
  constraint projects_lead_fkey foreign key (client_id, lead_id)
    references public.leads (client_id, id) on delete restrict,
  constraint projects_sow_fkey foreign key (client_id, sow_id)
    references public.sow_documents (client_id, id) on delete restrict,
  constraint projects_blueprint_version_fkey foreign key (workspace_id, blueprint_version_id)
    references public.blueprint_versions (workspace_id, id) on delete restrict,
  constraint projects_workspace_id_id_key unique (workspace_id, id),
  constraint projects_client_id_id_key unique (client_id, id),
  constraint projects_idempotency_key unique (workspace_id, idempotency_key),
  constraint projects_name_not_blank check (length(btrim(name)) between 1 and 200),
  constraint projects_sow_or_reason check (
    sow_id is not null or length(btrim(coalesce(no_sow_reason, ''))) between 1 and 1000
  ),
  constraint projects_target_after_start check (target_end_on is null or target_end_on >= start_on)
);
create index projects_workspace_id_idx on public.projects (workspace_id);
create index projects_client_id_idx on public.projects (client_id);

-- Activities can now reference projects of the same client (FK reserved in M2).
alter table public.activities add column project_id uuid;
alter table public.activities add constraint activities_project_fkey
  foreign key (client_id, project_id) references public.projects (client_id, id) on delete restrict;
grant insert (project_id) on public.activities to authenticated;

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  source_template_id uuid references public.task_templates (id) on delete set null,
  key text not null,
  title text not null,
  description text,
  phase text,
  position int not null,
  status public.task_status not null default 'todo',
  assignee_user_id uuid,
  due_on date,
  estimated_hours numeric(6, 2),
  requires_approval boolean not null default false,
  approval_approver public.approval_approver,
  started_at timestamptz,
  completed_at timestamptz,
  cancel_reason text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_tasks_project_fkey foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id) on delete restrict,
  constraint project_tasks_assignee_fkey foreign key (workspace_id, assignee_user_id)
    references public.workspace_members (workspace_id, user_id) on delete restrict,
  constraint project_tasks_project_id_id_key unique (project_id, id),
  constraint project_tasks_key_key unique (project_id, key),
  constraint project_tasks_title_not_blank check (length(btrim(title)) between 1 and 200),
  constraint project_tasks_approver_iff_required check (requires_approval = (approval_approver is not null)),
  constraint project_tasks_cancel_reason check (
    (status = 'cancelled') = (cancel_reason is not null and length(btrim(cancel_reason)) > 0)
  ),
  constraint project_tasks_completed_iff_done check ((status = 'done') = (completed_at is not null))
);
create index project_tasks_workspace_id_idx on public.project_tasks (workspace_id);
create index project_tasks_project_id_idx on public.project_tasks (project_id);
create index project_tasks_assignee_idx on public.project_tasks (assignee_user_id)
  where status not in ('done', 'cancelled');

create table public.task_dependencies (
  workspace_id uuid not null,
  project_id uuid not null,
  task_id uuid not null,
  depends_on_task_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  constraint task_dependencies_project_fkey foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id) on delete restrict,
  constraint task_dependencies_task_fkey foreign key (project_id, task_id)
    references public.project_tasks (project_id, id) on delete cascade,
  constraint task_dependencies_depends_on_fkey foreign key (project_id, depends_on_task_id)
    references public.project_tasks (project_id, id) on delete cascade,
  constraint task_dependencies_not_self check (task_id <> depends_on_task_id)
);
create index task_dependencies_depends_on_idx on public.task_dependencies (depends_on_task_id);

create table public.client_input_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  source_template_id uuid references public.input_templates (id) on delete set null,
  key text not null,
  label text not null,
  description text,
  input_kind public.input_kind not null,
  required boolean not null default true,
  status public.input_request_status not null default 'requested',
  drive_url text,
  response_text text,
  blocks_task_id uuid,
  requested_at timestamptz not null default now(),
  received_at timestamptz,
  decided_at timestamptz,
  waive_reason text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_input_requests_project_fkey foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id) on delete restrict,
  constraint client_input_requests_blocks_fkey foreign key (project_id, blocks_task_id)
    references public.project_tasks (project_id, id) on delete set null (blocks_task_id),
  constraint client_input_requests_key_key unique (project_id, key),
  constraint client_input_requests_drive_url_google check (
    drive_url is null or drive_url ~ '^https://(drive|docs)\.google\.com/\S*$'
  ),
  constraint client_input_requests_response_length check (
    response_text is null or length(response_text) <= 5000
  ),
  constraint client_input_requests_waive_reason check (
    (status = 'waived') = (waive_reason is not null and length(btrim(waive_reason)) > 0)
  )
);
create index client_input_requests_workspace_id_idx on public.client_input_requests (workspace_id);
create index client_input_requests_project_id_idx on public.client_input_requests (project_id);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  client_id uuid not null,
  task_id uuid,
  subject public.approval_subject not null default 'task',
  title text not null,
  approver_type public.approval_approver not null,
  status public.approval_status not null default 'pending',
  requested_by uuid references auth.users (id),
  decided_by_user_id uuid references auth.users (id),
  client_contact_id uuid,
  evidence_url text,
  decision_note text,
  decided_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approvals_project_fkey foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id) on delete restrict,
  constraint approvals_task_fkey foreign key (project_id, task_id)
    references public.project_tasks (project_id, id) on delete restrict,
  constraint approvals_client_contact_fkey foreign key (client_id, client_contact_id)
    references public.contacts (client_id, id) on delete restrict,
  constraint approvals_title_not_blank check (length(btrim(title)) between 1 and 200),
  constraint approvals_evidence_url_https check (evidence_url is null or evidence_url ~ '^https://\S+$'),
  constraint approvals_note_length check (decision_note is null or length(decision_note) <= 2000),
  constraint approvals_task_subject check ((subject = 'task') = (task_id is not null)),
  constraint approvals_decided_fields check (
    (status in ('pending') and decided_at is null and decided_by_user_id is null)
    or (status in ('approved', 'rejected', 'withdrawn') and decided_at is not null)
  ),
  constraint approvals_client_evidence check (
    approver_type <> 'client' or status not in ('approved', 'rejected')
    or (client_contact_id is not null and evidence_url is not null)
  )
);
create index approvals_workspace_status_idx on public.approvals (workspace_id, status);
create index approvals_project_id_idx on public.approvals (project_id);
create unique index approvals_one_pending_per_task on public.approvals (task_id) where status = 'pending';

-- Decided approvals are immutable (FR-APR-1).
create function private.guard_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or old.status <> 'pending' then
    raise exception 'Decided approvals are immutable'
      using errcode = 'check_violation', constraint = 'approvals_immutable';
  end if;
  return new;
end;
$$;
create trigger approvals_guard before update or delete on public.approvals
  for each row execute function private.guard_approval();

-- ---------------------------------------------------------------------------
-- Views (security_invoker: RLS applies)
-- ---------------------------------------------------------------------------
create view public.task_readiness with (security_invoker = true) as
select
  t.id as task_id,
  t.project_id,
  t.workspace_id,
  t.status,
  coalesce(dep.blockers, '[]'::jsonb) || coalesce(inp.blockers, '[]'::jsonb) as start_blockers,
  coalesce(dep.blockers, '[]'::jsonb) = '[]'::jsonb
    and coalesce(inp.blockers, '[]'::jsonb) = '[]'::jsonb as can_start,
  (not t.requires_approval or exists (
    select 1 from public.approvals a where a.task_id = t.id and a.status = 'approved'
  )) as approval_satisfied
from public.project_tasks t
left join lateral (
  select jsonb_agg(jsonb_build_object('type', 'task', 'id', p.id, 'title', p.title, 'status', p.status)
                   order by p.position) as blockers
  from public.task_dependencies d
  join public.project_tasks p on p.id = d.depends_on_task_id
  where d.task_id = t.id and p.status not in ('done', 'cancelled')  -- D-7: cancelled clears
) dep on true
left join lateral (
  select jsonb_agg(jsonb_build_object('type', 'input', 'id', i.id, 'title', i.label, 'status', i.status)
                   order by i.label) as blockers
  from public.client_input_requests i
  where i.blocks_task_id = t.id and i.status not in ('accepted', 'waived')
) inp on true;

create view public.project_progress with (security_invoker = true) as
select
  p.id as project_id,
  p.workspace_id,
  count(t.id) filter (where t.status <> 'cancelled') as total_tasks,
  count(t.id) filter (where t.status = 'done') as done_tasks,
  count(t.id) filter (where t.status = 'in_progress') as in_progress_tasks,
  count(t.id) filter (where t.status = 'in_review') as in_review_tasks,
  count(t.id) filter (where t.status = 'on_hold') as on_hold_tasks,
  count(t.id) filter (where t.status not in ('done', 'cancelled') and t.due_on < current_date) as overdue_tasks,
  case when count(t.id) filter (where t.status <> 'cancelled') = 0 then 0
       else round(100.0 * count(t.id) filter (where t.status = 'done')
                  / count(t.id) filter (where t.status <> 'cancelled'))::int end as percent_done
from public.projects p
left join public.project_tasks t on t.project_id = p.id
group by p.id, p.workspace_id;

-- ---------------------------------------------------------------------------
-- Generation (FR-PRJ-1…3)
-- ---------------------------------------------------------------------------
create function private.generate_project(
  p_client_id uuid,
  p_blueprint_version_id uuid,
  p_name text,
  p_start_on date,
  p_idempotency_key uuid,
  p_sow_id uuid,
  p_no_sow_reason text,
  p_lead_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.clients;
  v public.blueprint_versions;
  s public.sow_documents;
  existing uuid;
  new_id uuid;
  uid uuid := (select auth.uid());
begin
  select * into c from public.clients where id = p_client_id;
  if not found or not private.is_mfa() or not private.has_role(c.workspace_id, 'admin') then
    raise exception 'Not allowed to generate projects for this client' using errcode = 'insufficient_privilege';
  end if;

  -- Idempotent retry: same key → same project.
  select id into existing from public.projects
    where workspace_id = c.workspace_id and idempotency_key = p_idempotency_key;
  if existing is not null then
    return existing;
  end if;

  if c.archived_at is not null then
    raise exception 'Archived clients cannot get new projects'
      using errcode = 'check_violation', constraint = 'projects_client_archived';
  end if;

  select * into v from public.blueprint_versions
    where id = p_blueprint_version_id and workspace_id = c.workspace_id;
  if not found or v.status <> 'published' then
    raise exception 'Choose a published blueprint version'
      using errcode = 'check_violation', constraint = 'projects_blueprint_version_published';
  end if;

  if p_sow_id is not null then
    select * into s from public.sow_documents where id = p_sow_id and client_id = p_client_id;
    if not found or s.status <> 'signed' then
      raise exception 'Choose a signed SOW for this client'
        using errcode = 'check_violation', constraint = 'projects_sow_signed';
    end if;
  elsif length(btrim(coalesce(p_no_sow_reason, ''))) = 0 then
    raise exception 'A signed SOW is required, or give a reason for an internal/pilot project'
      using errcode = 'check_violation', constraint = 'projects_sow_or_reason';
  end if;

  insert into public.projects (workspace_id, client_id, lead_id, sow_id, no_sow_reason,
    blueprint_version_id, name, start_on, target_end_on, idempotency_key, generated_by)
  values (c.workspace_id, p_client_id, p_lead_id, p_sow_id,
    case when p_sow_id is null then btrim(p_no_sow_reason) end,
    p_blueprint_version_id, btrim(p_name), p_start_on,
    p_start_on + (select max(due_offset_days) from public.task_templates
                  where blueprint_version_id = p_blueprint_version_id),
    p_idempotency_key, uid)
  on conflict (workspace_id, idempotency_key) do nothing
  returning id into new_id;

  if new_id is null then
    -- A concurrent request with the same key committed first.
    select id into existing from public.projects
      where workspace_id = c.workspace_id and idempotency_key = p_idempotency_key;
    return existing;
  end if;

  insert into public.project_tasks (workspace_id, project_id, source_template_id, key, title,
    description, phase, position, due_on, estimated_hours, requires_approval, approval_approver)
  select c.workspace_id, new_id, t.id, t.key, t.title, t.description, t.phase, t.position,
    p_start_on + t.due_offset_days, t.estimated_hours, t.requires_approval, t.approval_approver
  from public.task_templates t
  where t.blueprint_version_id = p_blueprint_version_id;

  insert into public.task_dependencies (workspace_id, project_id, task_id, depends_on_task_id)
  select c.workspace_id, new_id, nt.id, nd.id
  from public.task_template_dependencies d
  join public.project_tasks nt on nt.project_id = new_id and nt.source_template_id = d.task_template_id
  join public.project_tasks nd on nd.project_id = new_id and nd.source_template_id = d.depends_on_id
  where d.blueprint_version_id = p_blueprint_version_id;

  insert into public.client_input_requests (workspace_id, project_id, source_template_id, key,
    label, description, input_kind, required, blocks_task_id)
  select c.workspace_id, new_id, i.id, i.key, i.label, i.description, i.input_kind, i.required, nt.id
  from public.input_templates i
  left join public.project_tasks nt on nt.project_id = new_id and nt.source_template_id = i.blocks_task_template_id
  where i.blueprint_version_id = p_blueprint_version_id;

  insert into public.approvals (workspace_id, project_id, client_id, task_id, subject, title,
    approver_type, requested_by)
  select c.workspace_id, new_id, p_client_id, t.id, 'task', 'Approve: ' || t.title,
    t.approval_approver, uid
  from public.project_tasks t
  where t.project_id = new_id and t.requires_approval;

  perform private.log_event(c.workspace_id, 'project.generated', 'projects', new_id,
    jsonb_build_object('name', btrim(p_name), 'client_id', p_client_id,
      'blueprint_version_id', p_blueprint_version_id, 'sow_id', p_sow_id,
      'no_sow_reason', case when p_sow_id is null then btrim(p_no_sow_reason) end),
    jsonb_build_object('rpc', 'generate_project', 'idempotency_key', p_idempotency_key));

  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Task transitions (FR-TASK-1…4, D-7)
-- ---------------------------------------------------------------------------
create function private.transition_task(
  p_task_id uuid,
  p_to_status public.task_status,
  p_expected_version int,
  p_reason text,
  p_confirm_unblock boolean
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.project_tasks;
  r public.task_readiness;
  dependents text;
  allowed boolean;
begin
  select * into t from public.project_tasks where id = p_task_id for update;
  if not found or not private.is_mfa() or not private.has_role(t.workspace_id, 'member') then
    raise exception 'Not allowed to change this task' using errcode = 'insufficient_privilege';
  end if;
  if t.version <> p_expected_version then
    raise exception 'This task was changed by someone else. Reload and try again.'
      using errcode = 'check_violation', constraint = 'project_tasks_version_conflict';
  end if;

  allowed := (t.status, p_to_status) in (
    ('todo', 'in_progress'), ('todo', 'on_hold'), ('todo', 'cancelled'),
    ('in_progress', 'in_review'), ('in_progress', 'todo'), ('in_progress', 'on_hold'), ('in_progress', 'cancelled'),
    ('in_review', 'done'), ('in_review', 'in_progress'), ('in_review', 'cancelled'),
    ('on_hold', 'todo'), ('on_hold', 'in_progress'), ('on_hold', 'cancelled')
  );
  if not allowed then
    raise exception 'A task can''t move from % to %', replace(t.status::text, '_', ' '),
      replace(p_to_status::text, '_', ' ')
      using errcode = 'check_violation', constraint = 'project_tasks_transition';
  end if;

  if p_to_status = 'in_progress' then
    select * into r from public.task_readiness where task_id = t.id;
    if not r.can_start then
      raise exception 'Blocked by: %', (
        select string_agg(b ->> 'title', ', ') from jsonb_array_elements(r.start_blockers) b)
        using errcode = 'check_violation', constraint = 'project_tasks_blocked';
    end if;
  end if;

  if p_to_status = 'done' and t.requires_approval and not exists (
    select 1 from public.approvals a where a.task_id = t.id and a.status = 'approved'
  ) then
    raise exception 'This task needs an approved approval before it can be done'
      using errcode = 'check_violation', constraint = 'project_tasks_needs_approval';
  end if;

  if p_to_status = 'cancelled' then
    if not private.has_role(t.workspace_id, 'admin') then
      raise exception 'Only owners and admins can cancel tasks' using errcode = 'insufficient_privilege';
    end if;
    if length(btrim(coalesce(p_reason, ''))) = 0 then
      raise exception 'Give a reason for cancelling'
        using errcode = 'check_violation', constraint = 'project_tasks_cancel_reason';
    end if;
    select string_agg(dt.title, ', ' order by dt.position) into dependents
      from public.task_dependencies d join public.project_tasks dt on dt.id = d.task_id
      where d.depends_on_task_id = t.id and dt.status not in ('done', 'cancelled');
    if dependents is not null and not coalesce(p_confirm_unblock, false) then
      raise exception 'Cancelling unblocks: %. Confirm to continue.', dependents
        using errcode = 'check_violation', constraint = 'project_tasks_confirm_unblock';
    end if;
  end if;

  update public.project_tasks set
    status = p_to_status,
    started_at = case when p_to_status = 'in_progress' then coalesce(started_at, now()) else started_at end,
    completed_at = case when p_to_status = 'done' then now() else null end,
    cancel_reason = case when p_to_status = 'cancelled' then btrim(p_reason) else null end
  where id = t.id;

  return t.version + 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Client inputs and approvals
-- ---------------------------------------------------------------------------
create function private.set_input_request_status(
  p_request_id uuid,
  p_to_status public.input_request_status,
  p_expected_version int,
  p_drive_url text,
  p_response_text text,
  p_waive_reason text
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.client_input_requests;
  allowed boolean;
begin
  select * into r from public.client_input_requests where id = p_request_id for update;
  if not found or not private.is_mfa() or not private.has_role(r.workspace_id, 'member') then
    raise exception 'Not allowed to update this input request' using errcode = 'insufficient_privilege';
  end if;
  if r.version <> p_expected_version then
    raise exception 'This input request was changed by someone else. Reload and try again.'
      using errcode = 'check_violation', constraint = 'client_input_requests_version_conflict';
  end if;

  allowed := (r.status, p_to_status) in (
    ('requested', 'received'), ('requested', 'waived'),
    ('received', 'accepted'), ('received', 'rejected'), ('received', 'received'),
    ('rejected', 'received'), ('rejected', 'waived'), ('accepted', 'received')
  );
  if not allowed then
    raise exception 'An input can''t move from % to %', r.status, p_to_status
      using errcode = 'check_violation', constraint = 'client_input_requests_transition';
  end if;
  if p_to_status = 'waived' and not private.has_role(r.workspace_id, 'admin') then
    raise exception 'Only owners and admins can waive inputs' using errcode = 'insufficient_privilege';
  end if;

  update public.client_input_requests set
    status = p_to_status,
    drive_url = case when p_to_status = 'received' then nullif(btrim(coalesce(p_drive_url, '')), '') else drive_url end,
    response_text = case when p_to_status = 'received' then nullif(btrim(coalesce(p_response_text, '')), '') else response_text end,
    received_at = case when p_to_status = 'received' then now() else received_at end,
    decided_at = case when p_to_status in ('accepted', 'rejected', 'waived') then now() else null end,
    waive_reason = case when p_to_status = 'waived' then btrim(coalesce(p_waive_reason, '')) else null end,
    version = version + 1
  where id = r.id;
  return r.version + 1;
end;
$$;

create function private.request_approval(p_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.project_tasks;
  new_id uuid;
begin
  select * into t from public.project_tasks where id = p_task_id;
  if not found or not private.is_mfa() or not private.has_role(t.workspace_id, 'member') then
    raise exception 'Not allowed to request approval for this task' using errcode = 'insufficient_privilege';
  end if;
  if not t.requires_approval then
    raise exception 'This task does not require approval'
      using errcode = 'check_violation', constraint = 'approvals_not_required';
  end if;
  insert into public.approvals (workspace_id, project_id, client_id, task_id, subject, title,
    approver_type, requested_by)
  select t.workspace_id, t.project_id, p.client_id, t.id, 'task', 'Approve: ' || t.title,
    t.approval_approver, (select auth.uid())
  from public.projects p where p.id = t.project_id
  returning id into new_id;
  return new_id;
end;
$$;

create function private.decide_approval(
  p_approval_id uuid,
  p_decision public.approval_status,
  p_expected_version int,
  p_note text,
  p_evidence_url text,
  p_client_contact_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.approvals;
begin
  select * into a from public.approvals where id = p_approval_id for update;
  if not found or not private.is_mfa() or not private.has_role(a.workspace_id, 'member') then
    raise exception 'Not allowed to decide this approval' using errcode = 'insufficient_privilege';
  end if;
  if a.approver_type = 'internal' and not private.has_role(a.workspace_id, 'admin') then
    raise exception 'Only owners and admins can decide internal approvals'
      using errcode = 'insufficient_privilege';
  end if;
  if a.status <> 'pending' then
    raise exception 'Decided approvals are immutable'
      using errcode = 'check_violation', constraint = 'approvals_immutable';
  end if;
  if a.version <> p_expected_version then
    raise exception 'This approval was changed by someone else. Reload and try again.'
      using errcode = 'check_violation', constraint = 'approvals_version_conflict';
  end if;
  if p_decision not in ('approved', 'rejected', 'withdrawn') then
    raise exception 'Choose approve, reject or withdraw' using errcode = 'invalid_parameter_value';
  end if;
  if a.approver_type = 'client' and p_decision in ('approved', 'rejected')
     and (p_client_contact_id is null or length(btrim(coalesce(p_evidence_url, ''))) = 0) then
    raise exception 'Client decisions need the client contact and an evidence link (e.g. a Drive copy of the email)'
      using errcode = 'check_violation', constraint = 'approvals_client_evidence';
  end if;

  update public.approvals set
    status = p_decision,
    decided_by_user_id = (select auth.uid()),
    decided_at = now(),
    decision_note = nullif(btrim(coalesce(p_note, '')), ''),
    evidence_url = nullif(btrim(coalesce(p_evidence_url, '')), ''),
    client_contact_id = case when a.approver_type = 'client' then p_client_contact_id end,
    version = version + 1
  where id = a.id;
end;
$$;

-- Public invoker wrappers.
create function public.generate_project(
  p_client_id uuid, p_blueprint_version_id uuid, p_name text, p_start_on date,
  p_idempotency_key uuid, p_sow_id uuid default null, p_no_sow_reason text default null,
  p_lead_id uuid default null)
returns uuid language sql set search_path = '' as $$
  select private.generate_project(p_client_id, p_blueprint_version_id, p_name, p_start_on,
    p_idempotency_key, p_sow_id, p_no_sow_reason, p_lead_id); $$;

create function public.transition_task(
  p_task_id uuid, p_to_status public.task_status, p_expected_version int,
  p_reason text default null, p_confirm_unblock boolean default false)
returns int language sql set search_path = '' as $$
  select private.transition_task(p_task_id, p_to_status, p_expected_version, p_reason, p_confirm_unblock); $$;

create function public.set_input_request_status(
  p_request_id uuid, p_to_status public.input_request_status, p_expected_version int,
  p_drive_url text default null, p_response_text text default null, p_waive_reason text default null)
returns int language sql set search_path = '' as $$
  select private.set_input_request_status(p_request_id, p_to_status, p_expected_version,
    p_drive_url, p_response_text, p_waive_reason); $$;

create function public.request_approval(p_task_id uuid)
returns uuid language sql set search_path = '' as $$
  select private.request_approval(p_task_id); $$;

create function public.decide_approval(
  p_approval_id uuid, p_decision public.approval_status, p_expected_version int,
  p_note text default null, p_evidence_url text default null, p_client_contact_id uuid default null)
returns void language sql set search_path = '' as $$
  select private.decide_approval(p_approval_id, p_decision, p_expected_version, p_note,
    p_evidence_url, p_client_contact_id); $$;

-- ---------------------------------------------------------------------------
-- Triggers: updated_at, version, audit
-- ---------------------------------------------------------------------------
create trigger sow_documents_set_updated_at before update on public.sow_documents
  for each row execute function private.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
  for each row execute function private.set_updated_at();
create trigger project_tasks_set_updated_at before update on public.project_tasks
  for each row execute function private.set_updated_at();
create trigger project_tasks_bump_version before update on public.project_tasks
  for each row execute function private.bump_version();
create trigger client_input_requests_set_updated_at before update on public.client_input_requests
  for each row execute function private.set_updated_at();
create trigger approvals_set_updated_at before update on public.approvals
  for each row execute function private.set_updated_at();

create trigger sow_documents_audit after insert or update on public.sow_documents
  for each row execute function private.audit_row_change(
    'sow', 'id', 'workspace_id', 'client_id', 'title', 'version_label', 'status', 'signed_on',
    'client_signatory', 'supersedes_id');
create trigger projects_audit after update on public.projects
  for each row execute function private.audit_row_change(
    'project', 'id', 'workspace_id', 'name', 'status', 'target_end_on');
create trigger project_tasks_audit after update on public.project_tasks
  for each row execute function private.audit_row_change(
    'task', 'id', 'workspace_id', 'status', 'assignee_user_id', 'due_on', 'cancel_reason');
create trigger client_input_requests_audit after update on public.client_input_requests
  for each row execute function private.audit_row_change(
    'input_request', 'id', 'workspace_id', 'status', 'waive_reason');
create trigger approvals_audit after insert or update on public.approvals
  for each row execute function private.audit_row_change(
    'approval', 'id', 'workspace_id', 'task_id', 'approver_type', 'status', 'decided_by_user_id',
    'client_contact_id', 'evidence_url');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['sow_documents', 'projects', 'project_tasks', 'task_dependencies',
    'client_input_requests', 'approvals']
  loop
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

create policy sow_documents_insert on public.sow_documents for insert to authenticated
  with check ((select private.has_role(workspace_id, 'member')));
create policy sow_documents_update on public.sow_documents for update to authenticated
  using ((select private.has_role(workspace_id, 'member')))
  with check ((select private.has_role(workspace_id, 'member')));
create policy projects_update on public.projects for update to authenticated
  using ((select private.has_role(workspace_id, 'member')))
  with check ((select private.has_role(workspace_id, 'member')));
create policy project_tasks_update on public.project_tasks for update to authenticated
  using ((select private.has_role(workspace_id, 'member')))
  with check ((select private.has_role(workspace_id, 'member')));

-- ---------------------------------------------------------------------------
-- Grants: projects/tasks/inputs/approvals are created and change state only via functions.
-- ---------------------------------------------------------------------------
grant select on public.sow_documents, public.projects, public.project_tasks,
  public.task_dependencies, public.client_input_requests, public.approvals to authenticated;
grant select on public.task_readiness, public.project_progress to authenticated;

grant insert (workspace_id, client_id, title, version_label, drive_url, status, scope_summary,
  supersedes_id) on public.sow_documents to authenticated;
grant update (title, version_label, drive_url, status, signed_on, client_signatory, scope_summary,
  supersedes_id) on public.sow_documents to authenticated;

grant update (name, status, target_end_on) on public.projects to authenticated;
grant update (assignee_user_id, due_on) on public.project_tasks to authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.generate_project(uuid, uuid, text, date, uuid, uuid, text, uuid)',
    'public.transition_task(uuid, public.task_status, int, text, boolean)',
    'public.set_input_request_status(uuid, public.input_request_status, int, text, text, text)',
    'public.request_approval(uuid)',
    'public.decide_approval(uuid, public.approval_status, int, text, text, uuid)',
    'private.generate_project(uuid, uuid, text, date, uuid, uuid, text, uuid)',
    'private.transition_task(uuid, public.task_status, int, text, boolean)',
    'private.set_input_request_status(uuid, public.input_request_status, int, text, text, text)',
    'private.request_approval(uuid)',
    'private.decide_approval(uuid, public.approval_status, int, text, text, uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

revoke all on function private.guard_sow_document() from public, anon, authenticated;
revoke all on function private.guard_approval() from public, anon, authenticated;
