-- M4: SOWs, idempotent project generation, task rules, client inputs, approvals.
-- (FR-SOW-1, FR-PRJ-1…4, FR-TASK-1…4, FR-INP-1, FR-APR-1, D-6, D-7, D-8)
begin;
\ir helpers/fixtures.psql
select plan(57);

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
create function pg_temp.id(n text) returns uuid language sql stable as $$
  select id from ids where name = n $$;
grant execute on function pg_temp.id(text) to authenticated;
create function pg_temp.task(n text) returns public.project_tasks language sql stable as $$
  select * from public.project_tasks where project_id = pg_temp.id('p1') and key = n $$;
grant execute on function pg_temp.task(text) to authenticated;

-- ── fixture (postgres): client, contact, published blueprint a → b(client approval) → c ──
do $$
declare
  ws uuid := 'a0000000-0000-4000-8000-000000000001';
  c uuid; ct uuid; bp uuid; v uuid; ta uuid; tb uuid; tc uuid; v2 uuid;
begin
  insert into public.clients (workspace_id, name) values (ws, 'Project Client') returning id into c;
  insert into public.contacts (workspace_id, client_id, first_name) values (ws, c, 'Casey') returning id into ct;
  insert into public.blueprints (workspace_id, name) values (ws, 'Delivery') returning id into bp;
  insert into public.blueprint_versions (workspace_id, blueprint_id, version_number) values (ws, bp, 1) returning id into v;
  insert into public.task_templates (workspace_id, blueprint_version_id, key, title, position, due_offset_days)
    values (ws, v, 'a', 'Task A', 1, 2) returning id into ta;
  insert into public.task_templates (workspace_id, blueprint_version_id, key, title, position, due_offset_days, requires_approval, approval_approver)
    values (ws, v, 'b', 'Task B', 2, 5, true, 'client') returning id into tb;
  insert into public.task_templates (workspace_id, blueprint_version_id, key, title, position, due_offset_days)
    values (ws, v, 'c', 'Task C', 3, 9) returning id into tc;
  insert into public.task_template_dependencies (workspace_id, blueprint_version_id, task_template_id, depends_on_id)
    values (ws, v, tb, ta), (ws, v, tc, tb);
  insert into public.input_templates (workspace_id, blueprint_version_id, key, label, input_kind, blocks_task_template_id)
    values (ws, v, 'brand', 'Brand files', 'file', tc);
  update public.blueprint_versions set status = 'published', published_at = now(),
    content_hash = encode(extensions.digest(private.blueprint_version_content(v)::text, 'sha256'), 'hex')
    where id = v;
  insert into public.blueprint_versions (workspace_id, blueprint_id, version_number) values (ws, bp, 2) returning id into v2;
  insert into ids values ('client', c), ('contact', ct), ('v1', v), ('v2_draft', v2),
    ('key1', gen_random_uuid()), ('key2', gen_random_uuid()), ('key3', gen_random_uuid());
end;
$$;

-- ── SOWs ───────────────────────────────────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a3'); -- member
select lives_ok(
  $$ with x as (insert into public.sow_documents (workspace_id, client_id, title, drive_url, status)
       values ('a0000000-0000-4000-8000-000000000001', pg_temp.id('client'), 'SOW 2026',
               'https://drive.google.com/file/d/sow', 'sent') returning id)
     insert into ids select 'sow', id from x $$,
  'member can record a sent SOW'
);
select throws_ok(
  $$ insert into public.sow_documents (workspace_id, client_id, title, status)
     values ('a0000000-0000-4000-8000-000000000001', pg_temp.id('client'), 'Pre-signed', 'signed') $$,
  '23514', null, 'SOWs cannot be inserted as signed'
);
select throws_ok(
  $$ update public.sow_documents set status = 'signed', signed_on = current_date, client_signatory = 'Casey'
     where id = pg_temp.id('sow') $$,
  '42501', 'Only the workspace owner can record a SOW as signed', 'members cannot record signing'
);
select throws_ok(
  $$ select public.generate_project(pg_temp.id('client'), pg_temp.id('v1'), 'Nope', current_date, pg_temp.id('key1'), pg_temp.id('sow')) $$,
  '42501', null, 'members cannot generate projects'
);
reset role;

select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1'); -- owner
select throws_ok(
  $$ update public.sow_documents set status = 'signed', signed_on = current_date where id = pg_temp.id('sow') $$,
  '23514', null, 'signing requires date and signatory'
);
select throws_ok(
  $$ select public.generate_project(pg_temp.id('client'), pg_temp.id('v1'), 'P', current_date, pg_temp.id('key1'), pg_temp.id('sow')) $$,
  '23514', 'Choose a signed SOW for this client', 'an unsigned SOW cannot authorize a project'
);
select lives_ok(
  $$ update public.sow_documents set status = 'signed', signed_on = current_date, client_signatory = 'Casey Client'
     where id = pg_temp.id('sow') $$,
  'owner can record the SOW as signed'
);
select throws_ok(
  $$ update public.sow_documents set title = 'Edited after signing' where id = pg_temp.id('sow') $$,
  '23514', 'Signed SOW references are immutable; mark them superseded or void instead',
  'signed SOWs are immutable'
);

-- ── generation ─────────────────────────────────────────────────────────────
select throws_ok(
  $$ select public.generate_project(pg_temp.id('client'), pg_temp.id('v1'), 'P', current_date, pg_temp.id('key1')) $$,
  '23514', 'A signed SOW is required, or give a reason for an internal/pilot project',
  'D-6: no SOW and no reason is rejected'
);
select throws_ok(
  $$ select public.generate_project(pg_temp.id('client'), pg_temp.id('v2_draft'), 'P', current_date, pg_temp.id('key1'), pg_temp.id('sow')) $$,
  '23514', 'Choose a published blueprint version', 'drafts cannot generate projects'
);
select lives_ok(
  $$ insert into ids select 'p1', public.generate_project(pg_temp.id('client'), pg_temp.id('v1'),
       'Website project', date '2026-11-02', pg_temp.id('key1'), pg_temp.id('sow')) $$,
  'owner generates a project from a published version and signed SOW'
);
select results_eq(
  $$ select (select count(*) from public.project_tasks where project_id = pg_temp.id('p1'))::int,
            (select count(*) from public.task_dependencies where project_id = pg_temp.id('p1'))::int,
            (select count(*) from public.client_input_requests where project_id = pg_temp.id('p1'))::int,
            (select count(*) from public.approvals where project_id = pg_temp.id('p1') and status = 'pending')::int $$,
  $$ values (3, 2, 1, 1) $$,
  'generation copies tasks, dependencies, inputs and approval placeholders'
);
select results_eq(
  $$ select key, due_on from public.project_tasks where project_id = pg_temp.id('p1') order by key $$,
  $$ values ('a', date '2026-11-04'), ('b', date '2026-11-07'), ('c', date '2026-11-11') $$,
  'due dates = start + template offset'
);
select results_eq(
  $$ select i.blocks_task_id = (pg_temp.task('c')).id from public.client_input_requests i
     where i.project_id = pg_temp.id('p1') $$,
  $$ values (true) $$, 'input blockers are remapped to the project task'
);
select results_eq(
  $$ select blueprint_version_id, sow_id, target_end_on from public.projects where id = pg_temp.id('p1') $$,
  $$ select pg_temp.id('v1'), pg_temp.id('sow'), date '2026-11-11' $$,
  'project keeps its blueprint version and SOW references'
);
select is(
  public.generate_project(pg_temp.id('client'), pg_temp.id('v1'), 'Website project', date '2026-11-02',
    pg_temp.id('key1'), pg_temp.id('sow')),
  pg_temp.id('p1'),
  'retrying with the same idempotency key returns the same project'
);
select results_eq(
  $$ select count(*)::int from public.projects where idempotency_key = pg_temp.id('key1') $$,
  $$ values (1) $$, 'no duplicate project on retry'
);
select lives_ok(
  $$ insert into ids select 'p2', public.generate_project(pg_temp.id('client'), pg_temp.id('v1'),
       'Pilot project', date '2026-11-02', pg_temp.id('key2'), null, 'Internal pilot to test the process') $$,
  'D-6: a pilot project with a reason needs no SOW'
);
select isnt_empty(
  $$ select 1 from public.audit_events where action = 'project.generated' and entity_id = pg_temp.id('p2')
       and changes ->> 'no_sow_reason' = 'Internal pilot to test the process' $$,
  'generation (and the pilot reason) is audited'
);
select throws_ok(
  $$ insert into public.projects (workspace_id, client_id, blueprint_version_id, name, start_on, idempotency_key, no_sow_reason)
     values ('a0000000-0000-4000-8000-000000000001', pg_temp.id('client'), pg_temp.id('v1'), 'Direct', current_date, gen_random_uuid(), 'x') $$,
  '42501', null, 'projects cannot be inserted directly'
);

-- ── task rules ─────────────────────────────────────────────────────────────
select throws_ok(
  $$ update public.project_tasks set status = 'done' where id = (pg_temp.task('a')).id $$,
  '42501', null, 'task status is not directly writable'
);
select throws_ok(
  $$ select public.transition_task((pg_temp.task('a')).id, 'done', 1) $$,
  '23514', 'A task can''t move from todo to done', 'todo → done is not an allowed transition'
);
select throws_like(
  $$ select public.transition_task((pg_temp.task('b')).id, 'in_progress', 1) $$,
  'Blocked by: Task A', 'a task cannot start before its prerequisite is done'
);
select is(public.transition_task((pg_temp.task('a')).id, 'in_progress', 1), 2, 'A starts; version becomes 2');
select isnt((pg_temp.task('a')).started_at, null, 'started_at is stamped');
select throws_ok(
  $$ select public.transition_task((pg_temp.task('a')).id, 'in_review', 1) $$,
  '23514', 'This task was changed by someone else. Reload and try again.',
  'stale versions are rejected (optimistic concurrency)'
);
select is(public.transition_task((pg_temp.task('a')).id, 'in_review', 2), 3, 'A → in review');
select is(public.transition_task((pg_temp.task('a')).id, 'done', 3), 4, 'A → done (no approval needed)');
select is(public.transition_task((pg_temp.task('b')).id, 'in_progress', 1), 2, 'B can start once A is done');
select is(public.transition_task((pg_temp.task('b')).id, 'in_review', 2), 3, 'B → in review');
select throws_ok(
  $$ select public.transition_task((pg_temp.task('b')).id, 'done', 3) $$,
  '23514', 'This task needs an approved approval before it can be done',
  'a task requiring approval cannot be done without it'
);
select results_eq(
  $$ select can_start, start_blockers -> 0 ->> 'title', start_blockers -> 1 ->> 'title'
     from public.task_readiness where task_id = (pg_temp.task('c')).id $$,
  $$ values (false, 'Task B', 'Brand files') $$,
  'task_readiness explains blockers (task and client input)'
);

-- ── approvals ──────────────────────────────────────────────────────────────
insert into ids select 'apr', id from public.approvals where task_id = (pg_temp.task('b')).id;
select throws_ok(
  $$ select public.decide_approval(pg_temp.id('apr'), 'approved', 1, 'ok') $$,
  '23514', null, 'client approvals need a contact and evidence'
);
select lives_ok(
  $$ select public.decide_approval(pg_temp.id('apr'), 'approved', 1, 'Approved by email',
       'https://drive.google.com/file/d/approval-email', pg_temp.id('contact')) $$,
  'client approval recorded with contact and evidence'
);
select throws_ok(
  $$ select public.decide_approval(pg_temp.id('apr'), 'rejected', 2, 'changed mind',
       'https://drive.google.com/x', pg_temp.id('contact')) $$,
  '23514', 'Decided approvals are immutable', 'a decided approval cannot be re-decided'
);
select throws_ok(
  $$ update public.approvals set decision_note = 'tamper' where id = pg_temp.id('apr') $$,
  '42501', null, 'approvals are not directly writable'
);
select is(public.transition_task((pg_temp.task('b')).id, 'done', 3), 4, 'B → done once approved');
select throws_ok(
  $$ select public.request_approval((pg_temp.task('a')).id) $$,
  '23514', 'This task does not require approval', 'approvals only for tasks that need them'
);

-- ── client inputs ──────────────────────────────────────────────────────────
insert into ids select 'inp', id from public.client_input_requests where project_id = pg_temp.id('p1');
select throws_ok(
  $$ select public.set_input_request_status(pg_temp.id('inp'), 'accepted', 1) $$,
  '23514', null, 'an input must be received before it is accepted'
);
select is(
  public.set_input_request_status(pg_temp.id('inp'), 'received', 1, 'https://drive.google.com/drive/folders/brand'),
  2, 'input received with a Drive link'
);
select throws_ok(
  $$ select public.set_input_request_status(pg_temp.id('inp'), 'received', 2, 'https://evil.example/x') $$,
  '23514', null, 'received materials must be Google Drive/Docs links'
);
select is(public.set_input_request_status(pg_temp.id('inp'), 'accepted', 2), 3, 'input accepted');
select results_eq(
  $$ select can_start from public.task_readiness where task_id = (pg_temp.task('c')).id $$,
  $$ values (true) $$, 'C is ready once B is done and the input accepted'
);
select results_eq(
  $$ select status::text from public.project_tasks where id = (pg_temp.task('c')).id $$,
  $$ values ('todo') $$, 'readiness never changes status automatically (FR-TASK-4)'
);

-- ── cancellation (D-7) ─────────────────────────────────────────────────────
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a3'); -- member
select throws_ok(
  $$ select public.transition_task(t.id, 'cancelled', t.version, 'nope')
     from public.project_tasks t where t.project_id = pg_temp.id('p2') and t.key = 'a' $$,
  '42501', 'Only owners and admins can cancel tasks', 'members cannot cancel tasks'
);
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
select throws_ok(
  $$ select public.transition_task(t.id, 'cancelled', t.version)
     from public.project_tasks t where t.project_id = pg_temp.id('p2') and t.key = 'a' $$,
  '23514', 'Give a reason for cancelling', 'cancelling needs a reason'
);
select throws_ok(
  $$ select public.transition_task(t.id, 'cancelled', t.version, 'Out of scope')
     from public.project_tasks t where t.project_id = pg_temp.id('p2') and t.key = 'a' $$,
  '23514', 'Cancelling unblocks: Task B. Confirm to continue.', 'D-7: cancelling lists dependents'
);
select lives_ok(
  $$ select public.transition_task(t.id, 'cancelled', t.version, 'Out of scope', true)
     from public.project_tasks t where t.project_id = pg_temp.id('p2') and t.key = 'a' $$,
  'D-7: cancelling with confirmation succeeds'
);
select results_eq(
  $$ select r.can_start from public.task_readiness r join public.project_tasks t on t.id = r.task_id
     where t.project_id = pg_temp.id('p2') and t.key = 'b' $$,
  $$ values (true) $$, 'D-7: a cancelled prerequisite no longer blocks'
);
reset role;

-- ── viewer / outsider / aal1 ───────────────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a4');
select results_eq(
  $$ select count(*)::int from public.project_tasks where project_id = pg_temp.id('p1') $$,
  $$ values (3) $$, 'viewers can read project tasks'
);
select throws_ok(
  $$ select public.transition_task((pg_temp.task('c')).id, 'in_progress', (pg_temp.task('c')).version) $$,
  '42501', null, 'viewers cannot move tasks'
);
select is_empty(
  $$ update public.project_tasks set due_on = current_date where project_id = pg_temp.id('p1') returning 1 $$,
  'viewers cannot edit tasks'
);
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b1');
select is_empty($$ select 1 from public.projects where id = pg_temp.id('p1') $$, 'outsiders see no projects');
select is_empty($$ select 1 from public.task_readiness where project_id = pg_temp.id('p1') $$,
  'views apply RLS (security_invoker)');
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1', 'aal1');
select throws_ok(
  $$ select public.generate_project(pg_temp.id('client'), pg_temp.id('v1'), 'P', current_date, pg_temp.id('key3'), pg_temp.id('sow')) $$,
  '42501', null, 'generation requires MFA'
);
reset role;

select isnt_empty(
  $$ select 1 from public.audit_events where action = 'task.updated' and entity_id = (pg_temp.task('a')).id
       and changes -> 'status' = '["in_review", "done"]'::jsonb $$,
  'task transitions are audited'
);
select isnt_empty(
  $$ select 1 from public.audit_events where action = 'sow.updated' and changes -> 'status' = '["sent", "signed"]'::jsonb $$,
  'SOW signing is audited'
);

select * from finish();
rollback;
