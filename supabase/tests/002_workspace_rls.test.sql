-- RLS on workspaces, profiles and workspace_members per role and MFA level.
-- (FR-AUTH-2, FR-WS-1, FR-WS-3, docs/security.md §3)
begin;
\ir helpers/fixtures.psql
select plan(24);

-- ── aal1 (password only): sees nothing ─────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1', 'aal1');
select is_empty($$ select 1 from public.workspaces $$, 'aal1 owner sees no workspaces');
select is_empty($$ select 1 from public.workspace_members $$, 'aal1 owner sees no memberships');
select is_empty($$ select 1 from public.profiles $$, 'aal1 owner sees no profiles, not even their own');
select is_empty(
  $$ update public.workspaces set name = 'Renamed' returning 1 $$,
  'aal1 owner cannot update the workspace'
);
reset role;

-- ── owner (aal2) ───────────────────────────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
select results_eq(
  $$ select id from public.workspaces $$,
  $$ values ('a0000000-0000-4000-8000-000000000001'::uuid) $$,
  'owner sees only their own workspace'
);
select results_eq(
  $$ select count(*)::int from public.workspace_members $$, $$ values (5) $$,
  'owner sees the full roster of their workspace only'
);
select results_eq(
  $$ select count(*)::int from public.profiles $$, $$ values (5) $$,
  'owner sees profiles of co-members only (not the outsider)'
);
select isnt_empty(
  $$ update public.workspaces set name = 'Renamed Workspace' returning 1 $$,
  'owner can rename the workspace'
);
select throws_ok(
  $$ update public.workspaces set slug = 'new-slug' $$, '42501', null,
  'owner cannot change the slug (no column grant)'
);
select throws_ok(
  $$ update public.workspaces set timezone = 'Mars/Olympus' $$, '23514', null,
  'invalid timezone is rejected'
);
select is_empty(
  $$ update public.workspaces set name = 'Hijack' where id = 'a0000000-0000-4000-8000-000000000002' returning 1 $$,
  'owner cannot update another workspace'
);
select throws_ok(
  $$ insert into public.workspaces (name, slug) values ('Another', 'another') $$, '42501', null,
  'authenticated users cannot create workspaces'
);
select lives_ok(
  $$ update public.workspace_members set role = 'member'
     where user_id = 'b0000000-0000-4000-8000-0000000000a4' $$,
  'owner can change a member role'
);
select throws_ok(
  $$ insert into public.workspace_members (workspace_id, user_id, role)
     values ('a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-0000000000a1', 'owner') $$,
  '42501', null,
  'owner cannot add themselves to another workspace'
);
select is_empty(
  $$ update public.profiles set display_name = 'Hacked'
     where user_id = 'b0000000-0000-4000-8000-0000000000a2' returning 1 $$,
  'users cannot edit other people''s profiles'
);
reset role;

-- ── admin ──────────────────────────────────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a2');
select is_empty(
  $$ update public.workspaces set name = 'Admin Rename' returning 1 $$,
  'admin cannot edit workspace settings (owner only)'
);
select throws_ok(
  $$ insert into public.workspace_members (workspace_id, user_id, role)
     values ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000b1', 'viewer') $$,
  '42501', null,
  'admin cannot add members (owner only)'
);
select is_empty(
  $$ delete from public.workspace_members where user_id = 'b0000000-0000-4000-8000-0000000000a3' returning 1 $$,
  'admin cannot remove members'
);
select isnt_empty(
  $$ update public.profiles set display_name = 'Admin Renamed' returning 1 $$,
  'users can edit their own profile'
);
reset role;

-- ── viewer ─────────────────────────────────────────────────────────────────
-- (v1 was demoted to member above; use m1's read checks and a fresh viewer check via suspended user)
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a3');
select isnt_empty($$ select 1 from public.workspaces $$, 'member can read their workspace');
select is_empty(
  $$ update public.workspace_members set role = 'owner'
     where user_id = 'b0000000-0000-4000-8000-0000000000a3' returning 1 $$,
  'member cannot promote themselves'
);
reset role;

-- ── suspended member: treated as non-member ────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a5');
select is_empty($$ select 1 from public.workspaces $$, 'suspended member sees no workspace');
reset role;

-- ── outsider (owner of ws2) ────────────────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b1');
select results_eq(
  $$ select id from public.workspaces $$,
  $$ values ('a0000000-0000-4000-8000-000000000002'::uuid) $$,
  'non-member sees no rows of ws1'
);
select is_empty(
  $$ select 1 from public.workspace_members where workspace_id = 'a0000000-0000-4000-8000-000000000001' $$,
  'non-member sees no ws1 memberships'
);
reset role;

select * from finish();
rollback;
