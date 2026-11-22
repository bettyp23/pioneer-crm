-- Grants: anon has nothing; authenticated has only the documented privileges;
-- private helpers are not callable by anon. (NFR-SEC-2, docs/schema.md §9)
begin;
\ir helpers/fixtures.psql
select plan(14);

-- anon: no table privileges on any table or view in public.
select is_empty(
  $$ select table_name, privilege_type
     from information_schema.role_table_grants
     where grantee = 'anon' and table_schema = 'public' $$,
  'anon has no privileges on public tables'
);

select is_empty(
  $$ select p.proname
     from pg_proc p
     where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
       and has_function_privilege('anon', p.oid, 'execute') $$,
  'anon cannot execute any public or private function'
);

select ok(not has_schema_privilege('anon', 'private', 'usage'), 'anon has no usage on schema private');

-- authenticated: exact table privileges.
select set_eq(
  $$ select table_name::text, privilege_type::text
     from information_schema.role_table_grants
     where grantee = 'authenticated' and table_schema = 'public' $$,
  $$ values ('workspaces', 'SELECT'),
            ('profiles', 'SELECT'),
            ('workspace_members', 'SELECT'),
            ('workspace_members', 'DELETE'),
            ('audit_events', 'SELECT'),
            ('clients', 'SELECT'),
            ('contacts', 'SELECT'),
            ('pipeline_stages', 'SELECT'),
            ('pipeline_stages', 'DELETE'),
            ('leads', 'SELECT'),
            ('activities', 'SELECT'),
            ('follow_ups', 'SELECT'),
            ('services', 'SELECT'),
            ('packages', 'SELECT'),
            ('package_services', 'SELECT'),
            ('package_services', 'DELETE'),
            ('blueprints', 'SELECT'),
            ('blueprint_versions', 'SELECT'),
            ('blueprint_versions', 'DELETE'),
            ('task_templates', 'SELECT'),
            ('task_templates', 'DELETE'),
            ('task_template_dependencies', 'SELECT'),
            ('task_template_dependencies', 'DELETE'),
            ('input_templates', 'SELECT'),
            ('input_templates', 'DELETE'),
            ('sow_documents', 'SELECT'),
            ('projects', 'SELECT'),
            ('project_tasks', 'SELECT'),
            ('task_dependencies', 'SELECT'),
            ('client_input_requests', 'SELECT'),
            ('approvals', 'SELECT'),
            ('approval_responses', 'SELECT'),
            ('client_requests', 'SELECT'),
            ('client_files', 'SELECT'),
            ('client_files', 'DELETE'),
            ('task_readiness', 'SELECT'),
            ('project_progress', 'SELECT'),
            ('routines', 'SELECT'),
            ('routine_runs', 'SELECT'),
            ('diagnostics', 'SELECT'),
            ('issues', 'SELECT'),
            ('invoices', 'SELECT'),
            ('pipeline_summary', 'SELECT'),
            ('project_health', 'SELECT'),
            ('overdue_tasks', 'SELECT'),
            ('routine_compliance', 'SELECT'),
            ('open_issues_by_severity', 'SELECT'),
            ('receivables_by_status', 'SELECT'),
            ('agents', 'SELECT'),
            ('ai_budgets', 'SELECT'),
            ('agent_work_items', 'SELECT'),
            ('proposed_actions', 'SELECT'),
            ('ai_usage', 'SELECT'),
            ('ai_spend_this_month', 'SELECT'),
            ('job_attempts', 'SELECT'),
            ('connection_brakes', 'SELECT'),
            ('result_rows', 'SELECT'),
            ('messages', 'SELECT') $$,
  'authenticated has only the documented table privileges'
);

select set_eq(
  $$ select table_name::text, column_name::text, privilege_type::text
     from information_schema.role_column_grants
     where grantee = 'authenticated' and table_schema = 'public'
       and table_name in ('workspaces', 'profiles', 'workspace_members', 'audit_events')
       and privilege_type in ('INSERT', 'UPDATE') $$,
  $$ values ('workspaces', 'name', 'UPDATE'),
            ('workspaces', 'timezone', 'UPDATE'),
            ('profiles', 'display_name', 'UPDATE'),
            ('workspace_members', 'workspace_id', 'INSERT'),
            ('workspace_members', 'user_id', 'INSERT'),
            ('workspace_members', 'role', 'INSERT'),
            ('workspace_members', 'status', 'INSERT'),
            ('workspace_members', 'role', 'UPDATE'),
            ('workspace_members', 'status', 'UPDATE') $$,
  'authenticated has only the documented column-level write privileges (M1 tables)'
);

select ok(
  not has_function_privilege('authenticated', 'private.log_event(uuid, text, text, uuid, jsonb, jsonb)', 'execute'),
  'authenticated cannot call private.log_event directly'
);

-- Every table in public has RLS enabled.
select is_empty(
  $$ select relname from pg_class
     where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity $$,
  'RLS is enabled on every public table'
);

-- anon queries fail outright.
select pg_temp.as_anon();
select throws_ok($$ select * from public.workspaces $$, '42501', null, 'anon cannot read workspaces');
select throws_ok($$ select * from public.workspace_members $$, '42501', null, 'anon cannot read memberships');
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select * from public.audit_events $$, '42501', null, 'anon cannot read audit events');
select throws_ok(
  $$ select private.has_role('a0000000-0000-4000-8000-000000000001', 'viewer') $$,
  '42501', null, 'anon cannot call private.has_role'
);
reset role;

-- Security-definer functions pin search_path.
select is_empty(
  $$ select p.proname from pg_proc p
     where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace, 'worker'::regnamespace)
       and p.prosecdef
       and not coalesce(p.proconfig, '{}') @> array['search_path=""'] $$,
  'every security definer function sets search_path to empty'
);

select is_empty(
  $$ select p.proname from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prosecdef $$,
  'no security definer functions are exposed in public'
);

select * from finish();
rollback;
