-- Viewer is read-only; a workspace always keeps one active owner. (FR-WS-2)
begin;
\ir helpers/fixtures.psql
select plan(10);

-- ── viewer ─────────────────────────────────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a4');
select isnt_empty($$ select 1 from public.workspaces $$, 'viewer can read the workspace');
select isnt_empty($$ select 1 from public.workspace_members $$, 'viewer can read the roster');
select is_empty(
  $$ update public.workspaces set name = 'Viewer Rename' returning 1 $$,
  'viewer cannot update the workspace'
);
select is_empty(
  $$ update public.workspace_members set role = 'admin' returning 1 $$,
  'viewer cannot update memberships'
);
select is_empty($$ select 1 from public.audit_events $$, 'viewer cannot read the audit log');
reset role;

-- ── last owner protection ──────────────────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
select throws_ok(
  $$ update public.workspace_members set role = 'admin'
     where user_id = 'b0000000-0000-4000-8000-0000000000a1' $$,
  '23514', 'A workspace must keep at least one active owner',
  'the last owner cannot demote themselves'
);
select throws_ok(
  $$ update public.workspace_members set status = 'suspended'
     where user_id = 'b0000000-0000-4000-8000-0000000000a1' $$,
  '23514', 'A workspace must keep at least one active owner',
  'the last owner cannot be suspended'
);
select throws_ok(
  $$ delete from public.workspace_members where user_id = 'b0000000-0000-4000-8000-0000000000a1' $$,
  '23514', 'A workspace must keep at least one active owner',
  'the last owner cannot be removed'
);

-- With a second owner, the first can step down.
select lives_ok(
  $$ update public.workspace_members set role = 'owner'
     where user_id = 'b0000000-0000-4000-8000-0000000000a2' $$,
  'owner can promote an admin to owner'
);
select lives_ok(
  $$ update public.workspace_members set role = 'admin'
     where user_id = 'b0000000-0000-4000-8000-0000000000a1' $$,
  'an owner can step down when another active owner exists'
);
reset role;

select * from finish();
rollback;
