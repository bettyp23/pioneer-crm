-- M3: catalog and immutable, versioned blueprints. (FR-SVC-1, FR-BP-1…4)
begin;
\ir helpers/fixtures.psql
select plan(42);

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
create function pg_temp.id(n text) returns uuid language sql stable as $$
  select id from ids where name = n $$;
grant execute on function pg_temp.id(text) to authenticated;

-- ── owner builds the catalog ────────────────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');

select lives_ok(
  $$ with x as (insert into public.services (workspace_id, code, name, list_price_minor)
       values ('a0000000-0000-4000-8000-000000000001', 'website-build', 'Website build', 500000) returning id)
     insert into ids select 'svc', id from x $$,
  'owner can create a service with an owner-entered price'
);
select throws_ok(
  $$ insert into public.services (workspace_id, code, name)
     values ('a0000000-0000-4000-8000-000000000001', 'website-build', 'Duplicate') $$,
  '23505', null, 'service codes are unique per workspace'
);
select throws_ok(
  $$ insert into public.services (workspace_id, code, name)
     values ('a0000000-0000-4000-8000-000000000001', 'Bad Code!', 'Bad') $$,
  '23514', null, 'service code format is enforced'
);
select lives_ok(
  $$ with x as (insert into public.packages (workspace_id, name)
       values ('a0000000-0000-4000-8000-000000000001', 'Launch bundle') returning id)
     insert into ids select 'pkg', id from x $$,
  'owner can create a package without a price'
);
select lives_ok(
  $$ insert into public.package_services (workspace_id, package_id, service_id, quantity)
     values ('a0000000-0000-4000-8000-000000000001', pg_temp.id('pkg'), pg_temp.id('svc'), 2) $$,
  'owner can add a service to a package'
);

-- ── blueprint v1 draft ───────────────────────────────────────────────────────
select lives_ok(
  $$ with x as (insert into public.blueprints (workspace_id, service_id, name)
       values ('a0000000-0000-4000-8000-000000000001', pg_temp.id('svc'), 'Website delivery') returning id)
     insert into ids select 'bp', id from x $$,
  'owner can create a blueprint'
);
select lives_ok(
  $$ insert into ids select 'v1', public.create_draft_version(pg_temp.id('bp')) $$,
  'create_draft_version creates version 1'
);
select results_eq(
  $$ select version_number, status::text from public.blueprint_versions where id = pg_temp.id('v1') $$,
  $$ values (1, 'draft') $$, 'v1 is draft number 1'
);
select throws_ok(
  $$ select public.create_draft_version(pg_temp.id('bp')) $$,
  '23505', 'This blueprint already has a draft', 'only one draft at a time'
);
select throws_ok(
  $$ select public.publish_blueprint_version(pg_temp.id('v1')) $$,
  '23514', 'Add at least one task.', 'an empty draft cannot be published'
);

select lives_ok(
  $$ with x as (insert into public.task_templates (workspace_id, blueprint_version_id, key, title, phase, position)
       values ('a0000000-0000-4000-8000-000000000001', pg_temp.id('v1'), 'discovery', 'Discovery', 'Plan', 1),
              ('a0000000-0000-4000-8000-000000000001', pg_temp.id('v1'), 'design', 'Design', 'Build', 2),
              ('a0000000-0000-4000-8000-000000000001', pg_temp.id('v1'), 'launch', 'Launch', 'Ship', 3)
       returning id, key)
     insert into ids select key, id from x $$,
  'owner can add task templates to a draft'
);
select throws_ok(
  $$ insert into public.task_templates (workspace_id, blueprint_version_id, key, title, requires_approval)
     values ('a0000000-0000-4000-8000-000000000001', pg_temp.id('v1'), 'review', 'Review', true) $$,
  '23514', null, 'an approval requirement needs an approver'
);
select throws_ok(
  $$ insert into public.task_templates (workspace_id, blueprint_version_id, key, title)
     values ('a0000000-0000-4000-8000-000000000001', pg_temp.id('v1'), 'Bad Key', 'X') $$,
  '23514', null, 'task keys are lowercase identifiers'
);
select lives_ok(
  $$ insert into public.task_template_dependencies (workspace_id, blueprint_version_id, task_template_id, depends_on_id)
     values ('a0000000-0000-4000-8000-000000000001', pg_temp.id('v1'), pg_temp.id('design'), pg_temp.id('discovery')),
            ('a0000000-0000-4000-8000-000000000001', pg_temp.id('v1'), pg_temp.id('launch'), pg_temp.id('design')) $$,
  'owner can add dependencies'
);
select throws_ok(
  $$ insert into public.task_template_dependencies (workspace_id, blueprint_version_id, task_template_id, depends_on_id)
     values ('a0000000-0000-4000-8000-000000000001', pg_temp.id('v1'), pg_temp.id('design'), pg_temp.id('design')) $$,
  '23514', null, 'a task cannot depend on itself'
);
select lives_ok(
  $$ insert into public.input_templates (workspace_id, blueprint_version_id, key, label, input_kind, blocks_task_template_id)
     values ('a0000000-0000-4000-8000-000000000001', pg_temp.id('v1'), 'hosting_access',
             'Hosting access (where the credential is stored)', 'access_confirmation', pg_temp.id('launch')) $$,
  'owner can add a client input that blocks a task'
);
select is(public.blueprint_version_problems(pg_temp.id('v1')), array[]::text[], 'v1 has no problems');
select lives_ok(
  $$ select public.publish_blueprint_version(pg_temp.id('v1'), 'Initial version') $$,
  'owner can publish v1'
);
select results_eq(
  $$ select status::text, published_by, length(content_hash) from public.blueprint_versions
     where id = pg_temp.id('v1') $$,
  $$ values ('published', 'b0000000-0000-4000-8000-0000000000a1'::uuid, 64) $$,
  'publishing stamps status, publisher and a SHA-256 content hash'
);

-- ── published versions are immutable ────────────────────────────────────────
select throws_ok(
  $$ update public.task_templates set title = 'Changed' where id = pg_temp.id('design') $$,
  '23514', 'Published blueprint versions are immutable; create a new draft',
  'published task templates cannot be updated'
);
select throws_ok(
  $$ insert into public.task_templates (workspace_id, blueprint_version_id, key, title)
     values ('a0000000-0000-4000-8000-000000000001', pg_temp.id('v1'), 'extra', 'Extra') $$,
  '23514', null, 'tasks cannot be added to a published version'
);
select throws_ok(
  $$ delete from public.task_templates where id = pg_temp.id('launch') $$,
  '23514', null, 'published task templates cannot be deleted'
);
select throws_ok(
  $$ delete from public.task_template_dependencies where blueprint_version_id = pg_temp.id('v1') $$,
  '23514', null, 'published dependencies cannot be deleted'
);
select throws_ok(
  $$ update public.input_templates set label = 'Changed' where blueprint_version_id = pg_temp.id('v1') $$,
  '23514', null, 'published input templates cannot be updated'
);
select throws_ok(
  $$ update public.blueprint_versions set change_summary = 'Rewritten history' where id = pg_temp.id('v1') $$,
  '23514', null, 'a published version''s summary cannot be changed'
);
select throws_ok(
  $$ delete from public.blueprint_versions where id = pg_temp.id('v1') $$,
  '23514', 'Published blueprint versions cannot be deleted', 'published versions cannot be deleted'
);
select throws_ok(
  $$ update public.blueprint_versions set status = 'draft' where id = pg_temp.id('v1') $$,
  '42501', null, 'status is not directly writable'
);

-- ── new draft copies the published version ─────────────────────────────────
select lives_ok(
  $$ insert into ids select 'v2', public.create_draft_version(pg_temp.id('bp'), pg_temp.id('v1')) $$,
  'a new draft can be created from the published version'
);
select results_eq(
  $$ select (select count(*) from public.task_templates where blueprint_version_id = pg_temp.id('v2'))::int,
            (select count(*) from public.task_template_dependencies where blueprint_version_id = pg_temp.id('v2'))::int,
            (select count(*) from public.input_templates i join public.task_templates t
               on t.id = i.blocks_task_template_id
             where i.blueprint_version_id = pg_temp.id('v2') and t.key = 'launch')::int $$,
  $$ values (3, 2, 1) $$,
  'the draft copies tasks, dependencies and inputs (blocking task remapped by key)'
);
-- Introduce a cycle: discovery depends on launch (launch → design → discovery → launch).
insert into public.task_template_dependencies (workspace_id, blueprint_version_id, task_template_id, depends_on_id)
  select 'a0000000-0000-4000-8000-000000000001', pg_temp.id('v2'), d.id, l.id
  from public.task_templates d, public.task_templates l
  where d.blueprint_version_id = pg_temp.id('v2') and d.key = 'discovery'
    and l.blueprint_version_id = pg_temp.id('v2') and l.key = 'launch';
select ok(
  array_to_string(public.blueprint_version_problems(pg_temp.id('v2')), ' ') like '%cycle%',
  'cycles are reported'
);
select throws_like(
  $$ select public.publish_blueprint_version(pg_temp.id('v2')) $$,
  '%cycle%', 'a draft with a cycle cannot be published'
);
delete from public.task_template_dependencies d using public.task_templates t
  where d.task_template_id = t.id and t.blueprint_version_id = pg_temp.id('v2') and t.key = 'discovery';
select lives_ok($$ select public.publish_blueprint_version(pg_temp.id('v2')) $$, 'v2 publishes once fixed');
select results_eq(
  $$ select (select content_hash from public.blueprint_versions where id = pg_temp.id('v1'))
          = (select content_hash from public.blueprint_versions where id = pg_temp.id('v2')) $$,
  $$ values (true) $$,
  'identical content produces the same hash'
);

-- ── retire ─────────────────────────────────────────────────────────────────
select lives_ok($$ select public.retire_blueprint_version(pg_temp.id('v1')) $$, 'owner can retire v1');
select throws_ok(
  $$ select public.retire_blueprint_version(pg_temp.id('v1')) $$,
  '23514', 'Only published versions can be retired', 'a retired version cannot be retired again'
);
select lives_ok(
  $$ insert into ids select 'v3', public.create_draft_version(pg_temp.id('bp')) $$, 'empty draft v3'
);
select lives_ok(
  $$ delete from public.blueprint_versions where id = pg_temp.id('v3') $$, 'drafts can be deleted'
);
reset role;

-- ── roles and MFA ──────────────────────────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a3'); -- member
select throws_ok(
  $$ insert into public.services (workspace_id, code, name)
     values ('a0000000-0000-4000-8000-000000000001', 'member-svc', 'Member service') $$,
  '42501', null, 'members cannot manage the catalog'
);
select throws_ok(
  $$ select public.create_draft_version(pg_temp.id('bp')) $$,
  '42501', null, 'members cannot create blueprint drafts'
);
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a4'); -- viewer
select results_eq(
  $$ select count(*)::int from public.blueprint_versions where blueprint_id = pg_temp.id('bp') $$,
  $$ values (2) $$, 'viewers can read published versions'
);
reset role;
-- Owner without MFA cannot publish (definer function re-checks aal2).
insert into ids select 'v4', id from (
  select gen_random_uuid() as id) x;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1');
update ids set id = public.create_draft_version(pg_temp.id('bp')) where name = 'v4';
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000a1', 'aal1');
select throws_ok(
  $$ select public.publish_blueprint_version(pg_temp.id('v4')) $$,
  '42501', null, 'publishing requires MFA'
);
reset role;

select isnt_empty(
  $$ select 1 from public.audit_events where action = 'blueprint_version.updated'
       and changes -> 'status' = '["published", "retired"]'::jsonb $$,
  'retiring is audited'
);

select * from finish();
rollback;
