-- M7: kill switch, Pioneer OS 3.0 roster and providers, durable job queue + worker API.
-- (D-24…D-27)
begin;
\ir helpers/fixtures.psql
select plan(52);

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated, pioneer_worker;
create function pg_temp.id(n text) returns uuid language sql stable as $$
  select id from ids where name = n $$;
grant execute on function pg_temp.id(text) to authenticated, pioneer_worker;
-- The test session (postgres) needs to be able to act as the worker role.
grant pioneer_worker to postgres;
grant usage on schema extensions to pioneer_worker;
-- The worker API is global; start from an empty queue (the local seed adds demo jobs).
delete from public.job_attempts;
delete from public.jobs;

insert into ids select key, id from public.agents where workspace_id = 'a0000000-0000-4000-8000-000000000001';
insert into ids values ('ws', 'a0000000-0000-4000-8000-000000000001');

-- ── roster and providers ───────────────────────────────────────────────────
select set_eq(
  $$ select key from public.agents where workspace_id = 'a0000000-0000-4000-8000-000000000001' and is_active $$,
  $$ values ('operations'), ('sales'), ('client_onboarding'), ('development'), ('qa_security'),
            ('marketing_seo'), ('client_success'), ('finance_admin') $$,
  'new workspaces get the eight Pioneer OS 3.0 roles'
);
select throws_ok(
  $$ insert into public.agents (workspace_id, key, name, provider, allowed_work_types)
     values ('a0000000-0000-4000-8000-000000000001', 'grok_bot', 'Grok bot', 'xai', '{research}') $$,
  '23514', null, 'agents cannot use Grok (xAI)'
);
select throws_ok(
  $$ insert into public.ai_usage (workspace_id, provider, cost_microusd)
     values ('a0000000-0000-4000-8000-000000000001', 'perplexity', 1) $$,
  '23514', null, 'new ledger rows cannot use Perplexity'
);

-- ── kill switch ────────────────────────────────────────────────────────────
select ok(not private.ai_is_paused('a0000000-0000-4000-8000-000000000001'), 'agents run by default');
select ok(private.ai_is_paused('00000000-0000-4000-8000-00000000dead'), 'an unknown workspace counts as paused');

-- A ready work item to try dispatching.
insert into public.agent_work_items (workspace_id, agent_id, work_type, title, instructions, context_snapshot,
  sensitivity_flags, status, prepared_by)
values ('a0000000-0000-4000-8000-000000000001', pg_temp.id('sales'), 'research', 'Lead scan', 'Scan', 'ctx', '[]',
  'ready', 'b0000000-0000-4000-8000-0000000000a1');
insert into ids select 'w1', id from public.agent_work_items where title = 'Lead scan';

select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a2');
select throws_ok(
  $$ select public.set_ai_paused(pg_temp.id('ws'), true, 'test') $$,
  '42501', 'Only the owner can pause or resume agents', 'admins cannot use the kill switch'
);
reset role;

select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
select throws_ok(
  $$ update public.workspaces set ai_paused_at = now() where id = pg_temp.id('ws') $$,
  '42501', null, 'the pause columns are not directly writable'
);
select lives_ok(
  $$ select public.set_ai_paused(pg_temp.id('ws'), true, 'Synthetic: runaway costs') $$, 'owner pauses all agents'
);
select results_eq(
  $$ select ai_paused_by, ai_pause_reason from public.workspaces where id = pg_temp.id('ws') $$,
  $$ values ('b0000000-0000-4000-8000-0000000000a1'::uuid, 'Synthetic: runaway costs') $$,
  'the pause records who and why'
);
select throws_ok(
  $$ select public.transition_work_item(pg_temp.id('w1'), 'dispatched', 1) $$,
  '23514', 'Agents are paused. Resume them in the AI Command Center first.', 'dispatch is blocked while paused'
);
reset role;
select ok(not private.ai_budget_allows('a0000000-0000-4000-8000-000000000001', 'openrouter', 1),
  'no automated spending while paused');
select is(
  (select count(*)::int from public.audit_events
   where workspace_id = 'a0000000-0000-4000-8000-000000000001' and action = 'ai.paused'),
  1, 'pausing is audited'
);

select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
select lives_ok($$ select public.set_ai_paused(pg_temp.id('ws'), false) $$, 'owner resumes');
reset role;
select ok(not private.ai_is_paused('a0000000-0000-4000-8000-000000000001'), 'agents run again');
select ok(private.ai_budget_allows('a0000000-0000-4000-8000-000000000001', 'openrouter', 1),
  'spending is allowed again after resuming');

update public.agents set is_active = false where id = pg_temp.id('sales');
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
select throws_ok(
  $$ select public.transition_work_item(pg_temp.id('w1'), 'dispatched', 1) $$,
  '23514', 'This agent is inactive', 'an inactive agent cannot be dispatched to'
);
reset role;
update public.agents set is_active = true where id = pg_temp.id('sales');

-- ── jobs: people ───────────────────────────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a3');
select throws_ok(
  $$ select public.enqueue_job(pg_temp.id('ws'), 'report.weekly_summary', 'k1') $$,
  '42501', 'Only owners and admins can queue jobs', 'members cannot queue jobs'
);
select throws_ok(
  $$ insert into public.jobs (workspace_id, kind, idempotency_key) values (pg_temp.id('ws'), 'report.x', 'k') $$,
  '42501', null, 'jobs cannot be inserted directly'
);
reset role;

select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a2');
select lives_ok(
  $$ insert into ids select 'det', public.enqueue_job(pg_temp.id('ws'), 'report.weekly_summary', 'week-42',
       '{"week": 42}') $$,
  'admin queues a deterministic job'
);
select is(
  public.enqueue_job(pg_temp.id('ws'), 'report.weekly_summary', 'week-42', '{"week": 42}'), pg_temp.id('det'),
  'queueing the same idempotency key returns the same job'
);
select lives_ok(
  $$ insert into ids select 'ag', public.enqueue_job(pg_temp.id('ws'), 'agent.run', 'ops-daily',
       '{}', pg_temp.id('operations')) $$,
  'admin queues an agent job'
);
select throws_ok(
  $$ select public.enqueue_job(pg_temp.id('ws'), 'agent.run', 'no-agent') $$,
  '23514', null, 'agent jobs must name an agent'
);
select throws_ok(
  $$ select public.enqueue_job(pg_temp.id('ws'), 'Bad Kind', 'k') $$,
  '23514', null, 'job kinds have a fixed format'
);
select throws_ok(
  $$ select payload from public.jobs $$, '42501', null, 'payloads are not readable through the API'
);
reset role;
select is(
  (select count(*)::int from public.audit_events where action = 'job.enqueued' and entity_id = pg_temp.id('det')),
  1, 'a job is audited once even when queued twice'
);

select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a4');
select is((select count(*)::int from public.jobs where workspace_id = pg_temp.id('ws')), 2, 'viewers see job status');
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b1');
select is_empty($$ select 1 from public.jobs where workspace_id = pg_temp.id('ws') $$, 'outsiders see no jobs');
reset role;

-- ── jobs: worker API ───────────────────────────────────────────────────────
select ok(not has_function_privilege('authenticated', 'worker.claim_jobs(text, text[], int)', 'execute'),
  'app users cannot call the worker API');
select ok(not has_table_privilege('pioneer_worker', 'public.jobs', 'select'), 'the worker role has no table access');
select ok(
  not has_function_privilege('pioneer_worker', 'public.enqueue_job(uuid, text, text, jsonb, uuid, uuid, timestamptz, int)', 'execute'),
  'the worker role cannot use the app API'
);

set local role pioneer_worker;
select results_eq(
  $$ select id, status::text, attempts from worker.claim_jobs('w-1', array['report.weekly_summary']) $$,
  $$ values (pg_temp.id('det'), 'running', 1) $$,
  'a worker claims a queued job'
);
select is_empty($$ select * from worker.claim_jobs('w-2', array['report.weekly_summary']) $$,
  'a claimed job is not handed to another worker');
select ok(not worker.heartbeat(pg_temp.id('det'), 'w-2'), 'only the holder can extend the lease');
select ok(worker.heartbeat(pg_temp.id('det'), 'w-1'), 'the holder extends the lease');
select is(worker.fail_job(pg_temp.id('det'), 'w-1', 'HTTP 503 from provider'), 'queued'::public.job_status,
  'a retryable failure goes back to the queue');
select is_empty($$ select * from worker.claim_jobs('w-1', array['report.weekly_summary']) $$,
  'retries wait for the backoff');
reset role;

update public.jobs set run_after = now() - interval '1 second' where id = pg_temp.id('det');
set local role pioneer_worker;
select is((select attempts from worker.claim_jobs('w-1', array['report.weekly_summary'])), 2,
  'after the backoff the job is claimed again');
select is(
  worker.fail_job(pg_temp.id('det'), 'w-1', 'Bad request with key sk-or-v1-abcdefghijklmnop and Bearer abc.def', false),
  'failed'::public.job_status, 'a permanent failure stops at once'
);
reset role;
select ok(
  (select last_error !~ 'abcdefghijklmnop|abc\.def' and last_error ~ 'redacted' from public.jobs where id = pg_temp.id('det')),
  'credential-shaped text is redacted from stored errors'
);
select results_eq(
  $$ select attempt, outcome from public.job_attempts where job_id = pg_temp.id('det') order by attempt $$,
  $$ values (1, 'retry'), (2, 'failed') $$,
  'every attempt is recorded'
);

select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a2');
select lives_ok($$ select public.retry_job(pg_temp.id('det')) $$, 'admin retries a failed job');
select throws_ok($$ select public.retry_job(pg_temp.id('det')) $$, '23514',
  'Only failed, dead or cancelled jobs can be retried', 'a queued job cannot be retried');
reset role;

set local role pioneer_worker;
select is((select max_attempts from worker.claim_jobs('w-1', array['report.weekly_summary'])), 5,
  'a retried job gets three more attempts');
select ok(worker.complete_job(pg_temp.id('det'), 'w-1', '{"ok": true}'), 'the holder completes the job');
select ok(not worker.complete_job(pg_temp.id('det'), 'w-1', '{"ok": true}'), 'a job completes only once');
reset role;

-- Expired leases are reaped; the kill switch holds agent jobs but not deterministic ones.
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
select public.set_ai_paused(pg_temp.id('ws'), true, 'Synthetic pause');
select public.enqueue_job(pg_temp.id('ws'), 'report.weekly_summary', 'week-43');
reset role;
set local role pioneer_worker;
select is(
  (select array_agg(kind) from worker.claim_jobs('w-1', array['agent.run', 'report.weekly_summary'], 10)),
  array['report.weekly_summary'], 'while paused only deterministic jobs are claimed'
);
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
select public.set_ai_paused(pg_temp.id('ws'), false);
reset role;
set local role pioneer_worker;
select is((select count(*)::int from worker.claim_jobs('w-1', array['agent.run'])), 1,
  'after resuming the agent job is claimed');
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
select public.set_ai_paused(pg_temp.id('ws'), true, 'Stop now');
reset role;
set local role pioneer_worker;
select ok(not worker.heartbeat(pg_temp.id('ag'), 'w-1'), 'a running agent job is told to stop when paused');
reset role;

update public.jobs set locked_until = now() - interval '1 second' where id = pg_temp.id('ag');
set local role pioneer_worker;
select is(worker.reap_expired(), 1, 'an expired lease is reaped');
reset role;
select results_eq(
  $$ select status::text, last_error from public.jobs where id = pg_temp.id('ag') $$,
  $$ values ('queued', 'Timed out: the worker stopped reporting progress') $$,
  'a timed-out job returns to the queue with the reason'
);

select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a2');
select lives_ok($$ select public.cancel_job(pg_temp.id('ag')) $$, 'admin cancels a queued job');
select throws_ok($$ select public.cancel_job(pg_temp.id('ag')) $$, '23514',
  'Only queued or running jobs can be cancelled', 'a cancelled job cannot be cancelled again');
reset role;

select * from finish();
rollback;
