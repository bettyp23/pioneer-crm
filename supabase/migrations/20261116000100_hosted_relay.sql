-- Hosted relay: the Vercel app dispatches Michael Scott messages and accepts his replies.
-- The Mac worker keeps using worker.* directly. Both paths take the same locks, so a job is
-- sent once. These wrappers add no checks of their own; worker.begin_dispatch and
-- worker.accept_result still decide.
--
-- public wrappers are security invoker (nothing security-definer is exposed in public).
-- service_role can execute them and the worker functions they call. It still has no table
-- grants. anon and authenticated cannot call them.

grant usage on schema worker to service_role;

-- Claim only grok.dispatch, and at most five, so this path cannot take Claude jobs.
create function worker.claim_grok_jobs(p_worker text, p_limit int)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id,
      'kind', c.kind,
      'attempts', c.attempts,
      'payload', c.payload
    ) order by c.priority, c.created_at)
    from worker.claim_jobs(
      p_worker,
      array['grok.dispatch'],
      greatest(1, least(coalesce(p_limit, 1), 5))
    ) as c
  ), '[]'::jsonb);
$$;

revoke all on function worker.claim_grok_jobs(text, int) from public, anon, authenticated, pioneer_worker;
grant execute on function worker.claim_grok_jobs(text, int) to service_role;

grant execute on function worker.begin_dispatch(uuid, text, text, int) to service_role;
grant execute on function worker.mark_waiting(uuid, text, text) to service_role;
grant execute on function worker.fail_job(uuid, text, text, boolean) to service_role;
grant execute on function worker.accept_result(text, uuid, text, text, text, text, text) to service_role;

create function public.relay_claim_grok_jobs(p_worker text, p_limit int)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select worker.claim_grok_jobs(p_worker, p_limit); $$;

create function public.relay_begin_dispatch(p_job_id uuid, p_worker text, p_code_sha256 text, p_wait_seconds int)
returns text
language sql
security invoker
set search_path = ''
as $$ select worker.begin_dispatch(p_job_id, p_worker, p_code_sha256, p_wait_seconds); $$;

create function public.relay_mark_waiting(p_job_id uuid, p_worker text, p_external_ref text)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select worker.mark_waiting(p_job_id, p_worker, p_external_ref); $$;

create function public.relay_fail_job(p_job_id uuid, p_worker text, p_error text, p_retryable boolean)
returns text
language sql
security invoker
set search_path = ''
as $$ select worker.fail_job(p_job_id, p_worker, p_error, p_retryable)::text; $$;

create function public.relay_accept_result(
  p_row_key text, p_job_id uuid, p_code text, p_from text, p_kind text, p_client text, p_text text)
returns text
language sql
security invoker
set search_path = ''
as $$ select worker.accept_result(p_row_key, p_job_id, p_code, p_from, p_kind, p_client, p_text); $$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.relay_claim_grok_jobs(text, int)',
    'public.relay_begin_dispatch(uuid, text, text, int)',
    'public.relay_mark_waiting(uuid, text, text)',
    'public.relay_fail_job(uuid, text, text, boolean)',
    'public.relay_accept_result(text, uuid, text, text, text, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, pioneer_worker', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;
