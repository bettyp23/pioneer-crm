-- Client portal (D-39): account roles, client isolation, client writes, storage scoping.
-- Client A must never see or change client B's data, through tables, functions or storage.
begin;
\ir helpers/fixtures.psql
select plan(55);

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
create function pg_temp.id(n text) returns uuid language sql stable as $$
  select id from ids where name = n $$;
grant execute on function pg_temp.id(text) to authenticated;
-- Rows changed by a statement (RLS hides rows from UPDATE/DELETE instead of raising).
create function pg_temp.affected(q text) returns int language plpgsql as $$
declare n int;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function pg_temp.affected(text) to authenticated;

-- ── fixture (postgres): clients A and B in ws1, three client accounts ──────────────
--   ca = client A, cb = client B, cu = client account not yet linked to a client
do $$
declare
  ws uuid := 'a0000000-0000-4000-8000-000000000001';
  u record;
  ca uuid; cb uuid;
begin
  for u in
    select * from (values
      ('c0000000-0000-4000-8000-0000000000a1'::uuid, 'ca@example.test'),
      ('c0000000-0000-4000-8000-0000000000b1'::uuid, 'cb@example.test'),
      ('c0000000-0000-4000-8000-0000000000c1'::uuid, 'cu@example.test')
    ) as t(id, email)
  loop
    insert into auth.users (id, email, aud, role) values (u.id, u.email, 'authenticated', 'authenticated');
  end loop;
  insert into public.clients (workspace_id, name, notes) values (ws, 'Client A', 'Internal note A') returning id into ca;
  insert into public.clients (workspace_id, name, notes) values (ws, 'Client B', 'Internal note B') returning id into cb;
  insert into ids values ('A', ca), ('B', cb),
    ('ua', 'c0000000-0000-4000-8000-0000000000a1'),
    ('ub', 'c0000000-0000-4000-8000-0000000000b1'),
    ('uu', 'c0000000-0000-4000-8000-0000000000c1');
  -- cu has a client profile with no client yet.
  insert into public.profiles (user_id, display_name) values ('c0000000-0000-4000-8000-0000000000c1', 'cu');
end;
$$;

-- ── Roles and invitations ───────────────────────────────────────────────────────
select is(
  (select role::text from public.profiles where user_id = 'c0000000-0000-4000-8000-0000000000c1'),
  'client', 'new profiles are client accounts by default (never admin)'
);

select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a3'); -- member
select throws_ok(
  $$ select public.attach_portal_user(pg_temp.id('ua'), pg_temp.id('A'), 'Client A user') $$,
  '42501', null, 'only the owner can give a client portal access'
);

reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1'); -- owner
select lives_ok(
  $$ select public.attach_portal_user(pg_temp.id('ua'), pg_temp.id('A'), 'Client A user', 'ca@example.test') $$,
  'owner links client account A to client A'
);
select lives_ok(
  $$ select public.attach_portal_user(pg_temp.id('ub'), pg_temp.id('B'), 'Client B user') $$,
  'owner links client account B to client B'
);
select throws_ok(
  $$ select public.attach_portal_user('b0000000-0000-4000-8000-0000000000a2', pg_temp.id('A'), 'Staff') $$,
  '23514', null, 'a staff account cannot be turned into a client account'
);
select throws_ok(
  $$ select public.attach_portal_user(gen_random_uuid(), pg_temp.id('A'), 'Ghost') $$,
  '22023', null, 'unknown accounts are refused'
);

-- Staff build each client's data through the admin functions.
do $$
declare
  pa uuid; pb uuid;
begin
  pa := public.create_portal_project(pg_temp.id('A'), 'Project A', current_date, current_date + 30);
  pb := public.create_portal_project(pg_temp.id('B'), 'Project B', current_date, null);
  insert into ids values ('pa', pa), ('pb', pb),
    ('ta', public.add_project_task(pa, 'Step A', 'Design', null)),
    ('tb', public.add_project_task(pb, 'Step B', 'Build', null)),
    ('apa', public.create_client_approval(pa, 'Approve A', 'Details A')),
    ('apa2', public.create_client_approval(pa, 'Approve A again', null)),
    ('apb', public.create_client_approval(pb, 'Approve B', 'Details B'));
  insert into public.client_requests (client_id, project_id, kind, subject, body)
    values (pg_temp.id('B'), pb, 'question', 'B question', 'From staff for B');
  insert into public.client_files (client_id, project_id, title, storage_path, file_name)
    values (pg_temp.id('A'), pa, 'File A', pg_temp.id('A')::text || '/f/a.txt', 'a.txt'),
           (pg_temp.id('B'), pb, 'File B', pg_temp.id('B')::text || '/f/b.txt', 'b.txt');
end;
$$;
select is((select count(*)::int from public.client_files), 2, 'staff see every client''s files');
select throws_ok(
  $$ insert into public.client_files (client_id, title, storage_path, file_name)
     values (pg_temp.id('A'), 'Wrong folder', pg_temp.id('B')::text || '/x.txt', 'x.txt') $$,
  '23514', null, 'a file row must point inside its own client''s folder'
);

reset role;
insert into storage.objects (bucket_id, name) values
  ('client-files', (select id from ids where name = 'A')::text || '/f/a.txt'),
  ('client-files', (select id from ids where name = 'B')::text || '/f/b.txt');

-- ── Client A reads only client A ────────────────────────────────────────────────
select pg_temp.as_user('c0000000-0000-4000-8000-0000000000a1');
select results_eq($$ select id from public.portal_client() $$, $$ values (pg_temp.id('A')) $$,
  'portal_client() returns client A');
select is((select count(*)::int from public.clients), 0,
  'clients table (with internal notes) is not readable by clients');
select results_eq($$ select id from public.projects $$, $$ values (pg_temp.id('pa')) $$,
  'client A sees only project A');
select results_eq($$ select id from public.project_tasks $$, $$ values (pg_temp.id('ta')) $$,
  'client A sees only project A''s steps');
select set_eq($$ select id from public.approvals $$, $$ values (pg_temp.id('apa')), (pg_temp.id('apa2')) $$,
  'client A sees only client A''s approvals');
select is((select count(*)::int from public.client_requests), 0, 'client A sees none of B''s requests');
select results_eq($$ select title from public.client_files $$, $$ values ('File A') $$,
  'client A sees only client A''s files');
select results_eq(
  $$ select name from storage.objects where bucket_id = 'client-files' $$,
  $$ values (pg_temp.id('A')::text || '/f/a.txt') $$,
  'client A can read only client A''s stored file'
);
select results_eq($$ select user_id from public.profiles $$, $$ values (pg_temp.id('ua')) $$,
  'client A sees only their own profile');
select is(
  (select count(*)::int from (
    select 1 from public.workspaces union all select 1 from public.workspace_members
    union all select 1 from public.contacts union all select 1 from public.leads
    union all select 1 from public.sow_documents union all select 1 from public.invoices
    union all select 1 from public.audit_events union all select 1 from public.messages
    union all select 1 from public.client_input_requests) s),
  0, 'client A sees no staff-only tables'
);

-- ── Client A cannot write to client B (or as staff) ─────────────────────────────
select throws_ok(
  $$ insert into public.client_requests (client_id, kind, subject, body)
     values (pg_temp.id('B'), 'change', 'Sneaky', 'Posting as B') $$,
  '42501', null, 'client A cannot open a request for client B'
);
select throws_ok(
  $$ insert into public.client_requests (client_id, project_id, kind, subject, body)
     values (pg_temp.id('A'), pg_temp.id('pb'), 'change', 'Sneaky', 'Project B under A') $$,
  '23503', null, 'client A cannot attach a request to project B'
);
select throws_ok(
  $$ insert into public.client_requests (client_id, kind, subject, body, status)
     values (pg_temp.id('A'), 'change', 'Self-close', 'x', 'done') $$,
  '42501', null, 'clients cannot set a request''s status'
);
select lives_ok(
  $$ insert into public.client_requests (client_id, project_id, kind, subject, body)
     values (pg_temp.id('A'), pg_temp.id('pa'), 'change', 'New logo', 'Please swap the logo.') $$,
  'client A can open a request for client A'
);
select results_eq(
  $$ select status::text, created_by from public.client_requests $$,
  $$ values ('open', pg_temp.id('ua')) $$,
  'a client''s request starts open and is attributed to them'
);
select is(
  pg_temp.affected($q$ update public.client_requests set status = 'done' $q$),
  0, 'clients cannot change request status'
);
select throws_ok(
  $$ insert into public.approval_responses (approval_id, decision) values (pg_temp.id('apb'), 'approved') $$,
  '42501', null, 'client A cannot answer client B''s approval'
);
select throws_ok(
  $$ update public.approvals set status = 'approved' where id = pg_temp.id('apa') $$,
  '42501', null, 'clients cannot update approvals directly'
);
select lives_ok(
  $$ insert into public.approval_responses (approval_id, decision, comment)
     values (pg_temp.id('apa'), 'approved', '  Looks great  ') $$,
  'client A answers client A''s approval'
);
select results_eq(
  $$ select status::text, decided_in_portal, decided_by_user_id, decision_note
     from public.approvals where id = pg_temp.id('apa') $$,
  $$ values ('approved', true, pg_temp.id('ua'), 'Looks great') $$,
  'the answer decides the approval and records who and why'
);
select throws_ok(
  $$ insert into public.approval_responses (approval_id, decision) values (pg_temp.id('apa'), 'rejected') $$,
  '23514', null, 'an approval can be answered once'
);
select throws_ok(
  $$ insert into public.approval_responses (approval_id, decision) values (pg_temp.id('apa2'), 'withdrawn') $$,
  '23514', null, 'clients answer only yes or no'
);
select is(
  pg_temp.affected($q$ update public.projects set current_phase = 'Done!' $q$),
  0, 'clients cannot edit projects'
);
select is(
  pg_temp.affected($q$ delete from public.client_files $q$),
  0, 'clients cannot delete files'
);
select throws_ok(
  $$ insert into public.client_files (client_id, title, storage_path, file_name)
     values (pg_temp.id('A'), 'Upload', pg_temp.id('A')::text || '/u.txt', 'u.txt') $$,
  '42501', null, 'clients cannot add file records'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('client-files', pg_temp.id('A')::text || '/u.txt') $$,
  '42501', null, 'clients cannot upload to storage, even in their own folder'
);
-- Deleting stored files is covered through the Storage API in tests/e2e/portal.spec.ts.
select throws_ok(
  $$ update public.profiles set client_id = pg_temp.id('B') where user_id = pg_temp.id('ua') $$,
  '42501', null, 'clients cannot move themselves to another client'
);
select throws_ok(
  $$ update public.profiles set role = 'admin' where user_id = pg_temp.id('ua') $$,
  '42501', null, 'clients cannot make themselves admin'
);
select throws_ok(
  $$ select public.create_client_approval(pg_temp.id('pa'), 'Self-approval', null) $$,
  '42501', null, 'clients cannot use staff functions'
);
select throws_ok(
  $$ select public.attach_portal_user(pg_temp.id('ua'), pg_temp.id('B'), 'Me') $$,
  '42501', null, 'clients cannot re-link their account'
);

-- ── Client B sees only B (including after A's writes) ───────────────────────────
reset role;
select pg_temp.as_user('c0000000-0000-4000-8000-0000000000b1');
select results_eq($$ select id from public.projects $$, $$ values (pg_temp.id('pb')) $$,
  'client B sees only project B');
select results_eq($$ select subject from public.client_requests $$, $$ values ('B question') $$,
  'client B does not see client A''s request');
select results_eq($$ select id from public.approvals $$, $$ values (pg_temp.id('apb')) $$,
  'client B sees only client B''s approval');

-- ── MFA, unlinked accounts, staff boundary ──────────────────────────────────────
reset role;
-- Authenticator apps are optional for clients (D-39): password-only (aal1) is enough until
-- the client adds one, and from then on the code is required. Admins always need it.
select pg_temp.as_user('c0000000-0000-4000-8000-0000000000a1', 'aal1');
select results_eq($$ select id from public.projects $$, $$ values (pg_temp.id('pa')) $$,
  'a client without an authenticator sees their own project with just a password');
select results_eq($$ select id from public.portal_client() $$, $$ values (pg_temp.id('A')) $$,
  'a client without an authenticator gets their portal with just a password');

reset role;
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values (gen_random_uuid(), 'c0000000-0000-4000-8000-0000000000a1', 'Authenticator app', 'totp', 'verified', now(), now());
select pg_temp.as_user('c0000000-0000-4000-8000-0000000000a1', 'aal1');
select is(
  (select count(*)::int from (
    select 1 from public.projects union all select 1 from public.approvals
    union all select 1 from public.client_files union all select 1 from public.client_requests
    union all select 1 from public.portal_client()) s),
  0, 'once a client adds an authenticator, a password-only session sees nothing'
);
select throws_ok(
  $$ insert into public.client_requests (client_id, kind, subject, body)
     values (pg_temp.id('A'), 'question', 'aal1 request', 'x') $$,
  '42501', null, 'once a client adds an authenticator, a password-only session cannot write'
);

reset role;
select pg_temp.as_user('c0000000-0000-4000-8000-0000000000a1');
select results_eq($$ select id from public.projects $$, $$ values (pg_temp.id('pa')) $$,
  'with the authenticator code the client sees their project again');

reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1', 'aal1'); -- owner, password only
select is((select count(*)::int from public.projects), 0,
  'an admin always needs the authenticator code (password-only sees nothing)');

reset role;
select pg_temp.as_user('c0000000-0000-4000-8000-0000000000c1');
select is(
  (select count(*)::int from (
    select 1 from public.projects union all select 1 from public.approvals
    union all select 1 from public.client_files union all select 1 from public.client_requests
    union all select 1 from public.portal_client()) s),
  0, 'a client account not linked to a client sees nothing'
);

reset role;
select pg_temp.as_anon();
select throws_ok($$ select * from public.client_requests $$, '42501', null,
  'signed-out callers cannot read requests');

reset role;
select throws_ok(
  $$ insert into public.workspace_members (workspace_id, user_id, role)
     values ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000a1', 'viewer') $$,
  '23514', null, 'a client account can never become a workspace member'
);

select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1'); -- owner
select is((select count(*)::int from public.client_requests), 2, 'staff see every client''s requests');
select is(
  pg_temp.affected($q$ update public.client_requests set status = 'in_progress', admin_reply = 'On it'
     where client_id = pg_temp.id('A') $q$),
  1, 'staff update request status and reply'
);
select lives_ok($$ select public.detach_portal_user(pg_temp.id('ua')) $$,
  'owner can remove a client''s portal access');

reset role;
select pg_temp.as_user('c0000000-0000-4000-8000-0000000000a1');
select is((select count(*)::int from public.projects), 0, 'after removal client A sees nothing');

reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b1'); -- owner of ws2
select is((select count(*)::int from public.client_requests), 0,
  'staff of another workspace see none of these requests');

select * from finish();
rollback;
