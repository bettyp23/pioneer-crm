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
