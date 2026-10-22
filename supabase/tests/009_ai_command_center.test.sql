-- M6: agents, work items (manual hand-off), proposed actions, budgets.
-- (FR-AGT-1…5, D-19…D-22)
begin;
\ir helpers/fixtures.psql
select plan(40);

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
create function pg_temp.id(n text) returns uuid language sql stable as $$
  select id from ids where name = n $$;
grant execute on function pg_temp.id(text) to authenticated;
create function pg_temp.ver(n text) returns int language sql stable as $$
  select version from public.agent_work_items where id = pg_temp.id(n) $$;
grant execute on function pg_temp.ver(text) to authenticated;
create function pg_temp.aver(n text) returns int language sql stable as $$
  select version from public.proposed_actions where id = pg_temp.id(n) $$;
grant execute on function pg_temp.aver(text) to authenticated;

insert into public.clients (id, workspace_id, name)
values ('c6000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'AI Client');
insert into ids select key, id from public.agents where workspace_id = 'a0000000-0000-4000-8000-000000000001';

-- ── seeding ────────────────────────────────────────────────────────────────
select results_eq(
  $$ select count(*)::int from public.agents where workspace_id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values (8) $$, 'every workspace gets the eight vision roles'
);
select results_eq(
  $$ select provider::text, monthly_cap_minor from public.ai_budgets
     where workspace_id = 'a0000000-0000-4000-8000-000000000001' order by provider::text $$,
  $$ values ('anthropic', 5000::bigint), ('openrouter', 5000::bigint) $$,
  'budgets default to $50 for Anthropic and OpenRouter (D-21, D-24)'
);
select ok(
  not has_table_privilege('authenticated', 'public.agents', 'DELETE'), 'agents cannot be deleted'
);

-- ── member drafts a work item ─────────────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a3');
select lives_ok(
  $$ with x as (insert into public.agent_work_items (workspace_id, agent_id, client_id, work_type, title, instructions)
       values ('a0000000-0000-4000-8000-000000000001', pg_temp.id('marketing_seo'), 'c6000000-0000-4000-8000-000000000001',
               'research', 'Competitor scan', 'List three local competitors') returning id)
     insert into ids select 'w1', id from x $$,
  'member drafts a research work item'
);
select lives_ok(
  $$ insert into public.agent_work_items (workspace_id, agent_id, work_type, title, instructions, context_snapshot, sensitivity_flags)
     values ('a0000000-0000-4000-8000-000000000001', pg_temp.id('marketing_seo'), 'research', 'With snapshot', 'Do it',
             'Client: AI Client', '[]') $$,
  'members can create a draft together with its context snapshot'
);
select throws_ok(
  $$ select public.transition_work_item(pg_temp.id('w1'), 'ready', 1) $$,
  '23514', 'Build the context before marking it ready', 'ready requires a context snapshot'
);
update public.agent_work_items set context_snapshot = 'Client: AI Client. Contact: ada@example.test',
  sensitivity_flags = '[{"kind":"email","sample":"ada@…"}]' where id = pg_temp.id('w1');
select throws_ok(
  $$ select public.transition_work_item(pg_temp.id('w1'), 'ready', pg_temp.ver('w1')) $$,
  '23514', 'Sensitive content was flagged; give a reason to send it anyway',
  'flagged context needs an override reason'
);
select lives_ok(
  $$ select public.transition_work_item(pg_temp.id('w1'), 'ready', pg_temp.ver('w1'), 'Client asked us to contact Ada') $$,
  'ready with an override reason'
);
select is_empty(
  $$ update public.agent_work_items set context_snapshot = 'changed' where id = pg_temp.id('w1') returning 1 $$,
  'a ready item cannot be edited (RLS: drafts only)'
);
select throws_ok(
  $$ select public.transition_work_item(pg_temp.id('w1'), 'dispatched', pg_temp.ver('w1')) $$,
  '42501', 'Only owners and admins can dispatch, review or cancel work items', 'members cannot dispatch'
);
select throws_ok(
  $$ update public.agent_work_items set status = 'accepted' where id = pg_temp.id('w1') $$,
  '42501', null, 'status is not directly writable'
);
select lives_ok(
  $$ with x as (insert into public.agent_work_items (workspace_id, agent_id, work_type, title, instructions)
       values ('a0000000-0000-4000-8000-000000000001', pg_temp.id('marketing_seo'), 'code', 'Wrong type', 'Write code') returning id)
     insert into ids select 'w2', id from x $$,
  'a draft can name any work type'
);
update public.agent_work_items set context_snapshot = '', sensitivity_flags = '[]' where id = pg_temp.id('w2');
select throws_ok(
  $$ select public.transition_work_item(pg_temp.id('w2'), 'ready', pg_temp.ver('w2')) $$,
  '23514', 'Marketing & SEO Agent does not take code work', 'agents only take their allowed work types'
);
reset role;

-- ── owner dispatches, records the return, reviews ─────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
select lives_ok(
  $$ select public.transition_work_item(pg_temp.id('w1'), 'dispatched', pg_temp.ver('w1')) $$, 'owner dispatches'
);
select throws_ok(
  $$ select public.transition_work_item(pg_temp.id('w1'), 'returned', pg_temp.ver('w1')) $$,
  '23514', null, 'a return needs output'
);
select lives_ok(
  $$ select public.transition_work_item(pg_temp.id('w1'), 'returned', pg_temp.ver('w1'), null, 'Synthetic: three competitors…') $$,
  'output pasted back'
);
select throws_ok(
  $$ select public.transition_work_item(pg_temp.id('w1'), 'rejected', pg_temp.ver('w1')) $$,
  '23514', null, 'rejecting needs a note'
);
select lives_ok(
  $$ select public.transition_work_item(pg_temp.id('w1'), 'accepted', pg_temp.ver('w1'), null, null, null, 'Useful') $$,
  'owner accepts the output'
);
select results_eq(
  $$ select status::text, dispatched_by, reviewed_by from public.agent_work_items where id = pg_temp.id('w1') $$,
  $$ values ('accepted', 'b0000000-0000-4000-8000-0000000000a1'::uuid, 'b0000000-0000-4000-8000-0000000000a1'::uuid) $$,
  'dispatch and review are attributed'
);
select results_eq(
  $$ select count(*)::int from public.audit_events where action = 'work_item.updated' and entity_id = pg_temp.id('w1')
       and changes ? 'status' $$,
  $$ values (4) $$, 'every status change is audited (ready, dispatched, returned, accepted)'
);
select is_empty(
  $$ select 1 from public.clients where id = 'c6000000-0000-4000-8000-000000000001' and updated_at > created_at $$,
  'accepting output changes no records (FR-AGT-4)'
);
reset role;

-- ── proposed actions (Approval Center) ────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a3');
select lives_ok(
  $$ with x as (insert into public.proposed_actions (workspace_id, work_item_id, client_id, action_type, title, target, details)
       values ('a0000000-0000-4000-8000-000000000001', pg_temp.id('w1'), 'c6000000-0000-4000-8000-000000000001',
               'send_email', 'Send competitor summary', 'ada@example.test', 'Hi Ada, …') returning id)
     insert into ids select 'act1', id from x $$,
  'member proposes an email send'
);
select lives_ok(
  $$ with x as (insert into public.proposed_actions (workspace_id, client_id, action_type, title, details)
       values ('a0000000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000001',
               'price_quote', 'Quote website build', 'Catalog price: $5,000') returning id)
     insert into ids select 'act2', id from x $$,
  'member proposes a price quote'
);
select throws_ok(
  $$ select public.decide_action(pg_temp.id('act1'), 'approved', 1) $$,
  '42501', null, 'members cannot approve actions'
);
select throws_ok(
  $$ select public.mark_action_executed(pg_temp.id('act1'), 1) $$,
  '42501', null, 'members cannot mark actions executed'
);
select throws_ok(
  $$ update public.proposed_actions set status = 'approved' $$, '42501', null, 'action status is not directly writable'
);
reset role;

select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a2'); -- admin
select throws_ok(
  $$ select public.mark_action_executed(pg_temp.id('act1'), pg_temp.aver('act1')) $$,
  '23514', 'This action has not been approved', 'nothing executes before approval (D-20)'
);
select throws_ok(
  $$ select public.decide_action(pg_temp.id('act2'), 'approved', pg_temp.aver('act2')) $$,
  '42501', 'Only the workspace owner can approve pricing and contracts', 'admins cannot approve pricing'
);
select lives_ok(
  $$ select public.decide_action(pg_temp.id('act1'), 'approved', pg_temp.aver('act1'), 'Looks right') $$,
  'admin approves the email'
);
select throws_ok(
  $$ select public.decide_action(pg_temp.id('act1'), 'rejected', pg_temp.aver('act1'), 'changed mind') $$,
  '23514', 'This action was already decided', 'decisions are final'
);
select lives_ok(
  $$ select public.mark_action_executed(pg_temp.id('act1'), pg_temp.aver('act1'), 'Sent from Gmail') $$,
  'an approved action can be recorded as executed'
);
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
select lives_ok(
  $$ select public.decide_action(pg_temp.id('act2'), 'approved', pg_temp.aver('act2')) $$, 'owner approves pricing'
);
reset role;
select is(
  (private.require_approved_action(pg_temp.id('act2'))).status::text, 'approved',
  'require_approved_action passes approved actions (connector gate)'
);

-- ── budgets and ledger ─────────────────────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a3');
select lives_ok(
  $$ insert into public.ai_usage (workspace_id, provider, work_item_id, cost_microusd, note)
     values ('a0000000-0000-4000-8000-000000000001', 'openrouter', pg_temp.id('w1'), 48000000, 'Synthetic: $48') $$,
  'member records usage'
);
select is_empty(
  $$ update public.ai_budgets set monthly_cap_minor = 999999 returning 1 $$, 'members cannot change budget caps'
);
reset role;
select throws_ok(
  $$ update public.ai_usage set cost_microusd = 0 $$, '42501', 'audit_events is append-only',
  'the cost ledger is append-only'
);
select ok(private.ai_budget_allows('a0000000-0000-4000-8000-000000000001', 'openrouter', 1000000),
  'budget allows a $1 call with $2 left');
select ok(not private.ai_budget_allows('a0000000-0000-4000-8000-000000000001', 'openrouter', 3000000),
  'budget refuses a $3 call with $2 left');
select ok(not private.ai_budget_allows('a0000000-0000-4000-8000-000000000001', 'openai', 1),
  'no budget row means no spending');

select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b1');
select is_empty(
  $$ select 1 from public.agent_work_items where workspace_id = 'a0000000-0000-4000-8000-000000000001'
     union all select 1 from public.ai_spend_this_month where workspace_id = 'a0000000-0000-4000-8000-000000000001' $$,
  'outsiders see no AI data'
);
reset role;

select * from finish();
rollback;
