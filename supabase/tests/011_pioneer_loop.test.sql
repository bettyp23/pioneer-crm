-- M8: Pioneer loop — chat, at-most-once sends, one-time codes, sheet replies, routing to
-- Michael Scott, deadlines and the loop brake. (D-29, D-30, D-33…D-35)
begin;
\ir helpers/fixtures.psql
select plan(76);

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated, pioneer_worker;
create function pg_temp.id(n text) returns uuid language sql stable as $$
  select id from ids where name = n $$;
grant execute on function pg_temp.id(text) to authenticated, pioneer_worker;
create function pg_temp.h(t text) returns text language sql immutable as $$
  select encode(extensions.digest(t, 'sha256'), 'hex') $$;
grant execute on function pg_temp.h(text) to authenticated, pioneer_worker;
grant pioneer_worker to postgres;
grant usage on schema extensions to pioneer_worker;
-- The worker API is global; start from an empty queue (the local seed adds demo jobs).
delete from public.job_attempts;
delete from public.jobs where workspace_id <> 'a0000000-0000-4000-8000-000000000001';
insert into ids values ('ws', 'a0000000-0000-4000-8000-000000000001');
insert into ids select key, id from public.agents where workspace_id = 'a0000000-0000-4000-8000-000000000001';

-- ── roster ─────────────────────────────────────────────────────────────────
select results_eq(
  $$ select key, name, kind, provider::text, integration_state from public.agents
     where workspace_id = pg_temp.id('ws') order by key $$,
  $$ values ('michael_scott', 'Michael Scott (Grok)', 'grok_team', 'xai', 'not_connected'),
            ('pioneer', 'Pioneer (Claude)', 'claude_task', 'anthropic', 'not_connected') $$,
  'new workspaces get Pioneer (Claude) and Michael Scott (Grok), not yet verified'
);

-- ── sending ────────────────────────────────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a3');
select throws_ok($$ select public.send_message(pg_temp.id('ws'), 'Hello', 'auto') $$,
  '42501', 'Only owners and admins can write to Pioneer', 'members cannot write to Pioneer');
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a4');
select throws_ok($$ select public.send_message(pg_temp.id('ws'), 'Hello', 'auto') $$,
  '42501', null, 'viewers cannot write to Pioneer');
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1', 'aal1');
select throws_ok($$ select public.send_message(pg_temp.id('ws'), 'Hello', 'auto') $$,
  '42501', null, 'writing to Pioneer needs MFA');
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b1');
select throws_ok($$ select public.send_message(pg_temp.id('ws'), 'Hello', 'auto') $$,
  '42501', null, 'outsiders cannot write to Pioneer');
reset role;

select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
select throws_ok($$ select public.send_message(pg_temp.id('ws'), 'Hello', 'everyone') $$,
  '23514', 'Unknown recipient', 'the recipient must be auto, claude or michael_scott');
select throws_ok($$ select public.send_message(pg_temp.id('ws'), '   ', 'auto') $$,
  '23514', null, 'empty messages are refused');
select lives_ok(
  $$ insert into ids values ('m_auto', public.send_message(pg_temp.id('ws'), 'Synthetic: what is open for Test Client?', 'auto')) $$,
  'the owner writes to Pioneer'
);
select lives_ok(
  $$ insert into ids values ('m_claude', public.send_message(pg_temp.id('ws'), 'Synthetic: summarise this week', 'claude')) $$,
  'the owner writes to Claude directly'
);
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a2');
select lives_ok(
  $$ insert into ids values ('m_ms', public.send_message(pg_temp.id('ws'), 'Synthetic: draft a follow-up for test client', 'michael_scott', true)) $$,
  'an admin writes to Michael Scott directly, flagged after a warning'
);
reset role;

insert into ids select 'j_auto', job_id from public.messages where id = pg_temp.id('m_auto');
insert into ids select 'j_claude', job_id from public.messages where id = pg_temp.id('m_claude');
insert into ids select 'j_ms', job_id from public.messages where id = pg_temp.id('m_ms');
select results_eq(
  $$ select j.kind, a.key, j.at_most_once, j.max_attempts, j.payload ->> 'mode', j.status::text
     from public.jobs j join public.agents a on a.id = j.agent_id
     where j.id in (pg_temp.id('j_auto'), pg_temp.id('j_claude'), pg_temp.id('j_ms')) order by j.kind, j.payload ->> 'mode' $$,
  $$ values ('claude.task', 'pioneer', true, 1, 'answer', 'queued'),
            ('claude.task', 'pioneer', true, 1, 'auto', 'queued'),
            ('grok.dispatch', 'michael_scott', true, 1, null, 'queued') $$,
  'each message queues one at-most-once send to the right agent'
);
select is(
  (select payload ->> 'task' from public.jobs where id = pg_temp.id('j_ms')),
  'Synthetic: draft a follow-up for test client', 'a message to Michael Scott carries the task text'
);
select results_eq(
  $$ select author, recipient, flagged from public.messages where id = pg_temp.id('m_ms') $$,
  $$ values ('owner', 'michael_scott', true) $$, 'the message records author, recipient and the warning'
);
select is(
  (select count(*)::int from public.audit_events where workspace_id = pg_temp.id('ws') and action = 'message.sent'),
  3, 'each message is audited (length only, not the text)'
);
select ok(
  not exists (select 1 from public.audit_events where workspace_id = pg_temp.id('ws') and action = 'message.sent'
              and changes::text like '%Synthetic%'),
  'the audit log does not copy message text'
);

-- ── messages are read-only, workspace-scoped ───────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a4');
select is((select count(*)::int from public.messages where workspace_id = pg_temp.id('ws')), 3, 'viewers read the chat');
select throws_ok(
  $$ insert into public.messages (workspace_id, author, kind, body) values (pg_temp.id('ws'), 'pioneer', 'answer', 'fake') $$,
  '42501', null, 'nobody inserts messages directly'
);
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
select throws_ok($$ update public.messages set body = 'changed' where id = pg_temp.id('m_auto') $$,
  '42501', null, 'messages cannot be edited');
select throws_ok($$ delete from public.messages where id = pg_temp.id('m_auto') $$,
  '42501', null, 'messages cannot be deleted');
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b1');
select is((select count(*)::int from public.messages where workspace_id = pg_temp.id('ws')), 0, 'outsiders see no messages');
reset role;

-- ── privileges ─────────────────────────────────────────────────────────────
select ok(not has_function_privilege('authenticated', 'worker.accept_result(text, uuid, text, text, text, text, text)', 'execute'),
  'app users cannot post replies');
select ok(not has_function_privilege('authenticated', 'worker.begin_dispatch(uuid, text, text, int)', 'execute'),
  'app users cannot start sends');
select ok(not has_column_privilege('authenticated', 'public.job_dispatches', 'code_sha256', 'select'),
  'the code hash is not readable through the API');
select ok(not has_table_privilege('pioneer_worker', 'public.messages', 'select'), 'the worker role cannot read messages');
select ok(not has_function_privilege('pioneer_worker', 'public.send_message(uuid, text, text, boolean)', 'execute'),
  'the worker cannot write as the owner');

-- ── sending through the worker ─────────────────────────────────────────────
set local role pioneer_worker;
select is(
  (select count(*)::int from worker.claim_jobs('mac-1', array['claude.task', 'grok.dispatch'], 10)), 3,
  'the worker claims the three sends'
);
select is(worker.begin_dispatch(pg_temp.id('j_auto'), 'mac-2', pg_temp.h('code-auto'), 1800), 'not_held',
  'only the holder can send');
select is(worker.begin_dispatch(pg_temp.id('j_auto'), 'mac-1', pg_temp.h('code-auto'), 1800), 'ok', 'the holder may send');
select is(worker.begin_dispatch(pg_temp.id('j_auto'), 'mac-1', pg_temp.h('code-auto'), 1800), 'already_sent',
  'a second send of the same attempt is refused');
select ok(worker.mark_waiting(pg_temp.id('j_auto'), 'mac-1', 'session_synthetic'), 'the sent job waits for its reply');
select is(worker.begin_dispatch(pg_temp.id('j_claude'), 'mac-1', pg_temp.h('code-claude'), 1800), 'ok', 'second send');
select ok(worker.mark_waiting(pg_temp.id('j_claude'), 'mac-1'), 'second job waits');
select is(worker.begin_dispatch(pg_temp.id('j_ms'), 'mac-1', pg_temp.h('code-ms'), 86400), 'ok', 'third send');
select ok(worker.mark_waiting(pg_temp.id('j_ms'), 'mac-1'), 'third job waits');
reset role;
select results_eq(
  $$ select status::text, locked_by, external_ref, waiting_until is not null from public.jobs where id = pg_temp.id('j_auto') $$,
  $$ values ('waiting_external', null::text, 'session_synthetic', true) $$, 'waiting jobs hold no lease'
);
select is((select outcome from public.job_attempts where job_id = pg_temp.id('j_auto')), 'dispatched',
  'the attempt is recorded as dispatched');
select results_eq(
  $$ select connection, expected_from from public.job_dispatches where job_id in (pg_temp.id('j_auto'), pg_temp.id('j_ms')) order by connection $$,
  $$ values ('claude_task', 'pioneer_brain'), ('grok_webhook', 'michael_scott') $$,
  'each send expects its reply from the right sender'
);

-- ── replies from the sheet ─────────────────────────────────────────────────
set local role pioneer_worker;
select is(worker.accept_result(pg_temp.h('row-1'), gen_random_uuid(), 'x', 'pioneer_brain', 'answer', null, 'hi'),
  'ignored: unknown job', 'a row for an unknown job is ignored');
select is(worker.accept_result(pg_temp.h('row-2'), pg_temp.id('j_auto'), 'wrong', 'pioneer_brain', 'answer', null, 'hi'),
  'ignored: wrong code', 'a row with the wrong code is ignored');
select is(worker.accept_result(pg_temp.h('row-3'), pg_temp.id('j_auto'), 'code-auto', 'michael_scott', 'result', null, 'hi'),
  'ignored: wrong sender', 'a row from the wrong sender is ignored');
select is(worker.accept_result(pg_temp.h('row-4'), pg_temp.id('j_auto'), 'code-auto', 'pioneer_brain', 'result', null, 'hi'),
  'ignored: unknown kind', 'Pioneer can only answer or route');
select is(worker.accept_result(pg_temp.h('row-2'), pg_temp.id('j_auto'), 'code-auto', 'pioneer_brain', 'answer', null, 'hi'),
  'duplicate', 'a row is processed only once');
select is(worker.accept_result(pg_temp.h('row-5'), pg_temp.id('j_auto'), 'code-auto', 'pioneer_brain', 'route', 'Test Client',
  'Draft a follow-up for Test Client. Key sk-abcdefgh12345678 must not leak.'), 'accepted', 'the right reply is accepted');
select is(worker.accept_result(pg_temp.h('row-6'), pg_temp.id('j_auto'), 'code-auto', 'pioneer_brain', 'answer', null, 'again'),
  'ignored: job is not waiting for a reply', 'a second reply to a finished job is ignored');
select is(worker.filter_new_rows(array[pg_temp.h('row-5'), pg_temp.h('row-7')]), array[pg_temp.h('row-7')],
  'the worker learns which rows are new');
reset role;

select results_eq(
  $$ select status::text, result ->> 'kind' from public.jobs where id = pg_temp.id('j_auto') $$,
  $$ values ('succeeded', 'route') $$, 'the reply completes the job'
);
select results_eq(
  $$ select author, kind from public.messages where job_id = pg_temp.id('j_auto') and author <> 'owner' $$,
  $$ values ('pioneer', 'routed') $$, 'the reply appears in the chat as routed'
);
select ok(
  (select body from public.messages where job_id = pg_temp.id('j_auto') and author = 'pioneer') like '%[redacted]%'
  and (select body from public.messages where job_id = pg_temp.id('j_auto') and author = 'pioneer') not like '%sk-abcdefgh%',
  'key-like text in replies is redacted'
);
select ok((select used_at is not null from public.job_dispatches where job_id = pg_temp.id('j_auto')), 'the code is used up');
select results_eq(
  $$ select integration_state, last_verified_at is not null from public.agents where id = pg_temp.id('pioneer') $$,
  $$ values ('verified', true) $$, 'a real round trip marks the connection verified'
);
select results_eq(
  $$ select j.kind, a.key, j.at_most_once, j.payload ->> 'client', j.payload ->> 'parent_job_id' = pg_temp.id('j_auto')::text
     from public.jobs j join public.agents a on a.id = j.agent_id where j.idempotency_key = 'route:' || pg_temp.id('j_auto') $$,
  $$ values ('grok.dispatch', 'michael_scott', true, 'Test Client', true) $$,
  'routing queues one send to Michael Scott'
);
select is(
  (select count(*)::int from public.result_rows where outcome = 'ignored' and workspace_id = pg_temp.id('ws')), 4,
  'ignored rows for known jobs are recorded with their reason'
);

-- "answer only" mode never routes.
set local role pioneer_worker;
select is(worker.accept_result(pg_temp.h('row-8'), pg_temp.id('j_claude'), 'code-claude', 'pioneer_brain', 'route', null,
  'Synthetic summary'), 'accepted', 'a route reply in answer-only mode is accepted');
reset role;
select results_eq(
  $$ select (select kind from public.messages where job_id = pg_temp.id('j_claude') and author = 'pioneer'),
            (select count(*)::int from public.jobs where idempotency_key = 'route:' || pg_temp.id('j_claude')) $$,
  $$ values ('answer', 0) $$, 'answer-only mode shows it as an answer and sends nothing on'
);

-- ── deadlines and manual retry ─────────────────────────────────────────────
update public.jobs set waiting_until = now() - interval '1 minute' where id = pg_temp.id('j_ms');
update public.job_dispatches set expires_at = now() - interval '1 minute', dispatched_at = now() - interval '2 minutes'
where job_id = pg_temp.id('j_ms');
set local role pioneer_worker;
select is(worker.expire_waiting(), 1, 'a send without a reply before the deadline expires');
select is(worker.accept_result(pg_temp.h('row-9'), pg_temp.id('j_ms'), 'code-ms', 'michael_scott', 'result', null, 'late'),
  'ignored: job is not waiting for a reply', 'a late reply is ignored');
reset role;
select results_eq(
  $$ select status::text, last_error from public.jobs where id = pg_temp.id('j_ms') $$,
  $$ values ('failed', 'No reply in the Pioneer Results sheet before the deadline') $$, 'the job fails with a clear reason'
);
select isnt_empty(
  $$ select 1 from public.messages where job_id = pg_temp.id('j_ms') and author = 'system' and kind = 'notice' $$,
  'the chat says no reply came'
);
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
select lives_ok($$ select public.retry_job(pg_temp.id('j_ms')) $$, 'the owner retries the send');
reset role;
select results_eq(
  $$ select status::text, attempts, max_attempts from public.jobs where id = pg_temp.id('j_ms') $$,
  $$ values ('queued', 1, 2) $$, 'a manual retry allows exactly one more send'
);

-- ── loop brake ─────────────────────────────────────────────────────────────
update public.connection_brakes set hourly_limit = 2 where workspace_id = pg_temp.id('ws') and connection = 'grok_webhook';
insert into ids select 'j_route', id from public.jobs where idempotency_key = 'route:' || pg_temp.id('j_auto');
set local role pioneer_worker;
select is(
  (select count(*)::int from worker.claim_jobs('mac-1', array['grok.dispatch'], 10)), 2,
  'the worker claims the retried send and the routed send'
);
select is(worker.begin_dispatch(pg_temp.id('j_ms'), 'mac-1', pg_temp.h('code-ms-2'), 1800), 'ok',
  'the second send in the hour is still within the limit of two');
select is(worker.begin_dispatch(pg_temp.id('j_route'), 'mac-1', pg_temp.h('code-route'), 1800), 'braked',
  'the third send in the hour trips the brake');
reset role;
select results_eq(
  $$ select status::text, max_attempts from public.jobs where id = pg_temp.id('j_route') $$,
  $$ values ('queued', 2) $$, 'the held-back send waits in the queue without losing its one try'
);
select ok(
  (select paused_at is not null from public.connection_brakes where workspace_id = pg_temp.id('ws') and connection = 'grok_webhook'),
  'the connection pauses'
);
select isnt_empty(
  $$ select 1 from public.messages where workspace_id = pg_temp.id('ws') and author = 'system' and body like 'Michael Scott (Grok) is paused%' $$,
  'the chat says the connection paused'
);
set local role pioneer_worker;
select is((select count(*)::int from worker.claim_jobs('mac-1', array['grok.dispatch'], 10)), 0,
  'nothing is claimed while the brake is on');
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a2');
select throws_ok($$ select public.resume_connection(pg_temp.id('ws'), 'grok_webhook') $$,
  '42501', 'Only the owner can resume a connection', 'admins cannot resume a braked connection');
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
select lives_ok($$ select public.resume_connection(pg_temp.id('ws'), 'grok_webhook') $$, 'the owner resumes it');
reset role;
set local role pioneer_worker;
select is((select count(*)::int from worker.claim_jobs('mac-1', array['grok.dispatch'], 10)), 1,
  'after resuming, the held-back send is claimed again');
reset role;

-- ── kill switch and at-most-once failures ──────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
select lives_ok($$ insert into ids values ('m_pause', public.send_message(pg_temp.id('ws'), 'Synthetic: paused', 'claude')) $$,
  'a message can be written while agents are about to be paused');
select lives_ok($$ select public.set_ai_paused(pg_temp.id('ws'), true, 'Synthetic test') $$, 'the owner pauses all agents');
reset role;
set local role pioneer_worker;
select is((select count(*)::int from worker.claim_jobs('mac-1', array['claude.task'], 10)), 0,
  'nothing is sent while all agents are paused');
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
select lives_ok($$ select public.set_ai_paused(pg_temp.id('ws'), false) $$, 'the owner resumes all agents');
reset role;
insert into ids select 'j_pause', job_id from public.messages where id = pg_temp.id('m_pause');
set local role pioneer_worker;
select is((select count(*)::int from worker.claim_jobs('mac-1', array['claude.task'], 10)), 1, 'after resuming it is claimed');
select is(
  worker.fail_job(pg_temp.id('j_pause'), 'mac-1', 'HTTP 503', true),
  'failed'::public.job_status, 'a failed send is never retried automatically, even when retryable'
);
reset role;

select * from finish();
rollback;
