import { createServer, type IncomingMessage, type Server } from "node:http";

import { expect, test, type APIRequestContext } from "@playwright/test";

import { gotoHydrated, USERS } from "./fixtures";

// Agent chat over webhooks. Two stand-ins replace the real services:
//   * "Grok" on :54410 records what Pioneer POSTs to Michael's webhook (and can fail first);
//   * "Hermes" on :54411 answers like Hermes's OpenAI-compatible API.
// The app must run with the AGENT_TEST_ENV settings below (CI sets them; see the PR's test plan).
const AGENT_TEST_ENV = {
  GROK_MICHAEL_WEBHOOK_URL: "http://127.0.0.1:54410/hook",
  GROK_MICHAEL_WEBHOOK_KEY: "test-webhook-key-not-a-secret",
  PIONEER_AGENT_REPLY_KEY: "test-agent-reply-key-not-a-secret-000000",
  PIONEER_AGENT_REPLY_URL: "http://localhost:3000/login/api/agent-reply",
  HERMES_API_URL: "http://127.0.0.1:54411",
  HERMES_API_KEY: "test-hermes-key-not-a-secret",
};

type OutboundBody = {
  type: string;
  thread_id: string;
  message_id: string;
  from: string;
  text: string;
  sent_at: string;
  reply_url: string;
};
type Captured = {
  auth: string | undefined;
  idempotency: string | undefined;
  body: OutboundBody;
};
const grokCalls: Captured[] = [];
const attemptsByMessage = new Map<string, number>();
let grok: Server;
let knownThread = "";
let hermes: Server;

const readJson = (req: IncomingMessage) =>
  new Promise<Record<string, unknown>>((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => resolve(raw ? JSON.parse(raw) : {}));
  });

test.beforeAll(async () => {
  grok = createServer(async (req, res) => {
    const body = (await readJson(req)) as OutboundBody;
    const n = (attemptsByMessage.get(body.message_id) ?? 0) + 1;
    attemptsByMessage.set(body.message_id, n);
    grokCalls.push({
      auth: req.headers.authorization,
      idempotency: req.headers["idempotency-key"] as string,
      body,
    });
    // Messages containing FLAKY fail once with 503, then succeed.
    res.statusCode = body.text?.includes("FLAKY") && n === 1 ? 503 : 200;
    res.end();
  });
  hermes = createServer(async (req, res) => {
    const auth = req.headers.authorization;
    const body = (await readJson(req)) as { messages: { role: string; content: string }[] };
    const last = body.messages.at(-1)?.content ?? "";
    const decision =
      auth !== `Bearer ${AGENT_TEST_ENV.HERMES_API_KEY}`
        ? null
        : last.includes("ROUTE")
          ? { action: "route", to: "michael", note: "This is work for Michael." }
          : { action: "answer", text: `Hermes here. **Quick answer** to: ${last}` };
    res.statusCode = decision ? 200 : 401;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(decision) } }] }));
  });
  await Promise.all([
    new Promise<void>((r) => grok.listen(54410, "127.0.0.1", r)),
    new Promise<void>((r) => hermes.listen(54411, "127.0.0.1", r)),
  ]);
});

test.afterAll(async () => {
  await Promise.all([new Promise((r) => grok.close(r)), new Promise((r) => hermes.close(r))]);
});

const unique = () => Date.now().toString(36);
const callFor = (text: string) => grokCalls.find((c) => c.body.text?.includes(text));

const reply = (
  request: APIRequestContext,
  data: unknown,
  key = AGENT_TEST_ENV.PIONEER_AGENT_REPLY_KEY,
) =>
  request.post("/login/api/agent-reply", {
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    data: data as Record<string, unknown>,
  });

test.describe("as owner", () => {
  test.use({ storageState: USERS.owner.storage });

  test("message Michael: delivered once with the agreed payload; his reply appears live", async ({
    page,
    request,
  }) => {
    const id = unique();
    await gotoHydrated(page, "/login/dashboard?agent=michael");
    await expect(page.getByRole("heading", { name: "Michael Scott" })).toBeVisible();
    await page.getByLabel("Message Michael Scott").fill(`Plan the site ${id}`);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const mine = page.getByRole("listitem").filter({ hasText: `Plan the site ${id}` });
    await expect(mine.getByText("Delivered to Michael")).toBeVisible({ timeout: 15_000 });

    const call = callFor(`Plan the site ${id}`)!;
    knownThread = call.body.thread_id;
    expect(call.auth).toBe(`Bearer ${AGENT_TEST_ENV.GROK_MICHAEL_WEBHOOK_KEY}`);
    expect(call.idempotency).toBe(call.body.message_id);
    expect(call.body).toMatchObject({
      type: "chat",
      from: "bettina",
      text: `Plan the site ${id}`,
      reply_url: AGENT_TEST_ENV.PIONEER_AGENT_REPLY_URL,
    });
    expect(Object.keys(call.body).sort()).toEqual(
      ["from", "message_id", "reply_url", "sent_at", "text", "thread_id", "type"].sort(),
    );
    expect(new Date(call.body.sent_at).toISOString()).toBe(call.body.sent_at);
    expect(attemptsByMessage.get(call.body.message_id)).toBe(1);

    // Michael answers (markdown, a raw HTML attempt, a link); no page reload.
    const payload = {
      thread_id: call.body.thread_id,
      in_reply_to: call.body.message_id,
      from: "michael",
      text: `**Plan ready ${id}** <img src=x onerror="window.__pwned=1"> [evil](javascript:alert(1))`,
      status: "needs_decision",
      links: [{ label: "Site plan", url: "https://example.test/plan" }],
    };
    const res = await reply(request, payload);
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, duplicate: false });
    const answer = page.getByRole("listitem").filter({ hasText: `Plan ready ${id}` });
    await expect(answer).toBeVisible({ timeout: 10_000 });
    await expect(answer.getByText("Michael Scott", { exact: true })).toBeVisible();
    await expect(answer.getByText("Needs your decision")).toBeVisible();
    await expect(answer.locator("strong", { hasText: `Plan ready ${id}` })).toBeVisible();
    await expect(answer.locator("img")).toHaveCount(0);
    await expect(answer.locator('a[href^="javascript"]')).toHaveCount(0);
    await expect(answer.getByRole("link", { name: "Site plan" })).toHaveAttribute(
      "rel",
      "noopener noreferrer nofollow",
    );
    expect(
      await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned),
    ).toBeUndefined();

    // The same reply again is stored once.
    const again = await reply(request, payload);
    expect(await again.json()).toMatchObject({ duplicate: true });
    await page.reload();
    await expect(page.getByRole("listitem").filter({ hasText: `Plan ready ${id}` })).toHaveCount(1);
  });

  test("a 503 from Michael's webhook is retried, and the message still goes once", async ({
    page,
  }) => {
    const id = unique();
    await gotoHydrated(page, "/login/dashboard?agent=michael");
    await page.getByLabel("Message Michael Scott").fill(`FLAKY ${id}`);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const mine = page.getByRole("listitem").filter({ hasText: `FLAKY ${id}` });
    await expect(mine.getByText("Delivered to Michael")).toBeVisible({ timeout: 20_000 });
    const call = callFor(`FLAKY ${id}`)!;
    expect(attemptsByMessage.get(call.body.message_id)).toBe(2);
  });

  test("Hermes answers quick questions itself, as Hermes", async ({ page }) => {
    const id = unique();
    await gotoHydrated(page, "/login/dashboard");
    await expect(page.getByRole("heading", { name: "Hermes" })).toBeVisible();
    await page.getByLabel("Message Hermes").fill(`What day is it? ${id}`);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const answer = page
      .getByRole("listitem")
      .filter({ hasText: `Quick answer to: What day is it? ${id}` });
    await expect(answer).toBeVisible({ timeout: 15_000 });
    await expect(answer.getByText("Hermes", { exact: true })).toBeVisible();
    expect(callFor(`What day is it? ${id}`)).toBeUndefined();
  });

  test("Hermes routes work to Michael with the same outbound call; Michael's reply lands in Hermes's thread", async ({
    page,
    request,
  }) => {
    const id = unique();
    await gotoHydrated(page, "/login/dashboard?agent=hermes");
    await page.getByLabel("Message Hermes").fill(`ROUTE write the homepage ${id}`);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(
      page.getByText("Sent to Michael Scott. This is work for Michael.").last(),
    ).toBeVisible({
      timeout: 15_000,
    });
    const mine = page.getByRole("listitem").filter({ hasText: `ROUTE write the homepage ${id}` });
    await expect(mine.getByText("Delivered to Michael")).toBeVisible({ timeout: 15_000 });
    const call = callFor(`ROUTE write the homepage ${id}`)!;
    expect(call.body.from).toBe("hermes");

    await reply(request, {
      thread_id: call.body.thread_id,
      in_reply_to: call.body.message_id,
      from: "michael",
      text: `Homepage draft ${id}`,
      status: "done",
    });
    const answer = page.getByRole("listitem").filter({ hasText: `Homepage draft ${id}` });
    await expect(answer.getByText("Michael Scott", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("the classic Michael chat is still there", async ({ page }) => {
    await gotoHydrated(page, "/login/dashboard/classic");
    await expect(page.getByRole("heading", { name: "Michael Scott (classic)" })).toBeVisible();
  });
});

test.describe("reply endpoint without a session", () => {
  const ok = {
    thread_id: "11111111-1111-4111-8111-111111111111",
    in_reply_to: "22222222-2222-4222-8222-222222222222",
    from: "michael",
    text: "hi",
    status: "done",
  };

  test("rejects a missing or wrong key with 401", async ({ request }) => {
    expect((await request.post("/login/api/agent-reply", { data: ok })).status()).toBe(401);
    expect((await reply(request, ok, "wrong-key-wrong-key-wrong-key-wrong")).status()).toBe(401);
  });

  test("rejects bad payloads and unknown threads", async ({ request }) => {
    expect((await reply(request, { ...ok, status: "finished" })).status()).toBe(400);
    expect((await reply(request, { ...ok, text: "x".repeat(21_000) })).status()).toBe(400);
    expect((await reply(request, ok)).status()).toBe(404);
  });

  test("only POST is allowed", async ({ request }) => {
    expect((await request.get("/login/api/agent-reply")).status()).toBe(405);
  });
});

test.describe("as a client account", () => {
  test.use({ storageState: USERS.clientA.storage });

  test("cannot open a staff chat thread's live updates", async ({ request }) => {
    expect(knownThread).not.toBe("");
    const res = await request.get(`/login/api/chat/events?thread=${knownThread}`);
    expect(res.status()).toBe(404);
  });
});
