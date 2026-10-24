-- Pioneer OS — M6: AI Command Center + Approval Center.
-- Agents, work items (manual hand-off), proposed actions with approval gates, budgets, cost ledger.
-- See docs/milestone-6-plan.md, docs/security.md §7, decisions D-10, D-19…D-22.

create type public.ai_provider as enum ('manual', 'xai', 'anthropic', 'perplexity', 'openrouter', 'openai');
create type public.agent_work_type as enum ('research', 'draft_message', 'plan', 'code', 'qa', 'operations', 'other');
create type public.work_item_status as enum ('draft', 'ready', 'dispatched', 'returned', 'accepted', 'rejected', 'cancelled');
create type public.action_type as enum ('send_email', 'deploy', 'price_quote', 'sign_contract', 'publish_content', 'other');
create type public.action_status as enum ('pending', 'approved', 'rejected', 'executed', 'cancelled');

-- ---------------------------------------------------------------------------
-- Agents (FR-AGT-1): records, not users. No credentials, no login.
-- ---------------------------------------------------------------------------
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  key text not null,
  name text not null,
  role_summary text,
  instructions text,
  provider public.ai_provider not null default 'manual',
  model text,
  allowed_work_types public.agent_work_type[] not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agents_workspace_id_id_key unique (workspace_id, id),
  constraint agents_key_key unique (workspace_id, key),
  constraint agents_key_format check (key ~ '^[a-z0-9_]{2,40}$'),
  constraint agents_name_not_blank check (length(btrim(name)) between 1 and 120),
  constraint agents_role_length check (role_summary is null or length(role_summary) <= 1000),
  constraint agents_instructions_length check (instructions is null or length(instructions) <= 20000),
  constraint agents_model_length check (model is null or length(model) <= 120),
  constraint agents_work_types_not_empty check (cardinality(allowed_work_types) > 0)
);
create index agents_workspace_id_idx on public.agents (workspace_id);

-- The eight roles from the Pioneer OS vision (D-19). Instructions are pasted by the owner.
create function private.seed_agents(ws uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.agents (workspace_id, key, name, role_summary, provider, allowed_work_types) values
    (ws, 'micheal_scott', 'Micheal Scott — Orchestrator', 'Delegates tasks, tracks progress, prepares decisions for you.', 'xai', '{plan,operations,other}'),
    (ws, 'client_desk', 'Client Desk', 'Leads, discovery questions, contracts, communication drafts.', 'xai', '{draft_message,plan,research}'),
    (ws, 'research', 'Research Agent', 'Market research, competitors, platform comparisons.', 'xai', '{research}'),
    (ws, 'developer', 'Developer', 'Software implementation and technical fixes.', 'xai', '{code,plan}'),
    (ws, 'setup', 'Setup Agent', 'Hosting, configuration, approved integrations.', 'xai', '{operations,code}'),
    (ws, 'reviewer_qa', 'Reviewer / QA', 'Tests, accessibility, SEO and security checks.', 'xai', '{qa}'),
    (ws, 'maintenance', 'Maintenance Agent', 'Monitors systems and prepares issue reports.', 'xai', '{operations,qa}'),
    (ws, 'operations_finance', 'Operations / Finance Agent', 'Tracks project pricing, invoice status and costs.', 'xai', '{operations,other}')
  on conflict (workspace_id, key) do nothing;
$$;

-- ---------------------------------------------------------------------------
-- Budgets (D-21) and cost ledger. Costs in micro-USD (1 cent = 10,000).
-- ---------------------------------------------------------------------------
create table public.ai_budgets (
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  provider public.ai_provider not null,
  monthly_cap_minor bigint not null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, provider),
  constraint ai_budgets_cap_range check (monthly_cap_minor between 0 and 100000000)
);

create function private.seed_ai_budgets(ws uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.ai_budgets (workspace_id, provider, monthly_cap_minor) values
    (ws, 'anthropic', 5000), (ws, 'xai', 5000)
  on conflict (workspace_id, provider) do nothing;
$$;

create function private.workspaces_seed_ai()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_agents(new.id);
  perform private.seed_ai_budgets(new.id);
  return null;
end;
$$;
create trigger workspaces_seed_ai after insert on public.workspaces
  for each row execute function private.workspaces_seed_ai();
select private.seed_agents(id), private.seed_ai_budgets(id) from public.workspaces;

-- ---------------------------------------------------------------------------
-- Work items (FR-AGT-2…4)
-- ---------------------------------------------------------------------------
create table public.agent_work_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  agent_id uuid not null,
  client_id uuid,
  project_id uuid,
  work_type public.agent_work_type not null,
  title text not null,
  instructions text not null,
  context_options jsonb not null default '{}'::jsonb,
  context_snapshot text,
  sensitivity_flags jsonb,
  override_reason text,
  status public.work_item_status not null default 'draft',
  prepared_by uuid references auth.users (id) default auth.uid(),
  dispatched_by uuid references auth.users (id),
  dispatched_at timestamptz,
  output_text text,
  output_url text,
  returned_at timestamptz,
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  review_note text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_work_items_agent_fkey foreign key (workspace_id, agent_id)
    references public.agents (workspace_id, id) on delete restrict,
  constraint agent_work_items_client_fkey foreign key (workspace_id, client_id)
    references public.clients (workspace_id, id) on delete restrict,
  constraint agent_work_items_project_fkey foreign key (client_id, project_id)
    references public.projects (client_id, id) on delete restrict,
  constraint agent_work_items_workspace_id_id_key unique (workspace_id, id),
  constraint agent_work_items_project_needs_client check (project_id is null or client_id is not null),
  constraint agent_work_items_title_not_blank check (length(btrim(title)) between 1 and 200),
  constraint agent_work_items_instructions_not_blank check (length(btrim(instructions)) between 1 and 20000),
  constraint agent_work_items_snapshot_length check (context_snapshot is null or length(context_snapshot) <= 100000),
  constraint agent_work_items_output_length check (output_text is null or length(output_text) <= 200000),
  constraint agent_work_items_output_url_https check (output_url is null or output_url ~ '^https://\S+$'),
  constraint agent_work_items_ready_has_snapshot check (
    status in ('draft', 'cancelled') or (context_snapshot is not null and sensitivity_flags is not null)
  ),
  constraint agent_work_items_flags_need_reason check (
    status in ('draft', 'cancelled') or sensitivity_flags = '[]'::jsonb
    or length(btrim(coalesce(override_reason, ''))) > 0
  ),
  constraint agent_work_items_returned_has_output check (
    status not in ('returned', 'accepted', 'rejected') or output_text is not null or output_url is not null
  ),
  constraint agent_work_items_rejected_note check (
    status <> 'rejected' or length(btrim(coalesce(review_note, ''))) > 0
  )
);
create index agent_work_items_workspace_status_idx on public.agent_work_items (workspace_id, status);

-- Content is editable only while draft; after "ready" the snapshot is frozen.
create function private.guard_work_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' and (
       new.title is distinct from old.title or new.instructions is distinct from old.instructions
    or new.context_snapshot is distinct from old.context_snapshot
    or new.sensitivity_flags is distinct from old.sensitivity_flags
    or new.context_options is distinct from old.context_options
    or new.agent_id is distinct from old.agent_id or new.client_id is distinct from old.client_id
    or new.project_id is distinct from old.project_id or new.work_type is distinct from old.work_type) then
    raise exception 'The work item is frozen once it is ready; move it back to draft to edit it'
      using errcode = 'check_violation', constraint = 'agent_work_items_frozen';
  end if;
  return new;
end;
$$;
create trigger agent_work_items_guard before update on public.agent_work_items
  for each row execute function private.guard_work_item();

create function private.transition_work_item(
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

  if p_to = 'ready' then
    select * into a from public.agents where id = w.agent_id;
    if not a.is_active then
      raise exception 'This agent is inactive' using errcode = 'check_violation', constraint = 'agents_inactive';
    end if;
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
-- Proposed actions — the Approval Center (D-20)
-- ---------------------------------------------------------------------------
create table public.proposed_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  work_item_id uuid,
  client_id uuid,
  action_type public.action_type not null,
  title text not null,
  target text,
  details text not null,
  evidence_url text,
  status public.action_status not null default 'pending',
  requested_by uuid references auth.users (id) default auth.uid(),
  decided_by uuid references auth.users (id),
  decided_at timestamptz,
  decision_note text,
  executed_by uuid references auth.users (id),
  executed_at timestamptz,
  execution_note text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint proposed_actions_work_item_fkey foreign key (workspace_id, work_item_id)
    references public.agent_work_items (workspace_id, id) on delete restrict,
  constraint proposed_actions_client_fkey foreign key (workspace_id, client_id)
    references public.clients (workspace_id, id) on delete restrict,
  constraint proposed_actions_title_not_blank check (length(btrim(title)) between 1 and 200),
  constraint proposed_actions_target_length check (target is null or length(target) <= 500),
  constraint proposed_actions_details_not_blank check (length(btrim(details)) between 1 and 50000),
  constraint proposed_actions_evidence_https check (evidence_url is null or evidence_url ~ '^https://\S+$'),
  constraint proposed_actions_decided_fields check (
    (status = 'pending') = (decided_at is null)
  ),
  constraint proposed_actions_executed_fields check ((status = 'executed') = (executed_at is not null)),
  constraint proposed_actions_rejected_note check (
    status <> 'rejected' or length(btrim(coalesce(decision_note, ''))) > 0
  )
);
create index proposed_actions_workspace_status_idx on public.proposed_actions (workspace_id, status);

create function private.decide_action(
  p_id uuid, p_decision public.action_status, p_expected_version int, p_note text
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.proposed_actions;
begin
  select * into a from public.proposed_actions where id = p_id for update;
  if not found or not private.is_mfa() or not private.has_role(a.workspace_id, 'admin') then
    raise exception 'Only owners and admins can decide proposed actions' using errcode = 'insufficient_privilege';
  end if;
  if a.action_type in ('price_quote', 'sign_contract') and p_decision = 'approved'
     and not private.has_role(a.workspace_id, 'owner') then
    raise exception 'Only the workspace owner can approve pricing and contracts'
      using errcode = 'insufficient_privilege';
  end if;
  if a.version <> p_expected_version then
    raise exception 'This action was changed by someone else. Reload and try again.'
      using errcode = 'check_violation', constraint = 'proposed_actions_version_conflict';
  end if;
  if a.status <> 'pending' then
    raise exception 'This action was already decided'
      using errcode = 'check_violation', constraint = 'proposed_actions_immutable';
  end if;
  if p_decision not in ('approved', 'rejected', 'cancelled') then
    raise exception 'Choose approve, reject or cancel' using errcode = 'invalid_parameter_value';
  end if;
  if p_decision = 'rejected' and length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'Say why it was rejected'
      using errcode = 'check_violation', constraint = 'proposed_actions_rejected_note';
  end if;
  update public.proposed_actions set status = p_decision, decided_by = (select auth.uid()),
    decided_at = now(), decision_note = nullif(btrim(coalesce(p_note, '')), ''), version = version + 1
  where id = a.id;
  return a.version + 1;
end;
$$;

-- The gate every executor (a person now, connectors later) must pass.
create function private.require_approved_action(p_id uuid)
returns public.proposed_actions
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.proposed_actions;
begin
  select * into a from public.proposed_actions where id = p_id;
  if not found or a.status <> 'approved' then
    raise exception 'This action has not been approved'
      using errcode = 'check_violation', constraint = 'proposed_actions_not_approved';
  end if;
  return a;
end;
$$;

create function private.mark_action_executed(p_id uuid, p_expected_version int, p_note text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.proposed_actions;
begin
  select * into a from public.proposed_actions where id = p_id for update;
  if not found or not private.is_mfa() or not private.has_role(a.workspace_id, 'admin') then
    raise exception 'Only owners and admins can record executed actions' using errcode = 'insufficient_privilege';
  end if;
  perform private.require_approved_action(p_id);
  if a.version <> p_expected_version then
    raise exception 'This action was changed by someone else. Reload and try again.'
      using errcode = 'check_violation', constraint = 'proposed_actions_version_conflict';
  end if;
  update public.proposed_actions set status = 'executed', executed_by = (select auth.uid()),
    executed_at = now(), execution_note = nullif(btrim(coalesce(p_note, '')), ''), version = version + 1
  where id = a.id;
  return a.version + 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cost ledger (append-only) and budget check
-- ---------------------------------------------------------------------------
create table public.ai_usage (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  provider public.ai_provider not null,
  work_item_id uuid,
  occurred_at timestamptz not null default now(),
  cost_microusd bigint not null,
  input_tokens int,
  output_tokens int,
  note text,
  recorded_by uuid references auth.users (id) default auth.uid(),
  constraint ai_usage_work_item_fkey foreign key (workspace_id, work_item_id)
    references public.agent_work_items (workspace_id, id) on delete restrict,
  constraint ai_usage_cost_range check (cost_microusd between 0 and 1000000000000),
  constraint ai_usage_tokens_non_negative check (coalesce(input_tokens, 0) >= 0 and coalesce(output_tokens, 0) >= 0),
  constraint ai_usage_note_length check (note is null or length(note) <= 500)
);
create index ai_usage_workspace_occurred_idx on public.ai_usage (workspace_id, occurred_at desc);

create trigger ai_usage_append_only before update or delete on public.ai_usage
  for each row execute function private.prevent_audit_mutation();

create view public.ai_spend_this_month with (security_invoker = true) as
select b.workspace_id, b.provider, b.monthly_cap_minor,
  coalesce(sum(u.cost_microusd), 0) as spent_microusd,
  b.monthly_cap_minor * 10000 - coalesce(sum(u.cost_microusd), 0) as remaining_microusd
from public.ai_budgets b
join public.workspaces w on w.id = b.workspace_id
left join public.ai_usage u on u.workspace_id = b.workspace_id and u.provider = b.provider
  and (u.occurred_at at time zone w.timezone)
      >= date_trunc('month', now() at time zone w.timezone)
group by b.workspace_id, b.provider, b.monthly_cap_minor;

-- Connectors (later milestones) must call this before spending. No cap row = no spending.
create function private.ai_budget_allows(p_workspace_id uuid, p_provider public.ai_provider, p_estimate_microusd bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select s.remaining_microusd >= p_estimate_microusd
    from public.ai_spend_this_month s
    where s.workspace_id = p_workspace_id and s.provider = p_provider), false);
$$;

-- ---------------------------------------------------------------------------
-- Public wrappers
-- ---------------------------------------------------------------------------
create function public.transition_work_item(
  p_id uuid, p_to public.work_item_status, p_expected_version int,
  p_override_reason text default null, p_output_text text default null,
  p_output_url text default null, p_review_note text default null)
returns int language sql set search_path = '' as $$
  select private.transition_work_item(p_id, p_to, p_expected_version, p_override_reason,
    p_output_text, p_output_url, p_review_note); $$;

create function public.decide_action(p_id uuid, p_decision public.action_status, p_expected_version int, p_note text default null)
returns int language sql set search_path = '' as $$
  select private.decide_action(p_id, p_decision, p_expected_version, p_note); $$;

create function public.mark_action_executed(p_id uuid, p_expected_version int, p_note text default null)
returns int language sql set search_path = '' as $$
  select private.mark_action_executed(p_id, p_expected_version, p_note); $$;

-- ---------------------------------------------------------------------------
-- updated_at, version, audit
-- ---------------------------------------------------------------------------
create trigger agents_set_updated_at before update on public.agents
  for each row execute function private.set_updated_at();
create trigger agent_work_items_set_updated_at before update on public.agent_work_items
  for each row execute function private.set_updated_at();
create trigger agent_work_items_bump_version before update on public.agent_work_items
  for each row execute function private.bump_version();
create trigger proposed_actions_set_updated_at before update on public.proposed_actions
  for each row execute function private.set_updated_at();
create trigger ai_budgets_set_updated_at before update on public.ai_budgets
  for each row execute function private.set_updated_at();

create trigger agents_audit after insert or update on public.agents
  for each row execute function private.audit_row_change(
    'agent', 'id', 'workspace_id', 'name', 'provider', 'model', 'allowed_work_types', 'is_active');
create trigger agent_work_items_audit after insert or update on public.agent_work_items
  for each row execute function private.audit_row_change(
    'work_item', 'id', 'workspace_id', 'agent_id', 'client_id', 'work_type', 'title', 'status',
    'sensitivity_flags', 'override_reason', 'review_note');
create trigger proposed_actions_audit after insert or update on public.proposed_actions
  for each row execute function private.audit_row_change(
    'action', 'id', 'workspace_id', 'action_type', 'title', 'target', 'status', 'decided_by',
    'decision_note', 'executed_by');
-- ai_budgets has no uuid id; the workspace id stands in as the audit entity id.
create trigger ai_budgets_audit after insert or update on public.ai_budgets
  for each row execute function private.audit_row_change(
    'ai_budget', 'workspace_id', 'workspace_id', 'provider', 'monthly_cap_minor');

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['agents', 'ai_budgets', 'agent_work_items', 'proposed_actions', 'ai_usage'] loop
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

create policy agents_insert on public.agents for insert to authenticated
  with check ((select private.has_role(workspace_id, 'admin')));
create policy agents_update on public.agents for update to authenticated
  using ((select private.has_role(workspace_id, 'admin')))
  with check ((select private.has_role(workspace_id, 'admin')));
create policy ai_budgets_update on public.ai_budgets for update to authenticated
  using ((select private.has_role(workspace_id, 'owner')))
  with check ((select private.has_role(workspace_id, 'owner')));
create policy agent_work_items_insert on public.agent_work_items for insert to authenticated
  with check ((select private.has_role(workspace_id, 'member')) and prepared_by = (select auth.uid()));
create policy agent_work_items_update on public.agent_work_items for update to authenticated
  using ((select private.has_role(workspace_id, 'member')) and status = 'draft')
  with check ((select private.has_role(workspace_id, 'member')));
create policy proposed_actions_insert on public.proposed_actions for insert to authenticated
  with check ((select private.has_role(workspace_id, 'member')) and requested_by = (select auth.uid()));
create policy ai_usage_insert on public.ai_usage for insert to authenticated
  with check ((select private.has_role(workspace_id, 'member')));

grant select on public.agents, public.ai_budgets, public.agent_work_items, public.proposed_actions,
  public.ai_usage, public.ai_spend_this_month to authenticated;

grant insert (workspace_id, key, name, role_summary, instructions, provider, model, allowed_work_types, is_active)
  on public.agents to authenticated;
grant update (name, role_summary, instructions, provider, model, allowed_work_types, is_active)
  on public.agents to authenticated;

grant update (monthly_cap_minor) on public.ai_budgets to authenticated;

grant insert (workspace_id, agent_id, client_id, project_id, work_type, title, instructions, context_options,
  context_snapshot, sensitivity_flags) on public.agent_work_items to authenticated;
grant update (agent_id, client_id, project_id, work_type, title, instructions, context_options,
  context_snapshot, sensitivity_flags) on public.agent_work_items to authenticated;

grant insert (workspace_id, work_item_id, client_id, action_type, title, target, details, evidence_url)
  on public.proposed_actions to authenticated;

grant insert (workspace_id, provider, work_item_id, occurred_at, cost_microusd, input_tokens, output_tokens, note)
  on public.ai_usage to authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.transition_work_item(uuid, public.work_item_status, int, text, text, text, text)',
    'private.transition_work_item(uuid, public.work_item_status, int, text, text, text, text)',
    'public.decide_action(uuid, public.action_status, int, text)',
    'private.decide_action(uuid, public.action_status, int, text)',
    'public.mark_action_executed(uuid, int, text)',
    'private.mark_action_executed(uuid, int, text)',
    'private.require_approved_action(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
revoke all on function private.ai_budget_allows(uuid, public.ai_provider, bigint) from public, anon, authenticated;
revoke all on function private.seed_agents(uuid) from public, anon, authenticated;
revoke all on function private.seed_ai_budgets(uuid) from public, anon, authenticated;
revoke all on function private.workspaces_seed_ai() from public, anon, authenticated;
revoke all on function private.guard_work_item() from public, anon, authenticated;
