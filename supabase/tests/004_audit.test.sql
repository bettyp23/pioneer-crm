-- Audit log: written by triggers on membership/workspace changes, readable by owner/admin,
-- append-only for everyone. (FR-AUD-1, FR-AUD-2)
begin;
\ir helpers/fixtures.psql
select plan(13);

-- Fixture inserts ran as postgres (no JWT) → system actor.
select results_eq(
  $$ select actor_type::text, count(*)::int from public.audit_events
     where workspace_id = 'a0000000-0000-4000-8000-000000000001'
       and action = 'workspace_member.created'
     group by actor_type $$,
  $$ values ('system', 5) $$,
  'membership inserts are audited as system events'
);

-- Owner changes a role → one user-attributed event with old/new values.
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
update public.workspace_members set role = 'member'
  where user_id = 'b0000000-0000-4000-8000-0000000000a4';
update public.workspaces set name = 'Audited Name'
  where id = 'a0000000-0000-4000-8000-000000000001';
-- Updating only display_name of a profile is not audited (profiles are not audited in M1).
update public.profiles set display_name = 'Owner One'
  where user_id = 'b0000000-0000-4000-8000-0000000000a1';

select results_eq(
  $$ select actor_type::text, actor_user_id, entity_id, changes
     from public.audit_events where action = 'workspace_member.updated' $$,
  $$ values ('user', 'b0000000-0000-4000-8000-0000000000a1'::uuid,
             'b0000000-0000-4000-8000-0000000000a4'::uuid,
             '{"role": ["viewer", "member"]}'::jsonb) $$,
  'role change is audited with actor and before/after'
);
select results_eq(
  $$ select changes from public.audit_events where action = 'workspace.updated' $$,
  $$ values ('{"name": ["Test Workspace One", "Audited Name"]}'::jsonb) $$,
  'workspace rename is audited'
);

-- Owner reads the log for their workspace only.
select is_empty(
  $$ select 1 from public.audit_events where workspace_id <> 'a0000000-0000-4000-8000-000000000001' $$,
  'owner sees no audit events of other workspaces'
);

-- Nobody can write through the API.
select throws_ok(
  $$ insert into public.audit_events (workspace_id, actor_type, action, entity_type)
     values ('a0000000-0000-4000-8000-000000000001', 'system', 'fake.event', 'x') $$,
  '42501', null, 'owner cannot insert audit events'
);
select throws_ok(
  $$ update public.audit_events set action = 'tampered.event' $$,
  '42501', null, 'owner cannot update audit events'
);
select throws_ok(
  $$ delete from public.audit_events $$,
  '42501', null, 'owner cannot delete audit events'
);
select throws_ok(
  $$ select private.log_event('a0000000-0000-4000-8000-000000000001', 'fake.event', 'x', null) $$,
  '42501', null, 'owner cannot call private.log_event'
);
reset role;

-- Admin can read; member cannot.
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a2');
select isnt_empty($$ select 1 from public.audit_events $$, 'admin can read the audit log');
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a3');
select is_empty($$ select 1 from public.audit_events $$, 'member cannot read the audit log');
reset role;

-- Append-only even for privileged roles.
select throws_ok(
  $$ update public.audit_events set action = 'tampered.event' $$,
  '42501', 'audit_events is append-only', 'postgres cannot update audit events'
);
select throws_ok(
  $$ delete from public.audit_events $$,
  '42501', 'audit_events is append-only', 'postgres cannot delete audit events'
);
select throws_ok(
  $$ truncate public.audit_events $$,
  '42501', 'audit_events is append-only', 'postgres cannot truncate audit events'
);

select * from finish();
rollback;
