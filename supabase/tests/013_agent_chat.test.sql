-- Agent chat over webhooks: who can send, one delivery per message (never resent), who can
-- record replies, reply validation and de-duplication, and read access.
begin;
\ir helpers/fixtures.psql
select plan(33);

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated, service_role;
create function pg_temp.id(n text) returns uuid language sql stable as $$
  select id from ids where name = n $$;
grant execute on function pg_temp.id(text) to authenticated, service_role;

create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
end $$;

-- ── Sending ─────────────────────────────────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1'); -- owner
insert into ids select 'm1', message_id from public.send_agent_message(
  'a0000000-0000-4000-8000-000000000001', 'michael', '  Plan the site  ');
insert into ids select 't_michael', thread_id from public.messages where id = pg_temp.id('m1');
select is((select body from public.messages where id = pg_temp.id('m1')), 'Plan the site',
  'the owner sends a message to Michael (trimmed)');
select is((select recipient from public.messages where id = pg_temp.id('m1')), 'michael_scott',
  'it is addressed to Michael');
select is((select status || '/' || sent_from from public.agent_deliveries where message_id = pg_temp.id('m1')),
  'pending/bettina', 'a pending delivery from Bettina is created');
insert into ids select 'm2', message_id from public.send_agent_message(
  'a0000000-0000-4000-8000-000000000001', 'michael', 'Second');
select is((select thread_id from public.messages where id = pg_temp.id('m2')), pg_temp.id('t_michael'),
  'later messages to the same agent share the thread');
insert into ids select 'h1', message_id from public.send_agent_message(
  'a0000000-0000-4000-8000-000000000001', 'hermes', 'What time is it in Tampa?');
select ok(not exists (select 1 from public.agent_deliveries where message_id = pg_temp.id('h1')),
  'a message to Hermes has no webhook delivery until Hermes routes it');
select isnt((select thread_id from public.messages where id = pg_temp.id('h1')), pg_temp.id('t_michael'),
  'Hermes has its own thread');
insert into ids select 't_hermes', thread_id from public.messages where id = pg_temp.id('h1');

select throws_ok($$ select * from public.send_agent_message('a0000000-0000-4000-8000-000000000001', 'skynet', 'x') $$,
  '23514', null, 'unknown agents are refused');
select throws_ok($$ select * from public.send_agent_message('a0000000-0000-4000-8000-000000000002', 'michael', 'x') $$,
  '42501', null, 'nobody sends in a workspace they are not in');

reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a3'); -- member
select throws_ok($$ select * from public.send_agent_message('a0000000-0000-4000-8000-000000000001', 'michael', 'x') $$,
  '42501', null, 'members cannot message agents (owners and admins only)');
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1', 'aal1');
select throws_ok($$ select * from public.send_agent_message('a0000000-0000-4000-8000-000000000001', 'michael', 'x') $$,
  '42501', null, 'without the authenticator code the owner cannot send');

reset role;
update public.workspaces set ai_paused_at = now() where id = 'a0000000-0000-4000-8000-000000000001';
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
select throws_ok($$ select * from public.send_agent_message('a0000000-0000-4000-8000-000000000001', 'michael', 'x') $$,
  '23514', null, 'nothing is sent while all agents are paused');
reset role;
update public.workspaces set ai_paused_at = null where id = 'a0000000-0000-4000-8000-000000000001';

-- ── Server-only functions are closed to signed-in users ─────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
select throws_ok($$ select public.claim_agent_delivery(pg_temp.id('m1')) $$, '42501', null,
  'users cannot claim deliveries');
select throws_ok($$ select * from public.record_agent_reply(pg_temp.id('t_michael'), pg_temp.id('m1'),
  'michael_scott', 'forged', 'done') $$, '42501', null, 'users cannot record agent replies');
select throws_ok($$ insert into public.agent_deliveries (message_id, workspace_id, target, sent_from)
  values (pg_temp.id('h1'), 'a0000000-0000-4000-8000-000000000001', 'michael', 'bettina') $$, '42501', null,
  'users cannot write deliveries directly');
select throws_ok($$ insert into public.chat_threads (workspace_id, agent)
  values ('a0000000-0000-4000-8000-000000000001', 'michael') $$, '42501', null,
  'users cannot write threads directly');

-- ── Deliveries: claimed once, never resent ──────────────────────────────────
reset role;
select pg_temp.as_service();
select ok(public.claim_agent_delivery(pg_temp.id('m1')), 'the first claim wins');
select ok(not public.claim_agent_delivery(pg_temp.id('m1')), 'a second claim of the same message is refused');
select lives_ok($$ select public.finish_agent_delivery(pg_temp.id('m1'), true, 2) $$, 'the delivery is recorded');
reset role;
select is((select status || '/' || attempts from public.agent_deliveries where message_id = pg_temp.id('m1')),
  'delivered/2', 'delivered after two attempts');
select pg_temp.as_service();
select ok(not public.claim_agent_delivery(pg_temp.id('m1')), 'a delivered message is never claimed again');
select throws_ok($$ select public.finish_agent_delivery(pg_temp.id('m1'), false, 3, 'x') $$, '23514', null,
  'a finished delivery cannot be changed');

-- ── Replies ─────────────────────────────────────────────────────────────────
reset role;
insert into ids select 'r1', message_id from public.record_agent_reply(pg_temp.id('t_michael'), pg_temp.id('m1'),
  'michael_scott', '**Done.** Here is the plan.', 'done', '[{"label":"Doc","url":"https://example.test/doc"}]');
select is((select author || '/' || agent_status || '/' || (in_reply_to = pg_temp.id('m1'))::text
  from public.messages where id = pg_temp.id('r1')), 'michael_scott/done/true', 'Michael''s reply is stored in the thread');
select pg_temp.as_service();
select is((select duplicate from public.record_agent_reply(pg_temp.id('t_michael'), pg_temp.id('m1'),
  'michael_scott', '**Done.** Here is the plan.', 'done')), true, 'the same reply posted twice is stored once');
reset role;
select is((select count(*)::int from public.messages where in_reply_to = pg_temp.id('m1')), 1, 'still one reply');
select pg_temp.as_service();
select is((select duplicate from public.record_agent_reply(pg_temp.id('t_michael'), pg_temp.id('m1'),
  'michael_scott', 'Working on it', 'working')), false, 'a different status update is a new message');

select throws_ok($$ select * from public.record_agent_reply(pg_temp.id('t_michael'), pg_temp.id('m2'),
  'michael_scott', 'x', 'done') $$, 'P0002', null, 'Michael cannot answer a message that was never sent to him');
select throws_ok($$ select * from public.record_agent_reply(gen_random_uuid(), pg_temp.id('m1'),
  'michael_scott', 'x', 'done') $$, 'P0002', null, 'unknown threads are refused');
select throws_ok($$ select * from public.record_agent_reply(pg_temp.id('t_hermes'), pg_temp.id('m1'),
  'michael_scott', 'x', 'done') $$, 'P0002', null, 'a message from another thread is refused');
select throws_ok($$ select * from public.record_agent_reply(pg_temp.id('t_michael'), pg_temp.id('r1'),
  'michael_scott', 'x', 'done') $$, 'P0002', null, 'agents reply only to the owner''s messages');

-- Hermes routes to Michael: one delivery from Hermes; Michael may then answer.
select ok(public.route_agent_message(pg_temp.id('h1'), 'michael'), 'Hermes routes a message to Michael');
select ok(not public.route_agent_message(pg_temp.id('h1'), 'michael'), 'routing the same message again does nothing');
select throws_ok($$ select public.route_agent_message(pg_temp.id('m2'), 'michael') $$, '23514', null,
  'only messages sent to Hermes can be routed');

-- ── Reading ─────────────────────────────────────────────────────────────────
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a4'); -- viewer
select is((select count(*)::int from public.agent_deliveries), 3, 'staff can read deliveries in their workspace');

select * from finish();
rollback;
