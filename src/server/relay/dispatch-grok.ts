import type { ClaimedJob } from "../../../worker/db";
import { handleSend, type DispatchDb, type Outcome, type Senders } from "../../../worker/handlers";
import { callGrok } from "../../../worker/senders";

import { HOSTED_WORKER_NAME, readGrokWebhook, readRelayDatabase } from "./secrets";
import { createRelayWorkerDb, createSupabaseRpc, type Rpc } from "./supabase-rpc";

export type DispatchReport =
  { skipped: true; outcomes: [] } | { skipped: false; outcomes: Outcome[] };

// One pass over queued Michael Scott sends. Claim is SKIP LOCKED and begin_dispatch records
// the one-time code, so the Mac worker cannot send the same job. Missing settings leave the
// queue untouched for the Mac (or for a later pass once the settings exist).
export async function dispatchQueuedGrok(deps: {
  claim: (worker: string, limit: number) => Promise<ClaimedJob[]>;
  db: DispatchDb;
  sendGrok: Senders["grok"];
  worker?: string;
  newCode?: () => string;
}): Promise<DispatchReport> {
  if (!deps.sendGrok) return { skipped: true, outcomes: [] };
  const worker = deps.worker ?? HOSTED_WORKER_NAME;
  const jobs = await deps.claim(worker, 5);
  const outcomes: Outcome[] = [];
  for (const job of jobs) {
    outcomes.push(
      await handleSend(job, worker, deps.db, { claude: null, grok: deps.sendGrok }, deps.newCode),
    );
  }
  return { skipped: false, outcomes };
}

export async function dispatchQueuedGrokFromEnv(options?: {
  env?: Record<string, string | undefined>;
  rpc?: Rpc;
  fetchImpl?: typeof fetch;
  newCode?: () => string;
}): Promise<DispatchReport> {
  const env = options?.env ?? process.env;
  const grok = readGrokWebhook(env);
  const database = readRelayDatabase(env);
  if (!grok || !database) return { skipped: true, outcomes: [] };
  const fetchImpl = options?.fetchImpl ?? fetch;
  const rpc = options?.rpc ?? createSupabaseRpc(database, fetchImpl);
  const db = createRelayWorkerDb(rpc);
  return dispatchQueuedGrok({
    claim: (worker, limit) => db.claimGrok(worker, limit),
    db,
    sendGrok: (body) => callGrok(grok, body, fetchImpl),
    newCode: options?.newCode,
  });
}
