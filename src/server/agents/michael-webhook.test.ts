import { describe, expect, it, vi } from "vitest";

import { deliverToMichael, MAX_ATTEMPTS, michaelPayload } from "./michael-webhook";
import { fakeStore, MESSAGE, THREAD } from "./test-helpers";

const target = { url: "https://grok.example.test/hook", key: "secret-webhook-key" };
const replyUrl = "https://os.pioneerdigitalai.com/api/agent-reply";
const respond = (...statuses: (number | Error)[]) => {
  const queue = [...statuses];
  return vi.fn<typeof fetch>(async () => {
    const next = queue.shift() ?? 500;
    if (next instanceof Error) throw next;
    return new Response(null, { status: next });
  });
};

function run(fetchImpl: typeof fetch, store = fakeStore()) {
  const sleep = vi.fn<(ms: number) => Promise<void>>(async () => undefined);
  const log = vi.fn();
  return {
    store,
    sleep,
    log,
    result: deliverToMichael(MESSAGE, { store, target, replyUrl, fetchImpl, sleep, log }),
  };
}

describe("outbound to Michael", () => {
  it("posts the agreed body with the bearer key and an idempotency key", async () => {
    const fetchImpl = respond(200);
    const { store, result } = run(fetchImpl);
    expect(await result).toBe("delivered");
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(target.url);
    const headers = init?.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${target.key}`);
    expect(headers["idempotency-key"]).toBe(MESSAGE);
    expect(JSON.parse(String(init?.body))).toEqual({
      type: "chat",
      thread_id: THREAD,
      message_id: MESSAGE,
      from: "bettina",
      text: "Plan the Northwind site",
      sent_at: "2026-11-23T12:00:00.000Z",
      reply_url: replyUrl,
    });
    expect(store.finishDelivery).toHaveBeenCalledWith(MESSAGE, true, 1);
  });

  it("retries 5xx and network errors with growing backoff, then succeeds", async () => {
    const { store, sleep, result } = run(respond(503, new TypeError("fetch failed"), 502, 200));
    expect(await result).toBe("delivered");
    expect(store.finishDelivery).toHaveBeenCalledWith(MESSAGE, true, 4);
    const waits = sleep.mock.calls.map((c) => c[0]);
    expect(waits).toHaveLength(3);
    expect(waits[0]).toBeGreaterThanOrEqual(1000);
    expect(waits[1]).toBeGreaterThanOrEqual(2000);
    expect(waits[2]).toBeGreaterThanOrEqual(4000);
  });

  it("gives up after the last attempt and records the failure", async () => {
    const fetchImpl = respond(500, 500, 500, 500, 500);
    const { store, result } = run(fetchImpl);
    expect(await result).toBe("failed");
    expect(fetchImpl).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(store.finishDelivery).toHaveBeenCalledWith(
      MESSAGE,
      false,
      MAX_ATTEMPTS,
      "Michael's webhook answered HTTP 500",
    );
  });

  it("does not retry other 4xx (e.g. a wrong key)", async () => {
    const fetchImpl = respond(401);
    const { store, result } = run(fetchImpl);
    expect(await result).toBe("failed");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(store.finishDelivery).toHaveBeenCalledWith(
      MESSAGE,
      false,
      1,
      "Michael's webhook answered HTTP 401",
    );
  });

  it("never sends the same message twice", async () => {
    const store = fakeStore();
    const fetchImpl = respond(200, 200);
    const first = run(fetchImpl, store);
    expect(await first.result).toBe("delivered");
    const second = run(fetchImpl, store);
    expect(await second.result).toBe("skipped");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("concurrent sends of one message post it once", async () => {
    const store = fakeStore();
    const fetchImpl = respond(200, 200);
    const [a, b] = await Promise.all([run(fetchImpl, store).result, run(fetchImpl, store).result]);
    expect([a, b].sort()).toEqual(["delivered", "skipped"]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fails without calling out when the webhook isn't configured", async () => {
    const store = fakeStore();
    const fetchImpl = respond(200);
    const out = await deliverToMichael(MESSAGE, {
      store,
      target: null,
      replyUrl,
      fetchImpl,
      log: vi.fn(),
    });
    expect(out).toBe("failed");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("logs ids and outcomes only", async () => {
    const { log, result } = run(respond(200));
    await result;
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain(target.key);
    expect(logged).not.toContain(target.url);
    expect(logged).not.toContain("Northwind");
  });

  it("marks Hermes-routed messages as from hermes", () => {
    const p = michaelPayload(
      {
        id: MESSAGE,
        threadId: THREAD,
        body: "x",
        createdAt: "2026-11-23T12:00:00Z",
        sentFrom: "hermes",
      },
      replyUrl,
    );
    expect(p.from).toBe("hermes");
  });
});
