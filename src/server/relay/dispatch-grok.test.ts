import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { WAIT_SECONDS } from "../../../worker/handlers";
import type { ClaimedJob } from "../../../worker/db";

import { dispatchQueuedGrok, dispatchQueuedGrokFromEnv } from "./dispatch-grok";
import { HOSTED_WORKER_NAME } from "./secrets";
import { parseClaimedGrokJobs, type Rpc } from "./supabase-rpc";

const job: ClaimedJob = {
  id: "22222222-2222-4222-8222-222222222222",
  kind: "grok.dispatch",
  attempts: 1,
  payload: { message_id: "m2", client: "Test Client", task: "Synthetic: draft a follow-up" },
};

function db(begin: "ok" | "braked" | "already_sent" | "not_held" = "ok") {
  return {
    beginDispatch: vi.fn(async () => begin),
    markWaiting: vi.fn(async () => true),
    failJob: vi.fn(async () => undefined),
  };
}

describe("dispatchQueuedGrok", () => {
  it("sends each claimed job once, with the same code hash and 24 hour wait as the Mac worker", async () => {
    const store = db();
    const sendGrok = vi.fn(async () => ({ ok: true as const, externalRef: null }));
    const report = await dispatchQueuedGrok({
      claim: async () => [job],
      db: store,
      sendGrok,
      newCode: () => "code-456",
    });
    expect(report).toEqual({ skipped: false, outcomes: ["sent"] });
    expect(store.beginDispatch).toHaveBeenCalledWith(
      job.id,
      HOSTED_WORKER_NAME,
      createHash("sha256").update("code-456").digest("hex"),
      WAIT_SECONDS["grok.dispatch"],
    );
    expect(sendGrok).toHaveBeenCalledTimes(1);
    expect(sendGrok).toHaveBeenCalledWith({
      job_id: job.id,
      code: "code-456",
      client: "Test Client",
      task: "Synthetic: draft a follow-up",
      blueprint_id: null,
    });
    expect(store.markWaiting).toHaveBeenCalledWith(job.id, HOSTED_WORKER_NAME, null);
  });

  it("sends nothing when the Mac worker already claimed the queue", async () => {
    const store = db();
    const sendGrok = vi.fn();
    const report = await dispatchQueuedGrok({ claim: async () => [], db: store, sendGrok });
    expect(report.outcomes).toEqual([]);
    expect(sendGrok).not.toHaveBeenCalled();
    expect(store.beginDispatch).not.toHaveBeenCalled();
  });

  it("does not call the webhook when the loop brake trips", async () => {
    const store = db("braked");
    const sendGrok = vi.fn();
    const report = await dispatchQueuedGrok({ claim: async () => [job], db: store, sendGrok });
    expect(report.outcomes).toEqual(["braked"]);
    expect(sendGrok).not.toHaveBeenCalled();
    expect(store.failJob).not.toHaveBeenCalled();
  });

  it("does not call the webhook when this attempt was already sent", async () => {
    const store = db("already_sent");
    const sendGrok = vi.fn();
    const report = await dispatchQueuedGrok({ claim: async () => [job], db: store, sendGrok });
    expect(report.outcomes).toEqual(["failed"]);
    expect(sendGrok).not.toHaveBeenCalled();
    expect(store.failJob).toHaveBeenCalled();
  });

  it("leaves the queue alone when the webhook is not configured", async () => {
    const claim = vi.fn();
    const report = await dispatchQueuedGrok({
      claim,
      db: db(),
      sendGrok: null,
    });
    expect(report).toEqual({ skipped: true, outcomes: [] });
    expect(claim).not.toHaveBeenCalled();
  });
});

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "service-secret",
  GROK_WEBHOOK_URL: "https://grok.example/hook",
  GROK_WEBHOOK_KEY: "webhook-key",
};

function rpcRecording(begin: string): {
  rpc: Rpc;
  calls: { fn: string; args: Record<string, unknown> }[];
} {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const rpc: Rpc = async (fn, args) => {
    calls.push({ fn, args });
    if (fn === "relay_claim_grok_jobs") return [job];
    if (fn === "relay_begin_dispatch") return begin;
    if (fn === "relay_mark_waiting") return true;
    if (fn === "relay_fail_job") return "failed";
    throw new Error(`unexpected ${fn}`);
  };
  return { rpc, calls };
}

describe("dispatchQueuedGrokFromEnv", () => {
  it("posts the webhook with the bearer key and does not claim when settings are missing", async () => {
    const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response("{}", { status: 200 }),
    );
    const { rpc, calls } = rpcRecording("ok");
    const sent = await dispatchQueuedGrokFromEnv({
      env,
      rpc,
      fetchImpl,
      newCode: () => "code-456",
    });
    expect(sent.outcomes).toEqual(["sent"]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://grok.example/hook");
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer webhook-key");
    expect(JSON.parse(String(init?.body))).toMatchObject({ job_id: job.id, code: "code-456" });
    expect(calls[0]).toMatchObject({
      fn: "relay_claim_grok_jobs",
      args: { p_worker: HOSTED_WORKER_NAME, p_limit: 5 },
    });

    const boom = vi.fn<Rpc>(async () => {
      throw new Error("should not be called");
    });
    const skipped = await dispatchQueuedGrokFromEnv({
      env: { ...env, GROK_WEBHOOK_KEY: "" },
      rpc: boom,
      fetchImpl,
    });
    expect(skipped).toEqual({ skipped: true, outcomes: [] });
    expect(boom).not.toHaveBeenCalled();
    const skippedDb = await dispatchQueuedGrokFromEnv({
      env: { ...env, SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "" },
      rpc: boom,
      fetchImpl,
    });
    expect(skippedDb.skipped).toBe(true);
  });

  it("fails a refused webhook once and does not mark the job waiting", async () => {
    const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response("no", { status: 503 }),
    );
    const { rpc, calls } = rpcRecording("ok");
    const report = await dispatchQueuedGrokFromEnv({ env, rpc, fetchImpl, newCode: () => "c" });
    expect(report.outcomes).toEqual(["failed"]);
    expect(calls.some((c) => c.fn === "relay_mark_waiting")).toBe(false);
    expect(calls.some((c) => c.fn === "relay_fail_job")).toBe(true);
    const fail = calls.find((c) => c.fn === "relay_fail_job");
    expect(String(fail?.args.p_error)).toMatch(/HTTP 503/);
    expect(String(fail?.args.p_error)).not.toContain("webhook-key");
  });
});

describe("parseClaimedGrokJobs", () => {
  it("keeps readable grok jobs and reports an unreadable one by id", () => {
    const parsed = parseClaimedGrokJobs([
      job,
      { id: job.id, kind: "grok.dispatch", attempts: 1, payload: "nope" },
    ]);
    expect(parsed.jobs).toHaveLength(1);
    expect(parsed.unreadableIds).toEqual([job.id]);
  });

  it("refuses a job that is not a Michael Scott send", () => {
    expect(() => parseClaimedGrokJobs([{ ...job, kind: "claude.task" }])).toThrow(
      /must not handle/,
    );
  });
});
