-- M5: routines (idempotent occurrences), diagnostics, issues, invoices, report views.
-- (FR-RTN-1/2, FR-DIA-1, FR-ISS-1, FR-INV-1, FR-RPT-1)
begin;
\ir helpers/fixtures.psql
select plan(40);

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
create function pg_temp.id(n text) returns uuid language sql stable as $$
  select id from ids where name = n $$;
grant execute on function pg_temp.id(text) to authenticated;
-- Routine dates are workspace-local (fixture workspaces use America/New_York).
create function pg_temp.today() returns date language sql stable as $$
  select (now() at time zone 'America/New_York')::date $$;
grant execute on function pg_temp.today() to authenticated;

insert into public.clients (id, workspace_id, name) values
  ('c5000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Ops Client'),
  ('c5000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Other Client');

-- ── occurrence math ────────────────────────────────────────────────────────
select is(private.routine_occurrence('2026-01-31', 'monthly', 1, 1), date '2026-02-28', 'Jan 31 + 1 month = Feb 28');
select is(private.routine_occurrence('2026-01-31', 'monthly', 1, 2), date '2026-03-31', 'month-end anchors stay at month end');
select is(private.routine_occurrence('2026-01-15', 'quarterly', 1, 1), date '2026-04-15', 'quarterly = 3 months');
select is(private.routine_occurrence('2026-01-05', 'weekly', 2, 3), date '2026-02-16', 'every 2 weeks');
select is(private.routine_occurrence('2028-02-29', 'yearly', 1, 1), date '2029-02-28', 'leap-day yearly anchors clamp');

-- ── routines ───────────────────────────────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a3'); -- member
select lives_ok(
  $$ with x as (insert into public.routines (workspace_id, client_id, name, cadence, anchor_on, owner_user_id, runbook_url)
       values ('a0000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001',
               'Weekly backup check', 'weekly', pg_temp.today() - 21, 'b0000000-0000-4000-8000-0000000000a3',
               'https://docs.google.com/document/d/runbook') returning id)
     insert into ids select 'weekly', id from x $$,
  'member can create a client routine'
);
select throws_ok(
  $$ insert into public.routines (workspace_id, project_id, name, cadence, anchor_on)
     values ('a0000000-0000-4000-8000-000000000001', gen_random_uuid(), 'X', 'daily', pg_temp.today()) $$,
  '23514', null, 'a project routine needs its client'
);
select throws_ok(
  $$ insert into public.routines (workspace_id, name, cadence, anchor_on, owner_user_id)
     values ('a0000000-0000-4000-8000-000000000001', 'X', 'daily', pg_temp.today(), 'b0000000-0000-4000-8000-0000000000b1') $$,
  '23503', null, 'routine owner must be a member'
);
select throws_ok(
  $$ insert into public.routines (workspace_id, name, cadence, anchor_on, runbook_url)
     values ('a0000000-0000-4000-8000-000000000001', 'X', 'daily', pg_temp.today(), 'http://insecure.example') $$,
  '23514', null, 'runbook links must be https'
);
reset role;
-- Pretend the routine was created when anchored (enables backfill of past weeks).
update public.routines set created_at = now() - interval '21 days' where id = pg_temp.id('weekly');

select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a3');
select is(public.generate_routine_runs('a0000000-0000-4000-8000-000000000001'), 4,
  'generation creates one run per occurrence up to today (4 weekly runs)');
select is(public.generate_routine_runs('a0000000-0000-4000-8000-000000000001'), 0,
  'generation is idempotent (second call creates nothing)');
select results_eq(
  $$ select count(*)::int, min(scheduled_for), max(scheduled_for) from public.routine_runs
     where routine_id = pg_temp.id('weekly') $$,
  $$ values (4, pg_temp.today() - 21, pg_temp.today()) $$,
  'runs cover anchor … today'
);
select is(
  (select next_due_on from public.routines where id = pg_temp.id('weekly')),
  pg_temp.today() - 21, 'next_due_on is the oldest pending run'
);
select throws_ok(
  $$ insert into public.routine_runs (workspace_id, routine_id, scheduled_for)
     values ('a0000000-0000-4000-8000-000000000001', pg_temp.id('weekly'), pg_temp.today()) $$,
  '42501', null, 'runs are only created by the generator'
);
select lives_ok(
  $$ update public.routine_runs set status = 'done', notes = 'All green'
     where routine_id = pg_temp.id('weekly') and scheduled_for = pg_temp.today() - 21 $$,
  'member marks a run done'
);
select results_eq(
  $$ select completed_by, completed_at is not null from public.routine_runs
     where routine_id = pg_temp.id('weekly') and scheduled_for = pg_temp.today() - 21 $$,
  $$ values ('b0000000-0000-4000-8000-0000000000a3'::uuid, true) $$,
  'completion is stamped with who and when'
);
select is(
  (select next_due_on from public.routines where id = pg_temp.id('weekly')),
  pg_temp.today() - 14, 'next_due_on advances when a run is closed'
);
update public.routine_runs set status = 'skipped', notes = 'Holiday'
  where routine_id = pg_temp.id('weekly') and scheduled_for = pg_temp.today() - 14;
select results_eq(
  $$ select due_runs::int, done_runs::int, skipped_runs::int, missed_runs::int, compliance_percent
     from public.routine_compliance where routine_id = pg_temp.id('weekly') $$,
  $$ values (4, 1, 1, 1, 25) $$,
  'routine_compliance counts done, skipped and missed runs'
);
reset role;

-- A new routine with an old anchor does not flood history.
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a3');
with x as (
  insert into public.routines (workspace_id, name, cadence, anchor_on)
  values ('a0000000-0000-4000-8000-000000000001', 'Daily inbox sweep', 'daily', pg_temp.today() - 365)
  returning id)
insert into ids select 'daily', id from x;
select public.generate_routine_runs('a0000000-0000-4000-8000-000000000001');
select results_eq(
  $$ select count(*)::int from public.routine_runs where routine_id = pg_temp.id('daily') $$,
  $$ values (1) $$, 'an old anchor starts from the creation date (only today)'
);
reset role;

select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a4'); -- viewer
select is(public.generate_routine_runs('a0000000-0000-4000-8000-000000000001', pg_temp.today() + 7), 0,
  'viewers cannot create runs');
select is_empty(
  $$ update public.routine_runs set status = 'done' returning 1 $$, 'viewers cannot close runs'
);
reset role;

-- ── diagnostics and issues ─────────────────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a3');
select lives_ok(
  $$ with x as (insert into public.diagnostics (workspace_id, client_id, diagnostic_type, performed_on, performed_by, summary, score, report_url)
       values ('a0000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 'Website audit',
               current_date, 'b0000000-0000-4000-8000-0000000000a3', 'Synthetic summary', 72.5,
               'https://docs.google.com/document/d/report') returning id)
     insert into ids select 'diag', id from x $$,
  'member records a diagnostic'
);
select throws_ok(
  $$ insert into public.diagnostics (workspace_id, client_id, diagnostic_type, performed_on, summary, score)
     values ('a0000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 'X', current_date, 'S', 101) $$,
  '23514', null, 'scores are 0–100'
);
select lives_ok(
  $$ with x as (insert into public.issues (workspace_id, client_id, diagnostic_id, title, severity)
       values ('a0000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', pg_temp.id('diag'),
               'Slow checkout page', 'high') returning id)
     insert into ids select 'issue', id from x $$,
  'member opens an issue from a diagnostic'
);
select throws_ok(
  $$ insert into public.issues (workspace_id, client_id, diagnostic_id, title)
     values ('a0000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000002', pg_temp.id('diag'), 'Wrong client') $$,
  '23503', null, 'an issue''s diagnostic must belong to the same client'
);
select throws_ok(
  $$ update public.issues set status = 'resolved' where id = pg_temp.id('issue') $$,
  '23514', null, 'resolving needs a resolution'
);
select lives_ok(
  $$ update public.issues set status = 'resolved', resolution = 'Cached images' where id = pg_temp.id('issue') $$,
  'issue resolved with a resolution'
);
select isnt((select resolved_at from public.issues where id = pg_temp.id('issue')), null, 'resolved_at is stamped');
select lives_ok(
  $$ update public.issues set status = 'open' where id = pg_temp.id('issue') $$, 'issue can be reopened'
);
select is((select resolved_at from public.issues where id = pg_temp.id('issue')), null, 'reopening clears resolved_at');
select results_eq(
  $$ select severity::text, open_count::int from public.open_issues_by_severity
     where workspace_id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values ('high', 1) $$, 'open issues are counted by severity'
);
select throws_ok(
  $$ delete from public.issues where id = pg_temp.id('issue') $$, '42501', null, 'issues cannot be deleted'
);

-- ── invoices (metadata only) ───────────────────────────────────────────────
select lives_ok(
  $$ insert into public.invoices (workspace_id, client_id, external_system, external_number, external_url, issued_on, due_on, amount_minor)
     values ('a0000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 'quickbooks', 'INV-1001',
             'https://app.example/invoices/1001', current_date - 45, current_date - 15, 250000),
            ('a0000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 'stripe', 'INV-1001',
             null, current_date, current_date + 30, 100000) $$,
  'member records invoices (same number allowed across systems)'
);
select throws_ok(
  $$ insert into public.invoices (workspace_id, client_id, external_system, external_number, issued_on, amount_minor)
     values ('a0000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 'quickbooks', 'INV-1001', current_date, 1) $$,
  '23505', null, 'external numbers are unique per system'
);
select throws_ok(
  $$ insert into public.invoices (workspace_id, client_id, external_system, external_number, issued_on, due_on, amount_minor)
     values ('a0000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 'wave', 'W-1', current_date, current_date - 1, 1) $$,
  '23514', null, 'due date cannot precede issue date'
);
select throws_ok(
  $$ update public.invoices set status = 'paid' where external_number = 'INV-1001' and external_system = 'stripe' $$,
  '23514', null, 'paid invoices need a paid date'
);
select results_eq(
  $$ select status::text, invoice_count::int, amount_minor::bigint from public.receivables_by_status
     where workspace_id = 'a0000000-0000-4000-8000-000000000001' order by status::text $$,
  $$ values ('overdue', 1, 250000::bigint), ('sent', 1, 100000::bigint) $$,
  'receivables report flags sent invoices past due as overdue'
);
reset role;

select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a4');
select throws_ok(
  $$ insert into public.invoices (workspace_id, client_id, external_system, external_number, issued_on, amount_minor)
     values ('a0000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 'other', 'V-1', current_date, 1) $$,
  '42501', null, 'viewers cannot record invoices'
);
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b1');
select is_empty(
  $$ select 1 from public.receivables_by_status where workspace_id = 'a0000000-0000-4000-8000-000000000001'
     union all select 1 from public.routine_compliance where workspace_id = 'a0000000-0000-4000-8000-000000000001' $$,
  'report views apply RLS for outsiders'
);
reset role;

select isnt_empty(
  $$ select 1 from public.audit_events where action = 'routine_run.updated' and changes -> 'status' = '["pending", "done"]'::jsonb $$,
  'closing a routine run is audited'
);

select * from finish();
rollback;
