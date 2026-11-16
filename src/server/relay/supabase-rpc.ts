import { z } from "zod";

import type { BeginResult, ClaimedJob, WorkerDb } from "../../../worker/db";

export type Rpc = (fn: string, args: Record<string, unknown>) => Promise<unknown>;

const BEGIN: readonly BeginResult[] = ["ok", "braked", "already_sent", "not_held"];

// PostgREST as the service role. The error names the function and status, never the body or key.
export function createSupabaseRpc(
  database: { url: string; secret: string },
  fetchImpl: typeof fetch = fetch,
): Rpc {
  const base = new URL(database.url);
  return async (fn, args) => {
    const res = await fetchImpl(new URL(`/rest/v1/rpc/${fn}`, base), {
      method: "POST",
      headers: {
        apikey: database.secret,
        Authorization: `Bearer ${database.secret}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Relay database call ${fn} failed (HTTP ${res.status})`);
    return res.json() as Promise<unknown>;
  };
}

export function parseClaimedGrokJobs(raw: unknown): {
  jobs: ClaimedJob[];
  unreadableIds: string[];
} {
  if (!Array.isArray(raw)) throw new Error("Relay claim returned an unexpected shape");
  const jobs: ClaimedJob[] = [];
  const unreadableIds: string[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      throw new Error("Relay claim returned an unexpected shape");
    }
    const rec = item as Record<string, unknown>;
    if (rec.kind !== "grok.dispatch") {
      throw new Error("Relay claim returned a job it must not handle");
    }
    const id = typeof rec.id === "string" && z.uuid().safeParse(rec.id).success ? rec.id : null;
    const payloadOk =
      typeof rec.payload === "object" && rec.payload !== null && !Array.isArray(rec.payload);
    const attemptsOk =
      typeof rec.attempts === "number" && Number.isInteger(rec.attempts) && rec.attempts >= 1;
    if (!id || !payloadOk || !attemptsOk) {
      if (id) unreadableIds.push(id);
      else throw new Error("Relay claim returned an unreadable job");
      continue;
    }
    jobs.push({
      id,
      kind: "grok.dispatch",
      attempts: rec.attempts as number,
      payload: rec.payload as Record<string, unknown>,
    });
  }
  return { jobs, unreadableIds };
}

function asBegin(value: unknown): BeginResult {
  if (typeof value === "string" && (BEGIN as readonly string[]).includes(value))
    return value as BeginResult;
  throw new Error("Relay begin_dispatch returned an unexpected shape");
}

export type RelayWorkerDb = Pick<
  WorkerDb,
  "beginDispatch" | "markWaiting" | "failJob" | "acceptResult"
> & {
  claimGrok(worker: string, limit: number): Promise<ClaimedJob[]>;
};

export function createRelayWorkerDb(rpc: Rpc): RelayWorkerDb {
  return {
    async claimGrok(worker, limit) {
      const raw = await rpc("relay_claim_grok_jobs", { p_worker: worker, p_limit: limit });
      const { jobs, unreadableIds } = parseClaimedGrokJobs(raw);
      for (const id of unreadableIds) {
        await rpc("relay_fail_job", {
          p_job_id: id,
          p_worker: worker,
          p_error: "Relay could not read this job",
          p_retryable: false,
        });
      }
      return jobs;
    },
    async beginDispatch(jobId, worker, codeSha256, waitSeconds) {
      return asBegin(
        await rpc("relay_begin_dispatch", {
          p_job_id: jobId,
          p_worker: worker,
          p_code_sha256: codeSha256,
          p_wait_seconds: waitSeconds,
        }),
      );
    },
    async markWaiting(jobId, worker, externalRef) {
      const value = await rpc("relay_mark_waiting", {
        p_job_id: jobId,
        p_worker: worker,
        p_external_ref: externalRef,
      });
      if (typeof value !== "boolean")
        throw new Error("Relay mark_waiting returned an unexpected shape");
      return value;
    },
    async failJob(jobId, worker, error) {
      await rpc("relay_fail_job", {
        p_job_id: jobId,
        p_worker: worker,
        p_error: error,
        p_retryable: false,
      });
    },
    async acceptResult(row) {
      const value = await rpc("relay_accept_result", {
        p_row_key: row.rowKey,
        p_job_id: row.jobId,
        p_code: row.code,
        p_from: row.from,
        p_kind: row.kind,
        p_client: row.client,
        p_text: row.text,
      });
      if (typeof value !== "string")
        throw new Error("Relay accept_result returned an unexpected shape");
      return value;
    },
  };
}
