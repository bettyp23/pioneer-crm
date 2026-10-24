-- Pioneer OS — M5: routines, routine runs, diagnostics, issues, invoices, reports.
-- See docs/milestone-5-plan.md and docs/schema.md §7.

create type public.routine_cadence as enum ('daily', 'weekly', 'monthly', 'quarterly', 'yearly');
create type public.routine_run_status as enum ('pending', 'done', 'skipped', 'failed');
create type public.issue_severity as enum ('low', 'medium', 'high', 'critical');
create type public.issue_status as enum ('open', 'triaged', 'in_progress', 'resolved', 'wont_fix');
create type public.invoice_system as enum ('quickbooks', 'stripe', 'wave', 'xero', 'freshbooks', 'other');
create type public.invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'void');

-- ---------------------------------------------------------------------------
-- Routines (FR-RTN-1/2)
-- ---------------------------------------------------------------------------
create table public.routines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  client_id uuid,
  project_id uuid,
  name text not null,
  description text,
  cadence public.routine_cadence not null,
  interval_count int not null default 1,
  anchor_on date not null,
  owner_user_id uuid,
  runbook_url text,
  is_active boolean not null default true,
  next_due_on date,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routines_workspace_id_id_key unique (workspace_id, id),
  constraint routines_client_fkey foreign key (workspace_id, client_id)
    references public.clients (workspace_id, id) on delete restrict,
  constraint routines_project_fkey foreign key (client_id, project_id)
    references public.projects (client_id, id) on delete restrict,
  constraint routines_owner_fkey foreign key (workspace_id, owner_user_id)
    references public.workspace_members (workspace_id, user_id) on delete restrict,
  constraint routines_project_needs_client check (project_id is null or client_id is not null),
  constraint routines_name_not_blank check (length(btrim(name)) between 1 and 200),
  constraint routines_description_length check (description is null or length(description) <= 5000),
  constraint routines_interval_range check (interval_count between 1 and 52),
  constraint routines_runbook_url_https check (runbook_url is null or runbook_url ~ '^https://\S+$')
);
create index routines_workspace_id_idx on public.routines (workspace_id);
create index routines_client_id_idx on public.routines (client_id);

create table public.routine_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  routine_id uuid not null,
  scheduled_for date not null,
  status public.routine_run_status not null default 'pending',
  completed_by uuid references auth.users (id),
  completed_at timestamptz,
  notes text,
  evidence_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routine_runs_routine_fkey foreign key (workspace_id, routine_id)
    references public.routines (workspace_id, id) on delete restrict,
  constraint routine_runs_once_per_date unique (routine_id, scheduled_for),
  constraint routine_runs_completed_iff_closed check ((status = 'pending') = (completed_at is null)),
  constraint routine_runs_notes_length check (notes is null or length(notes) <= 5000),
  constraint routine_runs_evidence_url_https check (evidence_url is null or evidence_url ~ '^https://\S+$')
);
create index routine_runs_workspace_scheduled_idx on public.routine_runs (workspace_id, scheduled_for)
  where status = 'pending';

-- k-th occurrence of a routine (k ≥ 0), always computed from the anchor so month-end anchors
-- stay stable (Jan 31 → Feb 28 → Mar 31).
create function private.routine_occurrence(p_anchor date, p_cadence public.routine_cadence, p_interval int, p_k int)
returns date
language sql
immutable
set search_path = ''
as $$
  select case p_cadence
    when 'daily' then p_anchor + p_k * p_interval
    when 'weekly' then p_anchor + p_k * p_interval * 7
    when 'monthly' then (p_anchor + make_interval(months => p_k * p_interval))::date
    when 'quarterly' then (p_anchor + make_interval(months => p_k * p_interval * 3))::date
    when 'yearly' then (p_anchor + make_interval(years => p_k * p_interval))::date
  end;
$$;

-- Creates pending runs for every active routine in the workspace up to `p_through`
-- (inclusive) and refreshes next_due_on. Idempotent: ON CONFLICT on (routine, date).
-- Runs start on the later of the anchor and the day the routine was created (no flood of
-- "missed" history) and continue after the last generated run. At most 400 new runs per
-- routine per call.
create function private.generate_routine_runs(p_workspace_id uuid, p_through date)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.routines;
  k int;
  d date;
  start_from date;
  inserted int;
  created int := 0;
  n int;
  tz text;
begin
  if not private.is_mfa() or not private.has_role(p_workspace_id, 'member') then
    -- Callers without write access just see existing runs.
    return 0;
  end if;
  select timezone into tz from public.workspaces where id = p_workspace_id;
  p_through := coalesce(p_through, (now() at time zone tz)::date);  -- workspace-local today

  for r in select * from public.routines where workspace_id = p_workspace_id and is_active loop
    -- Creation day in the workspace timezone (dates in Pioneer OS are workspace-local).
    start_from := greatest(
      (r.created_at at time zone tz)::date,
      coalesce((select max(scheduled_for) + 1 from public.routine_runs where routine_id = r.id), r.anchor_on)
    );
    k := 0;
    inserted := 0;
    loop
      d := private.routine_occurrence(r.anchor_on, r.cadence, r.interval_count, k);
      exit when d > p_through or inserted >= 400 or k >= 100000;
      if d >= start_from then
        insert into public.routine_runs (workspace_id, routine_id, scheduled_for)
          values (r.workspace_id, r.id, d)
          on conflict (routine_id, scheduled_for) do nothing;
        get diagnostics n = row_count;
        created := created + n;
        inserted := inserted + 1;
      end if;
      k := k + 1;
    end loop;

    update public.routines set next_due_on = coalesce(
      (select min(scheduled_for) from public.routine_runs where routine_id = r.id and status = 'pending'),
      private.routine_occurrence(r.anchor_on, r.cadence, r.interval_count, k)
    ) where id = r.id;
  end loop;
  return created;
end;
$$;

create function public.generate_routine_runs(p_workspace_id uuid, p_through date default null)
returns int language sql set search_path = '' as $$
  select private.generate_routine_runs(p_workspace_id, p_through); $$;

-- Stamp completion; keep next_due_on in step.
create function private.routine_runs_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' then
    new.completed_at := null;
    new.completed_by := null;
  elsif old.status = 'pending' or new.status <> old.status then
    new.completed_at := now();
    new.completed_by := (select auth.uid());
  end if;
  return new;
end;
$$;

create function private.routine_runs_refresh_next_due()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.routines rt set next_due_on = coalesce(
    (select min(scheduled_for) from public.routine_runs where routine_id = rt.id and status = 'pending'),
    rt.next_due_on)
  where rt.id = new.routine_id;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Diagnostics and issues (FR-DIA-1, FR-ISS-1)
-- ---------------------------------------------------------------------------
create table public.diagnostics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_id uuid not null,
  project_id uuid,
  diagnostic_type text not null,
  performed_on date not null,
  performed_by uuid,
  summary text not null,
  score numeric(5, 2),
  report_url text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diagnostics_client_fkey foreign key (workspace_id, client_id)
    references public.clients (workspace_id, id) on delete restrict,
  constraint diagnostics_project_fkey foreign key (client_id, project_id)
    references public.projects (client_id, id) on delete restrict,
  constraint diagnostics_performer_fkey foreign key (workspace_id, performed_by)
    references public.workspace_members (workspace_id, user_id) on delete restrict,
  constraint diagnostics_client_id_id_key unique (client_id, id),
  constraint diagnostics_type_not_blank check (length(btrim(diagnostic_type)) between 1 and 80),
  constraint diagnostics_summary_not_blank check (length(btrim(summary)) between 1 and 10000),
  constraint diagnostics_score_range check (score is null or score between 0 and 100),
  constraint diagnostics_report_url_https check (report_url is null or report_url ~ '^https://\S+$')
);
create index diagnostics_workspace_id_idx on public.diagnostics (workspace_id);
create index diagnostics_client_id_idx on public.diagnostics (client_id);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_id uuid not null,
  project_id uuid,
  diagnostic_id uuid,
  title text not null,
  description text,
  severity public.issue_severity not null default 'medium',
  status public.issue_status not null default 'open',
  assignee_user_id uuid,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint issues_client_fkey foreign key (workspace_id, client_id)
    references public.clients (workspace_id, id) on delete restrict,
  constraint issues_project_fkey foreign key (client_id, project_id)
    references public.projects (client_id, id) on delete restrict,
  constraint issues_diagnostic_fkey foreign key (client_id, diagnostic_id)
    references public.diagnostics (client_id, id) on delete restrict,
  constraint issues_assignee_fkey foreign key (workspace_id, assignee_user_id)
    references public.workspace_members (workspace_id, user_id) on delete restrict,
  constraint issues_title_not_blank check (length(btrim(title)) between 1 and 200),
  constraint issues_description_length check (description is null or length(description) <= 10000),
  constraint issues_resolved_iff_closed check (
    (status in ('resolved', 'wont_fix')) = (resolved_at is not null)
  ),
  constraint issues_resolution_when_closed check (
    status not in ('resolved', 'wont_fix') or length(btrim(coalesce(resolution, ''))) between 1 and 5000
  )
);
create index issues_workspace_status_idx on public.issues (workspace_id, status);
create index issues_client_id_idx on public.issues (client_id);

create function private.issues_stamp_resolved()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('resolved', 'wont_fix') then
    if tg_op = 'INSERT' or old.status not in ('resolved', 'wont_fix') then
      new.resolved_at := now();
    end if;
  else
    new.resolved_at := null;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invoices — metadata only (FR-INV-1, docs/security.md §6)
-- ---------------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_id uuid not null,
  project_id uuid,
  external_system public.invoice_system not null,
  external_number text not null,
  external_url text,
  issued_on date not null,
  due_on date,
  amount_minor bigint not null,
  currency char(3) not null default 'USD',
  status public.invoice_status not null default 'sent',
  paid_on date,
  notes text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_client_fkey foreign key (workspace_id, client_id)
    references public.clients (workspace_id, id) on delete restrict,
  constraint invoices_project_fkey foreign key (client_id, project_id)
    references public.projects (client_id, id) on delete restrict,
  constraint invoices_external_key unique (workspace_id, external_system, external_number),
  constraint invoices_number_not_blank check (length(btrim(external_number)) between 1 and 60),
  constraint invoices_external_url_https check (external_url is null or external_url ~ '^https://\S+$'),
  constraint invoices_amount_non_negative check (amount_minor >= 0 and amount_minor <= 1000000000000),
  constraint invoices_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint invoices_due_after_issue check (due_on is null or due_on >= issued_on),
  constraint invoices_paid_iff_paid check ((status = 'paid') = (paid_on is not null)),
  constraint invoices_notes_length check (notes is null or length(notes) <= 2000)
);
create index invoices_workspace_status_idx on public.invoices (workspace_id, status);
create index invoices_client_id_idx on public.invoices (client_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create trigger routines_set_updated_at before update on public.routines
  for each row execute function private.set_updated_at();
create trigger routine_runs_set_updated_at before update on public.routine_runs
  for each row execute function private.set_updated_at();
create trigger routine_runs_stamp before update of status on public.routine_runs
  for each row execute function private.routine_runs_stamp();
create trigger routine_runs_refresh_next_due after update of status on public.routine_runs
  for each row execute function private.routine_runs_refresh_next_due();
create trigger diagnostics_set_updated_at before update on public.diagnostics
  for each row execute function private.set_updated_at();
create trigger issues_set_updated_at before update on public.issues
  for each row execute function private.set_updated_at();
create trigger issues_stamp_resolved before insert or update of status on public.issues
  for each row execute function private.issues_stamp_resolved();
create trigger invoices_set_updated_at before update on public.invoices
  for each row execute function private.set_updated_at();

create trigger routines_audit after insert or update on public.routines
  for each row execute function private.audit_row_change(
    'routine', 'id', 'workspace_id', 'name', 'cadence', 'interval_count', 'anchor_on',
    'owner_user_id', 'is_active');
create trigger routine_runs_audit after update on public.routine_runs
  for each row execute function private.audit_row_change(
    'routine_run', 'id', 'workspace_id', 'routine_id', 'scheduled_for', 'status');
create trigger issues_audit after insert or update on public.issues
  for each row execute function private.audit_row_change(
    'issue', 'id', 'workspace_id', 'title', 'severity', 'status', 'assignee_user_id');
create trigger invoices_audit after insert or update on public.invoices
  for each row execute function private.audit_row_change(
    'invoice', 'id', 'workspace_id', 'client_id', 'external_system', 'external_number',
    'amount_minor', 'currency', 'status', 'paid_on');

-- ---------------------------------------------------------------------------
-- Reporting views (FR-RPT-1). security_invoker: RLS applies.
-- "Today" is the workspace's local date (D-11), not the database's UTC date.
-- ---------------------------------------------------------------------------
create function private.workspace_today(ws uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone w.timezone)::date from public.workspaces w where w.id = ws;
$$;
revoke all on function private.workspace_today(uuid) from public, anon;
grant execute on function private.workspace_today(uuid) to authenticated;

-- Redefine M4's progress view with workspace-local "overdue".
create or replace view public.project_progress with (security_invoker = true) as
select
  p.id as project_id,
  p.workspace_id,
  count(t.id) filter (where t.status <> 'cancelled') as total_tasks,
  count(t.id) filter (where t.status = 'done') as done_tasks,
  count(t.id) filter (where t.status = 'in_progress') as in_progress_tasks,
  count(t.id) filter (where t.status = 'in_review') as in_review_tasks,
  count(t.id) filter (where t.status = 'on_hold') as on_hold_tasks,
  count(t.id) filter (where t.status not in ('done', 'cancelled')
                        and t.due_on < private.workspace_today(p.workspace_id)) as overdue_tasks,
  case when count(t.id) filter (where t.status <> 'cancelled') = 0 then 0
       else round(100.0 * count(t.id) filter (where t.status = 'done')
                  / count(t.id) filter (where t.status <> 'cancelled'))::int end as percent_done
from public.projects p
left join public.project_tasks t on t.project_id = p.id
group by p.id, p.workspace_id;
create view public.pipeline_summary with (security_invoker = true) as
select s.workspace_id, s.id as stage_id, s.name as stage_name, s.position, s.kind,
  count(l.id) as lead_count,
  coalesce(sum(l.estimated_value_minor), 0) as estimated_value_minor
from public.pipeline_stages s
left join public.leads l on l.stage_id = s.id and l.archived_at is null
group by s.workspace_id, s.id, s.name, s.position, s.kind;

create view public.project_health with (security_invoker = true) as
select p.workspace_id, p.id as project_id, p.name, p.status, c.name as client_name,
  pp.total_tasks, pp.done_tasks, pp.percent_done, pp.overdue_tasks,
  (select count(*) from public.task_readiness r
     where r.project_id = p.id and r.status = 'todo' and not r.can_start) as blocked_tasks,
  (select count(*) from public.approvals a where a.project_id = p.id and a.status = 'pending') as pending_approvals,
  (select count(*) from public.client_input_requests i
     where i.project_id = p.id and i.status not in ('accepted', 'waived')) as open_inputs,
  p.target_end_on
from public.projects p
join public.clients c on c.id = p.client_id
left join public.project_progress pp on pp.project_id = p.id;

create view public.overdue_tasks with (security_invoker = true) as
select t.workspace_id, t.id as task_id, t.title, t.status, t.due_on, t.assignee_user_id,
  p.id as project_id, p.name as project_name,
  private.workspace_today(t.workspace_id) - t.due_on as days_overdue
from public.project_tasks t
join public.projects p on p.id = t.project_id
where t.status not in ('done', 'cancelled') and t.due_on < private.workspace_today(t.workspace_id)
  and p.status = 'active';

create view public.routine_compliance with (security_invoker = true) as
select r.workspace_id, r.id as routine_id, r.name, r.cadence, r.is_active, r.client_id,
  count(rr.id) filter (where rr.scheduled_for <= d.today) as due_runs,
  count(rr.id) filter (where rr.status = 'done') as done_runs,
  count(rr.id) filter (where rr.status = 'skipped') as skipped_runs,
  count(rr.id) filter (where rr.status = 'failed') as failed_runs,
  count(rr.id) filter (where rr.status = 'pending' and rr.scheduled_for < d.today) as missed_runs,
  case when count(rr.id) filter (where rr.scheduled_for <= d.today) = 0 then null
       else round(100.0 * count(rr.id) filter (where rr.status = 'done')
                  / count(rr.id) filter (where rr.scheduled_for <= d.today))::int end as compliance_percent
from public.routines r
cross join lateral (select private.workspace_today(r.workspace_id) as today) d
left join public.routine_runs rr on rr.routine_id = r.id and rr.scheduled_for > d.today - 90
  and rr.scheduled_for <= d.today
group by r.workspace_id, r.id, r.name, r.cadence, r.is_active, r.client_id, d.today;

create view public.open_issues_by_severity with (security_invoker = true) as
select workspace_id, severity, count(*) as open_count,
  min(opened_at) as oldest_opened_at
from public.issues
where status not in ('resolved', 'wont_fix')
group by workspace_id, severity;

create view public.receivables_by_status with (security_invoker = true) as
select workspace_id,
  case when status = 'sent' and due_on < private.workspace_today(workspace_id)
       then 'overdue'::public.invoice_status else status end as status,
  currency, count(*) as invoice_count, sum(amount_minor) as amount_minor
from public.invoices
where status <> 'void'
group by 1, 2, 3;

-- ---------------------------------------------------------------------------
-- RLS + grants: viewer read; member write; no hard deletes.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['routines', 'routine_runs', 'diagnostics', 'issues', 'invoices'] loop
    execute format('alter table public.%1$s enable row level security', t);
    execute format(
      'create policy %1$s_require_mfa on public.%1$s as restrictive for all to authenticated
         using ((select private.is_mfa())) with check ((select private.is_mfa()))', t);
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated
         using ((select private.has_role(workspace_id, ''viewer'')))', t);
    execute format(
      'create policy %1$s_update on public.%1$s for update to authenticated
         using ((select private.has_role(workspace_id, ''member'')))
         with check ((select private.has_role(workspace_id, ''member'')))', t);
  end loop;
  foreach t in array array['routines', 'diagnostics', 'issues', 'invoices'] loop
    execute format(
      'create policy %1$s_insert on public.%1$s for insert to authenticated
         with check ((select private.has_role(workspace_id, ''member'')))', t);
  end loop;
end;
$$;

grant select on public.routines, public.routine_runs, public.diagnostics, public.issues,
  public.invoices to authenticated;
grant select on public.pipeline_summary, public.project_health, public.overdue_tasks,
  public.routine_compliance, public.open_issues_by_severity, public.receivables_by_status
  to authenticated;

grant insert (workspace_id, client_id, project_id, name, description, cadence, interval_count,
  anchor_on, owner_user_id, runbook_url, is_active) on public.routines to authenticated;
grant update (client_id, project_id, name, description, cadence, interval_count, anchor_on,
  owner_user_id, runbook_url, is_active) on public.routines to authenticated;

grant update (status, notes, evidence_url) on public.routine_runs to authenticated;

grant insert (workspace_id, client_id, project_id, diagnostic_type, performed_on, performed_by,
  summary, score, report_url) on public.diagnostics to authenticated;
grant update (project_id, diagnostic_type, performed_on, performed_by, summary, score, report_url)
  on public.diagnostics to authenticated;

grant insert (workspace_id, client_id, project_id, diagnostic_id, title, description, severity,
  status, assignee_user_id, resolution) on public.issues to authenticated;
grant update (project_id, title, description, severity, status, assignee_user_id, resolution)
  on public.issues to authenticated;

grant insert (workspace_id, client_id, project_id, external_system, external_number, external_url,
  issued_on, due_on, amount_minor, currency, status, paid_on, notes) on public.invoices to authenticated;
grant update (project_id, external_system, external_number, external_url, issued_on, due_on,
  amount_minor, currency, status, paid_on, notes) on public.invoices to authenticated;

revoke all on function public.generate_routine_runs(uuid, date) from public, anon;
revoke all on function private.generate_routine_runs(uuid, date) from public, anon;
grant execute on function public.generate_routine_runs(uuid, date) to authenticated;
grant execute on function private.generate_routine_runs(uuid, date) to authenticated;
revoke all on function private.routine_occurrence(date, public.routine_cadence, int, int) from public, anon;
grant execute on function private.routine_occurrence(date, public.routine_cadence, int, int) to authenticated;
revoke all on function private.routine_runs_stamp() from public, anon, authenticated;
revoke all on function private.routine_runs_refresh_next_due() from public, anon, authenticated;
revoke all on function private.issues_stamp_resolved() from public, anon, authenticated;
