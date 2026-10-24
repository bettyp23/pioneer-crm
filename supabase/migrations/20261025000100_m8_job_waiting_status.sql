-- M8 (Pioneer loop): a job can wait for a reply from an outside system (the Agency Dashboard
-- sheet). Separate migration because a new enum value can't be used in the transaction that
-- adds it.
alter type public.job_status add value if not exists 'waiting_external' after 'running';
