-- Pioneer OS — M1 step 1: extensions, private schema, default privileges, shared triggers.
-- See docs/schema.md §1, §3 and §9.

create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Default privileges: nothing created by migrations is reachable by the API
-- roles until it is granted explicitly (docs/schema.md §9).
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role, public;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role, public;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role, public;
-- Functions are executable by PUBLIC unless revoked; applies to every schema.
alter default privileges for role postgres
  revoke execute on functions from public;

revoke create on schema public from public;

-- ---------------------------------------------------------------------------
-- private schema: helper and trigger functions, not exposed by the Data API.
-- `authenticated` needs USAGE so RLS policies can call private.has_role() etc.
-- ---------------------------------------------------------------------------
create schema private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- updated_at maintenance
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Optimistic concurrency: rule-bearing rows carry `version`, bumped on every update.
create function private.bump_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;

-- MFA: true only when the caller's session completed TOTP (D-1).
create function private.is_mfa()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal') = 'aal2', false);
$$;

revoke all on function private.is_mfa() from public, anon;
grant execute on function private.is_mfa() to authenticated;

-- Validates IANA timezone names (used by check constraints).
create function private.is_valid_timezone(tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

revoke all on function private.is_valid_timezone(text) from public, anon;
-- Check constraints run with the writer's privileges.
grant execute on function private.is_valid_timezone(text) to authenticated, service_role;
