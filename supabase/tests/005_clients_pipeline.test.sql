-- M2: clients, contacts, pipeline stages, leads, activities, follow-ups.
-- (FR-CLI-1/2, FR-CON-1, FR-LEAD-1/2, FR-ACT-1, FR-FU-1, D-2, D-3, D-17)
begin;
\ir helpers/fixtures.psql
select plan(50);

-- Fixture: one client per workspace (as postgres).
insert into public.clients (id, workspace_id, name) values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Synthetic Client One'),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'Synthetic Client Two');
insert into public.contacts (id, workspace_id, client_id, first_name) values
  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002',
   'c0000000-0000-4000-8000-000000000002', 'OtherWorkspace');

-- Rows created by API roles get database-generated ids (the app cannot choose ids), so
-- tests capture them into `ids` and look them up with pg_temp.id(name).
create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
create function pg_temp.id(n text) returns uuid language sql stable as $$
  select id from ids where name = n $$;
grant execute on function pg_temp.id(text) to authenticated;
insert into ids
  select 'ws1_' || lower(name), id from public.pipeline_stages
  where workspace_id = 'a0000000-0000-4000-8000-000000000001';
insert into ids
  select 'ws2_' || lower(name), id from public.pipeline_stages
  where workspace_id = 'a0000000-0000-4000-8000-000000000002';

-- ── stages seeded for every workspace (D-3) ────────────────────────────────
select results_eq(
  $$ select name, kind::text from public.pipeline_stages
     where workspace_id = 'a0000000-0000-4000-8000-000000000001' order by position $$,
  $$ values ('Inquiry', 'open'), ('Discovery', 'open'), ('Proposal', 'open'),
            ('Negotiation', 'open'), ('Won', 'won'), ('Lost', 'lost') $$,
  'new workspaces get the default six stages'
);

-- ── aal1 sees nothing ──────────────────────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1', 'aal1');
select is_empty($$ select 1 from public.clients $$, 'aal1 sees no clients');
select is_empty($$ select 1 from public.pipeline_stages $$, 'aal1 sees no stages');
select throws_ok(
  $$ insert into public.clients (workspace_id, name)
     values ('a0000000-0000-4000-8000-000000000001', 'Nope') $$,
  '42501', null, 'aal1 cannot create clients'
);
reset role;

-- ── member: creates and edits records ─────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a3');
select results_eq(
  $$ select name from public.clients $$, $$ values ('Synthetic Client One') $$,
  'member sees only their workspace clients'
);
select lives_ok(
  $$ with x as (insert into public.clients (workspace_id, name, drive_folder_url, website_url)
       values ('a0000000-0000-4000-8000-000000000001', 'Member Client',
               'https://drive.google.com/drive/folders/abc', 'https://example.test') returning id)
     insert into ids select 'client3', id from x $$,
  'member can create a client with Drive and website links'
);
select results_eq(
  $$ select created_by from public.clients where id = pg_temp.id('client3') $$,
  $$ values ('b0000000-0000-4000-8000-0000000000a3'::uuid) $$,
  'created_by defaults to the caller'
);
select throws_ok(
  $$ insert into public.clients (workspace_id, name, drive_folder_url)
     values ('a0000000-0000-4000-8000-000000000001', 'Bad Drive', 'https://evil.example/folder') $$,
  '23514', null, 'Drive link must be a Google Drive/Docs https URL'
);
select throws_ok(
  $$ insert into public.clients (workspace_id, name, website_url)
     values ('a0000000-0000-4000-8000-000000000001', 'Bad Site', 'http://insecure.example') $$,
  '23514', null, 'website must be https'
);
select throws_ok(
  $$ insert into public.clients (workspace_id, name)
     values ('a0000000-0000-4000-8000-000000000002', 'Wrong Workspace') $$,
  '42501', null, 'member cannot create clients in another workspace'
);
select throws_ok(
  $$ insert into public.clients (workspace_id, name, created_by)
     values ('a0000000-0000-4000-8000-000000000001', 'Spoof', 'b0000000-0000-4000-8000-0000000000a1') $$,
  '42501', null, 'created_by cannot be supplied'
);
select lives_ok(
  $$ update public.clients set status = 'active'
     where id = 'c0000000-0000-4000-8000-000000000001' $$,
  'member can change client status'
);
select throws_ok(
  $$ delete from public.clients where id = 'c0000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'clients cannot be hard-deleted'
);

-- contacts: one primary per client; switching clears the old one.
select lives_ok(
  $$ with x as (insert into public.contacts (workspace_id, client_id, first_name, email, is_primary) values
       ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
        'Ada', 'ada@example.test', true) returning id)
     insert into ids select 'ada', id from x $$,
  'member can add a primary contact'
);
select lives_ok(
  $$ insert into public.contacts (workspace_id, client_id, first_name, is_primary) values
     ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Grace', true) $$,
  'adding a second primary contact succeeds'
);
select results_eq(
  $$ select first_name from public.contacts
     where client_id = 'c0000000-0000-4000-8000-000000000001' and is_primary $$,
  $$ values ('Grace') $$,
  'only the newest primary contact remains primary'
);
select throws_ok(
  $$ insert into public.contacts (workspace_id, client_id, first_name, email) values
     ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Bad', 'not-an-email') $$,
  '23514', null, 'contact email format is checked'
);
select throws_ok(
  $$ insert into public.contacts (workspace_id, client_id, first_name) values
     ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'Cross') $$,
  '23503', null, 'contact cannot point at a client in another workspace'
);

-- leads: stage rules
select lives_ok(
  $$ with x as (insert into public.leads (workspace_id, client_id, primary_contact_id, title, stage_id,
                                          estimated_value_minor, owner_user_id) values
       ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', pg_temp.id('ada'),
        'Website rebuild', pg_temp.id('ws1_inquiry'), 1250000, 'b0000000-0000-4000-8000-0000000000a3')
       returning id)
     insert into ids select 'lead1', id from x $$,
  'member can create a lead'
);
select throws_ok(
  $$ insert into public.leads (workspace_id, client_id, title, stage_id) values
     ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Cross stage', pg_temp.id('ws2_inquiry')) $$,
  '23503', null, 'lead cannot use a stage from another workspace'
);
select throws_ok(
  $$ insert into public.leads (workspace_id, client_id, primary_contact_id, title, stage_id) values
     ('a0000000-0000-4000-8000-000000000001', pg_temp.id('client3'),
      pg_temp.id('ada'), 'Wrong contact', pg_temp.id('ws1_inquiry')) $$,
  '23503', null, 'lead primary contact must belong to the lead''s client'
);
select throws_ok(
  $$ insert into public.leads (workspace_id, client_id, title, stage_id, owner_user_id) values
     ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Outsider owner', pg_temp.id('ws1_inquiry'),
      'b0000000-0000-4000-8000-0000000000b1') $$,
  '23503', null, 'lead owner must be a workspace member'
);
select throws_ok(
  $$ update public.leads set stage_id = pg_temp.id('ws1_lost') where id = pg_temp.id('lead1') $$,
  '23514', 'A lost reason is required when a lead is marked lost',
  'moving to Lost requires a reason'
);
select lives_ok(
  $$ update public.leads set stage_id = pg_temp.id('ws1_lost'), lost_reason = 'Budget moved to next year'
            where id = pg_temp.id('lead1') $$,
  'moving to Lost with a reason succeeds'
);
select isnt(
  (select closed_at from public.leads where id = pg_temp.id('lead1')),
  null, 'closed_at is stamped when a lead is lost'
);
select lives_ok(
  $$ update public.leads set stage_id = pg_temp.id('ws1_proposal') where id = pg_temp.id('lead1') $$,
  'a lost lead can be reopened'
);
select results_eq(
  $$ select closed_at, lost_reason from public.leads where id = pg_temp.id('lead1') $$,
  $$ values (null::timestamptz, null::text) $$,
  'reopening clears closed_at and lost_reason'
);
select throws_ok(
  $$ update public.leads set closed_at = now() where id = pg_temp.id('lead1') $$,
  '42501', null, 'closed_at is not directly writable'
);

-- activities and follow-ups
select lives_ok(
  $$ with x as (insert into public.activities (workspace_id, client_id, lead_id, type, subject) values
       ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
        pg_temp.id('lead1'), 'call', 'Intro call') returning id)
     insert into ids select 'act1', id from x $$,
  'member can log an activity on a lead'
);
select throws_ok(
  $$ insert into public.activities (workspace_id, client_id, lead_id, type, subject) values
     ('a0000000-0000-4000-8000-000000000001', pg_temp.id('client3'),
      pg_temp.id('lead1'), 'note', 'Wrong client') $$,
  '23503', null, 'activity lead must belong to the activity''s client'
);
select lives_ok(
  $$ update public.activities set subject = 'Intro call (rescheduled)'
     where id = pg_temp.id('act1') $$,
  'author can edit their activity within 24 hours'
);
select throws_ok(
  $$ delete from public.activities $$, '42501', null, 'activities cannot be deleted'
);
select lives_ok(
  $$ with x as (insert into public.follow_ups (workspace_id, client_id, lead_id, title, due_on, assignee_user_id) values
       ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', pg_temp.id('lead1'),
        'Send proposal', current_date, 'b0000000-0000-4000-8000-0000000000a3') returning id)
     insert into ids select 'fu1', id from x $$,
  'member can create a follow-up'
);
select lives_ok(
  $$ update public.follow_ups set status = 'done' where id = pg_temp.id('fu1') $$,
  'member can complete a follow-up'
);
select isnt(
  (select completed_at from public.follow_ups where id = pg_temp.id('fu1')),
  null, 'completed_at is stamped on completion'
);
select throws_ok(
  $$ insert into public.follow_ups (workspace_id, client_id, title, due_on, assignee_user_id) values
     ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Bad assignee',
      current_date, 'b0000000-0000-4000-8000-0000000000b1') $$,
  '23503', null, 'follow-up assignee must be a workspace member'
);

-- member cannot configure the pipeline
select is_empty(
  $$ update public.pipeline_stages set name = 'Renamed' returning 1 $$,
  'member cannot rename stages'
);
select throws_ok(
  $$ insert into public.pipeline_stages (workspace_id, name, position)
     values ('a0000000-0000-4000-8000-000000000001', 'Extra', 99) $$,
  '42501', null, 'member cannot add stages'
);
reset role;

-- D-17: activities older than 24 h are locked for the author; the owner can still edit.
update public.activities set created_at = now() - interval '25 hours'
  where id = pg_temp.id('act1');
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a3');
select is_empty(
  $$ update public.activities set subject = 'Late edit'
     where id = pg_temp.id('act1') returning 1 $$,
  'author cannot edit an activity after 24 hours'
);
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
select isnt_empty(
  $$ update public.activities set subject = 'Owner correction'
     where id = pg_temp.id('act1') returning 1 $$,
  'owner can edit an older activity'
);

-- admin/owner configure the pipeline
select lives_ok(
  $$ select public.move_pipeline_stage(pg_temp.id('ws1_inquiry'), 1) $$,
  'owner can reorder stages'
);
select results_eq(
  $$ select name from public.pipeline_stages
     where workspace_id = 'a0000000-0000-4000-8000-000000000001' order by position limit 2 $$,
  $$ values ('Discovery'), ('Inquiry') $$,
  'move_pipeline_stage swaps adjacent positions'
);
select throws_ok(
  $$ delete from public.pipeline_stages where id = pg_temp.id('ws1_proposal') $$,
  '23503', null, 'a stage in use cannot be deleted'
);
select is_empty(
  $$ delete from public.pipeline_stages where id = pg_temp.id('ws1_won') returning 1 $$,
  'won/lost stages cannot be deleted'
);
reset role;

-- ── viewer: read-only ──────────────────────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a4');
select isnt_empty($$ select 1 from public.leads $$, 'viewer can read leads');
select throws_ok(
  $$ insert into public.clients (workspace_id, name)
     values ('a0000000-0000-4000-8000-000000000001', 'Viewer Client') $$,
  '42501', null, 'viewer cannot create clients'
);
select is_empty(
  $$ update public.leads set title = 'Viewer edit' returning 1 $$,
  'viewer cannot edit leads'
);
reset role;

-- ── outsider ───────────────────────────────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b1');
select is_empty(
  $$ select 1 from public.leads where workspace_id = 'a0000000-0000-4000-8000-000000000001' $$,
  'non-member sees no leads of another workspace'
);
reset role;

-- ── audit: client status and lead stage changes ────────────────────────────
select isnt_empty(
  $$ select 1 from public.audit_events where action = 'client.updated'
       and changes ? 'status' and actor_user_id = 'b0000000-0000-4000-8000-0000000000a3' $$,
  'client status change is audited with the actor'
);
select results_eq(
  $$ select count(*)::int from public.audit_events
     where action = 'lead.updated' and changes ? 'stage_id' $$,
  $$ values (2) $$,
  'each lead stage change is audited'
);

select * from finish();
rollback;
