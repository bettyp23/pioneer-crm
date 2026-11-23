import { describe, expect, it, vi } from "vitest";

import { createRateLimiter } from "./rate-limit";
import { bearerMatches, clientAddress, handleAgentReply, type ReplyDeps } from "./reply-handler";
import { AgentStoreNotFound } from "./store";
import { fakeStore, MESSAGE, THREAD } from "./test-helpers";

const KEY = "k".repeat(48);
const valid = {
  thread_id: THREAD,
  in_reply_to: MESSAGE,
  from: "michael",
  text: "**Done.** Here's the plan.",
  status: "done",
  links: [{ label: "Plan", url: "https://example.test/plan" }],
};

function deps(over: Partial<ReplyDeps> = {}) {
  const store = fakeStore();
  return {
    store,
    deps: {
      store: () => store,
      key: KEY,
      perClient: createRateLimiter({ limit: 100, windowMs: 60_000 }),
      global: createRateLimiter({ limit: 100, windowMs: 60_000 }),
      log: vi.fn(),
      ...over,
    } satisfies ReplyDeps,
  };
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://x/login/api/agent-reply", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("POST /api/agent-reply: auth", () => {
  it.each([
    ["no header", {}],
    ["wrong key", { authorization: `Bearer ${"x".repeat(48)}` }],
    ["not a bearer", { authorization: KEY }],
    ["empty bearer", { authorization: "Bearer " }],
  ])("rejects %s with 401 and saves nothing", async (_, headers) => {
    const { store, deps: d } = deps();
    const req = new Request("http://x/", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(valid),
    });
    const res = await handleAgentReply(req, d);
    expect(res.status).toBe(401);
    expect(store.recordReply).not.toHaveBeenCalled();
  });

  it("rejects everything when the server has no key configured", async () => {
    const { store, deps: d } = deps({ key: null });
    expect((await handleAgentReply(post(valid), d)).status).toBe(401);
    expect(store.recordReply).not.toHaveBeenCalled();
  });

  it("compares keys of different lengths safely", () => {
    expect(bearerMatches(`Bearer ${KEY}`, KEY)).toBe(true);
    expect(bearerMatches("Bearer short", KEY)).toBe(false);
  });

  it("never echoes the key or the text in responses or logs", async () => {
    const { deps: d } = deps();
    const res = await handleAgentReply(post({ ...valid, status: "nope" }), d);
    const out = (await res.text()) + JSON.stringify((d.log as ReturnType<typeof vi.fn>).mock.calls);
    expect(out).not.toContain(KEY);
    expect(out).not.toContain(valid.text);
  });
});

describe("POST /api/agent-reply: payloads", () => {
  it("saves a valid reply", async () => {
    const { store, deps: d } = deps();
    const res = await handleAgentReply(post(valid), d);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, duplicate: false });
    expect(store.recordReply).toHaveBeenCalledWith({
      threadId: THREAD,
      inReplyTo: MESSAGE,
      author: "michael_scott",
      body: valid.text,
      status: "done",
      links: valid.links,
    });
  });

  it("reports a duplicate reply as already saved (200, duplicate: true)", async () => {
    const store = fakeStore({
      recordReply: vi.fn(async () => ({ messageId: "m", duplicate: true })),
    });
    const { deps: d } = deps({ store: () => store });
    const res = await handleAgentReply(post(valid), d);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ duplicate: true });
  });

  it.each([
    ["not JSON", "{oops", 400],
    ["an array", "[]", 400],
    ["a bad thread id", { ...valid, thread_id: "abc" }, 400],
    ["a bad in_reply_to", { ...valid, in_reply_to: 7 }, 400],
    ["an unknown sender", { ...valid, from: "hermes" }, 400],
    ["an unknown status", { ...valid, status: "finished" }, 400],
    ["empty text", { ...valid, text: "   " }, 400],
    ["text over 20 KB", { ...valid, text: "é".repeat(10_241) }, 400],
    ["a javascript: link", { ...valid, links: [{ label: "x", url: "javascript:alert(1)" }] }, 400],
    [
      "a link with credentials",
      { ...valid, links: [{ label: "x", url: "https://u:p@x.test" }] },
      400,
    ],
    ["eleven links", { ...valid, links: Array(11).fill(valid.links[0]) }, 400],
  ])("rejects %s", async (_, body, status) => {
    const { store, deps: d } = deps();
    const res = await handleAgentReply(post(body), d);
    expect(res.status).toBe(status);
    expect(store.recordReply).not.toHaveBeenCalled();
  });

  it("rejects a body over 64 KB (413) without parsing it", async () => {
    const { store, deps: d } = deps();
    const res = await handleAgentReply(post({ ...valid, text: "a".repeat(70_000) }), d);
    expect(res.status).toBe(413);
    expect(store.recordReply).not.toHaveBeenCalled();
  });

  it("rejects a wrong content type (415)", async () => {
    const { deps: d } = deps();
    const res = await handleAgentReply(post(valid, { "content-type": "text/plain" }), d);
    expect(res.status).toBe(415);
  });

  it("answers 404 for an unknown thread or message", async () => {
    const store = fakeStore({
      recordReply: vi.fn(async () => {
        throw new AgentStoreNotFound("x");
      }),
    });
    const { deps: d } = deps({ store: () => store });
    expect((await handleAgentReply(post(valid), d)).status).toBe(404);
  });

  it("keeps markdown and HTML as plain text (rendering is escaped later)", async () => {
    const { store, deps: d } = deps();
    await handleAgentReply(post({ ...valid, text: "<script>alert(1)</script>" }), d);
    expect(store.recordReply.mock.calls[0]?.[0].body).toBe("<script>alert(1)</script>");
  });
});

describe("POST /api/agent-reply: rate limits", () => {
  it("limits each client address, before checking the key", async () => {
    const { deps: d } = deps({ perClient: createRateLimiter({ limit: 2, windowMs: 60_000 }) });
    const from = (ip: string) => ({ "x-forwarded-for": ip, authorization: "Bearer wrong" });
    expect((await handleAgentReply(post(valid, from("1.1.1.1")), d)).status).toBe(401);
    expect((await handleAgentReply(post(valid, from("1.1.1.1")), d)).status).toBe(401);
    const limited = await handleAgentReply(post(valid, from("1.1.1.1")), d);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    expect((await handleAgentReply(post(valid, from("2.2.2.2")), d)).status).toBe(401);
  });

  it("uses the last X-Forwarded-For entry (the one Traefik adds)", () => {
    const req = new Request("http://x/", { headers: { "x-forwarded-for": "6.6.6.6, 9.9.9.9" } });
    expect(clientAddress(req)).toBe("9.9.9.9");
  });

  it("has a global cap too", async () => {
    const { deps: d } = deps({ global: createRateLimiter({ limit: 1, windowMs: 60_000 }) });
    expect((await handleAgentReply(post(valid), d)).status).toBe(200);
    expect((await handleAgentReply(post(valid), d)).status).toBe(429);
  });
});
