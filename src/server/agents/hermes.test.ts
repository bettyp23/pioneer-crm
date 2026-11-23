import { describe, expect, it, vi } from "vitest";

import { askHermes, parseHermesDecision, RECEPTIONIST_PROMPT } from "./hermes";
import { fakeStore, MESSAGE, THREAD } from "./test-helpers";

const target = { url: "http://hermes-agent:8642", key: "hermes-key", model: "hermes-agent" };
const reply = (content: string, status = 200) =>
  vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status }),
  );

describe("parseHermesDecision", () => {
  it("reads an answer", () => {
    expect(parseHermesDecision('{"action":"answer","text":"It is 3pm."}')).toEqual({
      action: "answer",
      text: "It is 3pm.",
    });
  });
  it("reads a route inside a code fence", () => {
    expect(
      parseHermesDecision('```json\n{"action":"route","to":"michael","note":"Client work"}\n```'),
    ).toEqual({
      action: "route",
      to: "michael",
      note: "Client work",
    });
  });
  it("treats a route to an unknown bot as a plain answer", () => {
    expect(parseHermesDecision('{"action":"route","to":"skynet"}').action).toBe("answer");
  });
  it("treats free text as a plain answer", () => {
    expect(parseHermesDecision("Sure, it's sunny.")).toEqual({
      action: "answer",
      text: "Sure, it's sunny.",
    });
  });
});

describe("askHermes", () => {
  it("records Hermes's own answer as Hermes", async () => {
    const store = fakeStore();
    const fetchImpl = reply('{"action":"answer","text":"It is 3pm in Tampa."}');
    expect(await askHermes(MESSAGE, { store, target, fetchImpl, log: vi.fn() })).toBe("answered");
    expect(store.recordReply).toHaveBeenCalledWith({
      threadId: THREAD,
      inReplyTo: MESSAGE,
      author: "hermes",
      body: "It is 3pm in Tampa.",
      status: "done",
    });
    const [, init] = fetchImpl.mock.calls[0]!;
    expect((init?.headers as Record<string, string>).authorization).toBe("Bearer hermes-key");
    const sent = JSON.parse(String(init?.body));
    expect(sent.messages[0]).toEqual({ role: "system", content: RECEPTIONIST_PROMPT });
    expect(sent.messages.at(-1)).toEqual({ role: "user", content: "What time is it in Tampa?" });
  });

  it("routes to Michael with the same outbound call, labelled as routed by Hermes", async () => {
    const store = fakeStore({
      outboundMessage: vi.fn(async () => ({
        id: MESSAGE,
        threadId: THREAD,
        body: "Plan the site",
        createdAt: "2026-11-23T12:00:00Z",
        sentFrom: "hermes" as const,
      })),
    });
    const webhook = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }));
    const out = await askHermes(MESSAGE, {
      store,
      target,
      fetchImpl: reply(
        '{"action":"route","to":"michael","note":"Website planning is Michael\'s job."}',
      ),
      delivery: {
        target: { url: "https://grok.example.test/hook", key: "k" },
        replyUrl: "https://os.pioneerdigitalai.com/api/agent-reply",
        fetchImpl: webhook,
        log: vi.fn(),
      },
      log: vi.fn(),
    });
    expect(out).toBe("routed");
    expect(store.recordReply).toHaveBeenCalledWith(
      expect.objectContaining({
        author: "hermes",
        kind: "routed",
        body: expect.stringContaining("Sent to Michael Scott"),
      }),
    );
    expect(store.routeMessage).toHaveBeenCalledWith(MESSAGE, "michael");
    expect(JSON.parse(String(webhook.mock.calls[0]?.[1]?.body)).from).toBe("hermes");
    // Hermes never writes as Michael.
    expect(store.recordReply.mock.calls.every((c) => c[0].author !== "michael_scott")).toBe(true);
  });

  it("posts a notice instead of failing silently when Hermes is down", async () => {
    const store = fakeStore();
    const out = await askHermes(MESSAGE, {
      store,
      target,
      fetchImpl: reply("", 502),
      log: vi.fn(),
    });
    expect(out).toBe("failed");
    expect(store.recordReply).toHaveBeenCalledWith(
      expect.objectContaining({ author: "system", kind: "notice" }),
    );
  });

  it("does nothing for a message that wasn't sent to Hermes", async () => {
    const store = fakeStore({ hermesRequest: vi.fn(async () => null) });
    const fetchImpl = reply("{}");
    expect(await askHermes(MESSAGE, { store, target, fetchImpl, log: vi.fn() })).toBe("failed");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
