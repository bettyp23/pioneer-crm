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
