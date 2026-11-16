-- Hosted relay: service_role reaches worker.begin_dispatch and worker.accept_result through
-- public wrappers. The Mac worker still uses worker.* and cannot take a job the relay holds.
begin;
\ir helpers/fixtures.psql
select plan(42);

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated, pioneer_worker, service_role;
create function pg_temp.id(n text) returns uuid language sql stable as $$
  select id from ids where name = n $$;
grant execute on function pg_temp.id(text) to authenticated, pioneer_worker, service_role;
create function pg_temp.h(t text) returns text language sql immutable as $$
  select encode(extensions.digest(t, 'sha256'), 'hex') $$;
grant execute on function pg_temp.h(text) to authenticated, pioneer_worker, service_role;
grant pioneer_worker to postgres;
grant service_role to postgres;
grant usage on schema extensions to pioneer_worker, service_role;

delete from public.job_attempts;
delete from public.jobs where workspace_id <> 'a0000000-0000-4000-8000-000000000001';
insert into ids values ('ws', 'a0000000-0000-4000-8000-000000000001');

-- ── privileges ─────────────────────────────────────────────────────────────
select ok(not has_function_privilege('anon', 'public.relay_claim_grok_jobs(text, int)', 'execute'),
  'anon cannot claim sends');
select ok(not has_function_privilege('anon', 'public.relay_accept_result(text, uuid, text, text, text, text, text)', 'execute'),
  'anon cannot post replies');
select ok(not has_function_privilege('authenticated', 'public.relay_claim_grok_jobs(text, int)', 'execute'),
  'app users cannot claim sends');
select ok(not has_function_privilege('authenticated', 'public.relay_begin_dispatch(uuid, text, text, int)', 'execute'),
  'app users cannot start sends');
select ok(not has_function_privilege('authenticated', 'public.relay_mark_waiting(uuid, text, text)', 'execute'),
  'app users cannot mark sends waiting');
select ok(not has_function_privilege('authenticated', 'public.relay_fail_job(uuid, text, text, boolean)', 'execute'),
  'app users cannot fail sends');
select ok(not has_function_privilege('authenticated', 'public.relay_accept_result(text, uuid, text, text, text, text, text)', 'execute'),
  'app users cannot post replies through the relay');
select ok(not has_function_privilege('authenticated', 'worker.claim_grok_jobs(text, int)', 'execute'),
  'app users cannot call the worker claim directly');
select ok(has_function_privilege('service_role', 'public.relay_claim_grok_jobs(text, int)', 'execute'),
  'the hosted app can claim Michael Scott sends');
select ok(has_function_privilege('service_role', 'public.relay_accept_result(text, uuid, text, text, text, text, text)', 'execute'),
  'the hosted app can post replies');
select ok(not has_table_privilege('service_role', 'public.jobs', 'select'),
  'service_role still cannot read the jobs table');
select ok(not has_table_privilege('service_role', 'public.messages', 'insert'),
  'service_role still cannot insert messages directly');
select ok(has_function_privilege('pioneer_worker', 'worker.accept_result(text, uuid, text, text, text, text, text)', 'execute'),
  'the Mac worker can still post replies');
select ok(not has_function_privilege('pioneer_worker', 'public.relay_accept_result(text, uuid, text, text, text, text, text)', 'execute'),
  'the Mac worker does not use the hosted wrappers');

-- ── claim: hosted takes grok jobs, the Mac keeps Claude and cannot double-claim ──
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
select lives_ok(
  $$ insert into ids values ('m_a', public.send_message(pg_temp.id('ws'), 'Synthetic: first note', 'michael_scott')) $$,
  'the owner queues a message to Michael Scott');
select lives_ok(
  $$ insert into ids values ('m_b', public.send_message(pg_temp.id('ws'), 'Synthetic: second note', 'michael_scott')) $$,
  'the owner queues a second message');
select lives_ok(
  $$ insert into ids values ('m_claude', public.send_message(pg_temp.id('ws'), 'Synthetic: for Claude', 'claude')) $$,
  'the owner queues a Claude message');
reset role;
insert into ids select 'j_a', job_id from public.messages where id = pg_temp.id('m_a');
insert into ids select 'j_b', job_id from public.messages where id = pg_temp.id('m_b');
insert into ids select 'j_claude', job_id from public.messages where id = pg_temp.id('m_claude');

set local role service_role;
-- \gset keeps the claim result without printing message text into the TAP stream.
select public.relay_claim_grok_jobs('hosted', 5) as claimed \gset
reset role;
select is(jsonb_array_length(:'claimed'::jsonb), 2, 'the relay claims only the two Michael Scott sends');
select ok(:'claimed'::jsonb @> jsonb_build_array(jsonb_build_object('id', pg_temp.id('j_a'))),
  'the first job was claimed');
select ok(:'claimed'::jsonb @> jsonb_build_array(jsonb_build_object('id', pg_temp.id('j_b'))),
  'the second job was claimed');
select is((select status::text from public.jobs where id = pg_temp.id('j_claude')), 'queued',
  'a Claude job stays queued for the Mac worker');
set local role pioneer_worker;
select is((select count(*)::int from worker.claim_jobs('mac-1', array['grok.dispatch'], 5)), 0,
  'the Mac worker does not claim a job the relay holds');
select is((select count(*)::int from worker.claim_jobs('mac-1', array['claude.task'], 5)), 1,
  'the Mac worker still claims Claude jobs');
reset role;

-- ── exactly once ───────────────────────────────────────────────────────────
set local role service_role;
select is(public.relay_begin_dispatch(pg_temp.id('j_a'), 'hosted', pg_temp.h('code-a'), 86400), 'ok',
  'the holder may send');
select is(public.relay_begin_dispatch(pg_temp.id('j_a'), 'hosted', pg_temp.h('code-a'), 86400), 'already_sent',
  'a second send of the same attempt is refused');
reset role;
set local role pioneer_worker;
select is(worker.begin_dispatch(pg_temp.id('j_a'), 'mac-1', pg_temp.h('code-mac'), 86400), 'not_held',
  'the Mac worker cannot send a job it does not hold');
reset role;
select is((select count(*)::int from public.job_dispatches where job_id = pg_temp.id('j_a')), 1,
  'the one-time code is stored once');

-- ── replies: wrong code, expired code, then one accepted reply and a duplicate ──
set local role service_role;
select is(public.relay_mark_waiting(pg_temp.id('j_a'), 'hosted', null), true, 'the sent job waits for a reply');
select is(public.relay_accept_result(pg_temp.h('row-wrong'), pg_temp.id('j_a'), 'wrong', 'michael_scott', 'result', '', 'nope'),
  'ignored: wrong code', 'a reply with the wrong code is ignored');
reset role;
update public.job_dispatches
  set expires_at = now() - interval '1 minute', dispatched_at = now() - interval '2 minutes'
  where job_id = pg_temp.id('j_a');
set local role service_role;
select is(public.relay_accept_result(pg_temp.h('row-late'), pg_temp.id('j_a'), 'code-a', 'michael_scott', 'result', '', 'late'),
  'ignored: code expired', 'a reply after the code expires is ignored');
select is(public.relay_begin_dispatch(pg_temp.id('j_b'), 'hosted', pg_temp.h('code-b'), 86400), 'ok',
  'the second job can be sent');
select is(public.relay_mark_waiting(pg_temp.id('j_b'), 'hosted', null), true, 'the second job waits');
select is(public.relay_accept_result(pg_temp.h('row-ok'), pg_temp.id('j_b'), 'code-b', 'michael_scott', 'result', '', 'The draft is ready.'),
  'accepted', 'the matching reply is accepted');
select is(public.relay_accept_result(pg_temp.h('row-ok'), pg_temp.id('j_b'), 'code-b', 'michael_scott', 'result', '', 'The draft is ready.'),
  'duplicate', 'the same reply is stored once');
reset role;
select is((select count(*)::int from public.messages
            where job_id = pg_temp.id('j_b') and author = 'michael_scott' and body = 'The draft is ready.'),
  1, 'the reply shows up once in the chat');
select ok((select used_at is not null from public.job_dispatches where job_id = pg_temp.id('j_b')),
  'the code is used up');

-- ── the loop brake still applies to sends made through the relay ──────────
update public.connection_brakes set hourly_limit = 2
  where workspace_id = pg_temp.id('ws') and connection = 'grok_webhook';
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
select lives_ok(
  $$ insert into ids values ('m_c', public.send_message(pg_temp.id('ws'), 'Synthetic: third note', 'michael_scott')) $$,
  'the owner queues one more message');
reset role;
insert into ids select 'j_c', job_id from public.messages where id = pg_temp.id('m_c');
set local role service_role;
select is(jsonb_array_length(public.relay_claim_grok_jobs('hosted', 5)), 1, 'the relay claims the third send');
select is(public.relay_begin_dispatch(pg_temp.id('j_c'), 'hosted', pg_temp.h('code-c'), 86400), 'braked',
  'the hourly brake trips on a relay send too');
reset role;
select is((select status::text from public.jobs where id = pg_temp.id('j_c')), 'queued',
  'a braked send waits in the queue');
select ok((select paused_at is not null from public.connection_brakes
           where workspace_id = pg_temp.id('ws') and connection = 'grok_webhook'),
  'the connection pauses');
set local role pioneer_worker;
select is((select count(*)::int from worker.claim_jobs('mac-1', array['grok.dispatch'], 5)), 0,
  'nothing is claimed while the brake is on');
reset role;

select * from finish();
rollback;
