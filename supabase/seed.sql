-- Pioneer OS — LOCAL DEVELOPMENT SEED. Synthetic data only (docs/security.md §6).
-- Never run against staging or production: passwords and TOTP secrets below are public.
--
-- Users (password for all: local-dev-password)
--   owner@example.test     owner of "Demo Workspace", TOTP enrolled
--   viewer@example.test    viewer of "Demo Workspace", TOTP enrolled
--   enroll@example.test    member of "Demo Workspace", no TOTP yet (exercises enrollment)
--   outsider@example.test  no membership, TOTP enrolled
-- TOTP secret for enrolled users: tests/e2e/fixtures.ts (LOCAL_TOTP_SECRET).

do $$
declare
  pw text := extensions.crypt('local-dev-password', extensions.gen_salt('bf'));
  totp_secret text := 'PIONEERLOCALDEVTOTPSECRET234567A';
  u record;
begin
  for u in
    select * from (values
      ('00000000-0000-4000-8000-000000000001'::uuid, 'owner@example.test',    'Demo Owner',    true),
      ('00000000-0000-4000-8000-000000000002'::uuid, 'viewer@example.test',   'Demo Viewer',   true),
      ('00000000-0000-4000-8000-000000000003'::uuid, 'enroll@example.test',   'Demo Enrollee', false),
      ('00000000-0000-4000-8000-000000000004'::uuid, 'outsider@example.test', 'Demo Outsider', true)
    ) as t(id, email, display_name, has_totp)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, pw, now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
    values (
      u.id::text, u.id,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email', now(), now()
    );

    if u.has_totp then
      insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
      values (gen_random_uuid(), u.id, 'Seeded authenticator', 'totp', 'verified', now(), now(), totp_secret);
    end if;

    insert into public.profiles (user_id, display_name) values (u.id, u.display_name);
  end loop;
end;
$$;

insert into public.workspaces (id, name, slug, timezone)
values ('10000000-0000-4000-8000-000000000001', 'Demo Workspace', 'demo', 'America/New_York');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'owner'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'viewer'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'member');

-- ── M2 demo data (synthetic; local only) ────────────────────────────────────
do $$
declare
  ws uuid := '10000000-0000-4000-8000-000000000001';
  owner_id uuid := '00000000-0000-4000-8000-000000000001';
  stage record;
  c1 uuid; c2 uuid; c3 uuid; p1 uuid; p2 uuid; l1 uuid; l2 uuid;
begin
  insert into public.clients (workspace_id, name, kind, status, industry, website_url, drive_folder_url, created_by)
  values (ws, 'Northwind Example Bakery', 'organization', 'prospect', 'Food & beverage',
          'https://northwind.example', 'https://drive.google.com/drive/folders/example-northwind', owner_id)
  returning id into c1;
  insert into public.clients (workspace_id, name, kind, status, industry, created_by)
  values (ws, 'Contoso Example Dental', 'organization', 'active', 'Healthcare (business info only)', owner_id)
  returning id into c2;
  insert into public.clients (workspace_id, name, kind, status, created_by)
  values (ws, 'Sam Example Consulting', 'individual', 'prospect', owner_id)
  returning id into c3;

  insert into public.contacts (workspace_id, client_id, first_name, last_name, email, job_title, is_primary, created_by)
  values (ws, c1, 'Avery', 'Example', 'avery@northwind.example', 'Owner', true, owner_id) returning id into p1;
  insert into public.contacts (workspace_id, client_id, first_name, last_name, email, job_title, is_primary, created_by)
  values (ws, c2, 'Jordan', 'Example', 'jordan@contoso.example', 'Office manager', true, owner_id) returning id into p2;

  select id into stage from public.pipeline_stages where workspace_id = ws and name = 'Discovery';
  insert into public.leads (workspace_id, client_id, primary_contact_id, title, source, stage_id,
                            estimated_value_minor, expected_close_on, owner_user_id, created_by)
  values (ws, c1, p1, 'Website and online ordering', 'Referral', stage.id, 850000,
          current_date + 30, owner_id, owner_id) returning id into l1;
  select id into stage from public.pipeline_stages where workspace_id = ws and name = 'Proposal';
  insert into public.leads (workspace_id, client_id, primary_contact_id, title, source, stage_id,
                            estimated_value_minor, owner_user_id, created_by)
  values (ws, c2, p2, 'Patient intake automation', 'Website form', stage.id, 1500000, owner_id, owner_id)
  returning id into l2;
  select id into stage from public.pipeline_stages where workspace_id = ws and name = 'Inquiry';
  insert into public.leads (workspace_id, client_id, title, source, stage_id, created_by)
  values (ws, c3, 'AI assistant pilot', 'LinkedIn', stage.id, owner_id);

  insert into public.activities (workspace_id, client_id, lead_id, contact_id, type, subject, body, occurred_at, created_by)
  values (ws, c1, l1, p1, 'call', 'Discovery call', 'Synthetic note: discussed ordering workflow.',
          now() - interval '2 days', owner_id);

  insert into public.follow_ups (workspace_id, client_id, lead_id, title, due_on, assignee_user_id, created_by) values
    (ws, c1, l1, 'Send discovery summary', current_date - 1, owner_id, owner_id),
    (ws, c2, l2, 'Check proposal questions', current_date, owner_id, owner_id),
    (ws, c3, null, 'Book intro call', current_date + 3, owner_id, owner_id);
end;
$$;

-- ── M3 demo catalog and blueprint (synthetic; local only) ──────────────────
do $$
declare
  ws uuid := '10000000-0000-4000-8000-000000000001';
  owner_id uuid := '00000000-0000-4000-8000-000000000001';
  s1 uuid; s2 uuid; p1 uuid; bp uuid; v1 uuid; t1 uuid; t2 uuid; t3 uuid; t4 uuid;
begin
  insert into public.services (workspace_id, code, name, category, description)
  values (ws, 'website-build', 'Website build', 'Web', 'Synthetic example service.') returning id into s1;
  insert into public.services (workspace_id, code, name, category)
  values (ws, 'ai-assistant', 'AI assistant setup', 'AI') returning id into s2;
  insert into public.packages (workspace_id, name, description)
  values (ws, 'Launch bundle', 'Synthetic example package.') returning id into p1;
  insert into public.package_services (workspace_id, package_id, service_id, quantity, position) values
    (ws, p1, s1, 1, 1), (ws, p1, s2, 1, 2);

  insert into public.blueprints (workspace_id, service_id, name, description, created_by)
  values (ws, s1, 'Website delivery', 'Synthetic example blueprint.', owner_id) returning id into bp;
  insert into public.blueprint_versions (workspace_id, blueprint_id, version_number, created_by)
  values (ws, bp, 1, owner_id) returning id into v1;
  insert into public.task_templates (workspace_id, blueprint_version_id, key, title, phase, position, estimated_hours, due_offset_days)
  values (ws, v1, 'kickoff', 'Kickoff call', 'Plan', 1, 1, 0) returning id into t1;
  insert into public.task_templates (workspace_id, blueprint_version_id, key, title, phase, position, estimated_hours, due_offset_days, requires_approval, approval_approver)
  values (ws, v1, 'sitemap', 'Sitemap and wireframes', 'Plan', 2, 6, 7, true, 'client') returning id into t2;
  insert into public.task_templates (workspace_id, blueprint_version_id, key, title, phase, position, estimated_hours, due_offset_days)
  values (ws, v1, 'build', 'Build pages', 'Build', 3, 20, 21) returning id into t3;
  insert into public.task_templates (workspace_id, blueprint_version_id, key, title, phase, position, estimated_hours, due_offset_days, requires_approval, approval_approver)
  values (ws, v1, 'launch', 'Launch', 'Ship', 4, 2, 28, true, 'internal') returning id into t4;
  insert into public.task_template_dependencies (workspace_id, blueprint_version_id, task_template_id, depends_on_id) values
    (ws, v1, t2, t1), (ws, v1, t3, t2), (ws, v1, t4, t3);
  insert into public.input_templates (workspace_id, blueprint_version_id, key, label, input_kind, blocks_task_template_id) values
    (ws, v1, 'brand_assets', 'Logo and brand files (Drive link)', 'file', t3),
    (ws, v1, 'hosting_access', 'Hosting access — where the credential is stored', 'access_confirmation', t4);

  update public.blueprint_versions
    set status = 'published', change_summary = 'Initial version', published_at = now(), published_by = owner_id,
        content_hash = encode(extensions.digest(private.blueprint_version_content(v1)::text, 'sha256'), 'hex')
    where id = v1;
end;
$$;

-- ── M4 demo SOW and project (synthetic; local only) ─────────────────────────
-- Generated through the real function, acting as the demo owner with MFA.
do $$
declare
  ws uuid := '10000000-0000-4000-8000-000000000001';
  owner_id uuid := '00000000-0000-4000-8000-000000000001';
  c uuid; sow uuid; v uuid; p uuid; t record;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', owner_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);

  select id into c from public.clients where workspace_id = ws and name = 'Northwind Example Bakery';
  insert into public.sow_documents (workspace_id, client_id, title, version_label, drive_url, status, scope_summary, created_by)
  values (ws, c, 'Website and online ordering SOW', 'v1', 'https://drive.google.com/file/d/example-sow', 'sent',
          'Synthetic scope summary.', owner_id)
  returning id into sow;
  update public.sow_documents set status = 'signed', signed_on = current_date - 3, client_signatory = 'Avery Example'
    where id = sow;

  select bv.id into v from public.blueprint_versions bv join public.blueprints b on b.id = bv.blueprint_id
    where b.workspace_id = ws and b.name = 'Website delivery' and bv.status = 'published';
  p := public.generate_project(c, v, 'Northwind website', current_date - 3,
    '20000000-0000-4000-8000-000000000001', sow);

  -- Kickoff done so the board shows progress.
  select * into t from public.project_tasks where project_id = p and key = 'kickoff';
  perform public.transition_task(t.id, 'in_progress', t.version);
  perform public.transition_task(t.id, 'in_review', t.version + 1);
  perform public.transition_task(t.id, 'done', t.version + 2);

  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ── M5 demo operations (synthetic; local only) ─────────────────────────────
do $$
declare
  ws uuid := '10000000-0000-4000-8000-000000000001';
  owner_id uuid := '00000000-0000-4000-8000-000000000001';
  c1 uuid; c2 uuid; d uuid; r1 uuid;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', owner_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  select id into c1 from public.clients where workspace_id = ws and name = 'Northwind Example Bakery';
  select id into c2 from public.clients where workspace_id = ws and name = 'Contoso Example Dental';

  insert into public.routines (workspace_id, client_id, name, description, cadence, anchor_on, owner_user_id, runbook_url, created_by, created_at)
  values (ws, c1, 'Website backup check', 'Confirm last night''s backup exists.', 'weekly', current_date - 14, owner_id,
          'https://docs.google.com/document/d/example-runbook', owner_id, now() - interval '14 days')
  returning id into r1;
  insert into public.routines (workspace_id, name, cadence, anchor_on, owner_user_id, created_by, created_at)
  values (ws, 'Monthly bookkeeping review', 'monthly', date_trunc('month', current_date)::date, owner_id, owner_id,
          now() - interval '30 days');
  perform public.generate_routine_runs(ws);
  update public.routine_runs set status = 'done', notes = 'Synthetic: backup present'
    where routine_id = r1 and scheduled_for = current_date - 14;

  insert into public.diagnostics (workspace_id, client_id, diagnostic_type, performed_on, performed_by, summary, score, created_by)
  values (ws, c1, 'Website audit', current_date - 5, owner_id, 'Synthetic: slow pages and missing alt text.', 64, owner_id)
  returning id into d;
  insert into public.issues (workspace_id, client_id, diagnostic_id, title, severity, assignee_user_id, created_by) values
    (ws, c1, d, 'Homepage loads in 6 seconds', 'high', owner_id, owner_id),
    (ws, c1, d, 'Images missing alt text', 'medium', null, owner_id);

  insert into public.invoices (workspace_id, client_id, external_system, external_number, issued_on, due_on, amount_minor, status, created_by) values
    (ws, c2, 'quickbooks', 'EX-1001', current_date - 40, current_date - 10, 450000, 'sent', owner_id),
    (ws, c1, 'quickbooks', 'EX-1002', current_date - 3, current_date + 27, 425000, 'sent', owner_id);
  insert into public.invoices (workspace_id, client_id, external_system, external_number, issued_on, due_on, amount_minor, status, paid_on, created_by)
  values (ws, c2, 'quickbooks', 'EX-0999', current_date - 70, current_date - 40, 300000, 'paid', current_date - 38, owner_id);

  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ── M6 demo AI work (synthetic; local only) ────────────────────────────────
do $$
declare
  ws uuid := '10000000-0000-4000-8000-000000000001';
  owner_id uuid := '00000000-0000-4000-8000-000000000001';
  c uuid; agent uuid; w uuid;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', owner_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  select id into c from public.clients where workspace_id = ws and name = 'Northwind Example Bakery';
  select id into agent from public.agents where workspace_id = ws and key = 'client_desk';
  update public.agents set instructions = 'Synthetic example: You are Client Desk for Pioneer Digital AI. Write warm, concise client messages. Never promise prices or dates.'
    where id = agent;

  insert into public.agent_work_items (workspace_id, agent_id, client_id, work_type, title, instructions,
    context_snapshot, sensitivity_flags, prepared_by)
  values (ws, agent, c, 'draft_message', 'Discovery follow-up email',
    'Draft a short follow-up after the discovery call.',
    E'## Client\n- Name: Northwind Example Bakery\n- Type: organization\n- Status: prospect\n- Industry: Food & beverage',
    '[]', owner_id)
  returning id into w;
  perform public.transition_work_item(w, 'ready', 1);
  perform public.transition_work_item(w, 'dispatched', 2);
  perform public.transition_work_item(w, 'returned', 3, null,
    E'Synthetic draft:\nHi Avery, thanks for the discovery call. Next we will share a short plan for online ordering. — Pioneer Digital AI');

  insert into public.proposed_actions (workspace_id, work_item_id, client_id, action_type, title, target, details, requested_by)
  values (ws, w, c, 'send_email', 'Send discovery follow-up', 'avery@northwind.example',
    E'Hi Avery, thanks for the discovery call. Next we will share a short plan for online ordering. — Pioneer Digital AI', owner_id);

  insert into public.ai_usage (workspace_id, provider, work_item_id, cost_microusd, note, recorded_by)
  values (ws, 'xai', w, 120000, 'Synthetic example cost', owner_id);

  perform set_config('request.jwt.claims', '', true);
end;
$$;
