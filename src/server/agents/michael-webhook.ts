import "server-only";

import { agentReplyUrl, michaelWebhook, type WebhookTarget } from "./config";
import type { AgentStore, OutboundMessage } from "./store";

// Outbound: POST one message to Michael Scott's (Grok) webhook. Each message is claimed once in
// the database first, so it is never posted twice by two requests; within that one claim it
// retries with backoff on 5xx, 429 and network errors, and gives up at once on other 4xx.
// Logs carry the message id and outcome only: never the text, the URL or the key.

export const MAX_ATTEMPTS = 4;
const TIMEOUT_MS = 15_000;

export type DeliveryOutcome = "delivered" | "failed" | "skipped";

export type DeliveryDeps = {
  store: AgentStore;
  target?: WebhookTarget | null;
  replyUrl?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  log?: (event: string, details: Record<string, unknown>) => void;
};

export function michaelPayload(m: OutboundMessage, replyUrl: string) {
  return {
    type: "chat" as const,
    thread_id: m.threadId,
    message_id: m.id,
    from: m.sentFrom,
    text: m.body,
    sent_at: new Date(m.createdAt).toISOString(),
    reply_url: replyUrl,
  };
}

// 1 s, 2 s, 4 s (+ up to 250 ms jitter).
export const backoffMs = (attempt: number) =>
  1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);

const defaultLog = (event: string, details: Record<string, unknown>) =>
  console.info(JSON.stringify({ at: new Date().toISOString(), event, ...details }));

export async function deliverToMichael(
  messageId: string,
  {
    store,
    target = michaelWebhook(),
    replyUrl = agentReplyUrl(),
    fetchImpl = fetch,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    log = defaultLog,
  }: DeliveryDeps,
): Promise<DeliveryOutcome> {
  if (!(await store.claimDelivery(messageId))) {
    log("agent.delivery", { message: messageId, outcome: "skipped" });
    return "skipped";
  }
  const message = await store.outboundMessage(messageId);
  if (!message || !target) {
    const why = !target ? "Michael's webhook isn't set up on the server" : "Message not found";
    await store.finishDelivery(messageId, false, 0, why);
    log("agent.delivery", { message: messageId, outcome: "failed", reason: "not_configured" });
    return "failed";
  }

  const body = JSON.stringify(michaelPayload(message, replyUrl));
  let lastError = "No answer from Michael's webhook";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let retryable = true;
    try {
      const res = await fetchImpl(target.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${target.key}`,
          "idempotency-key": message.id,
          "user-agent": "PioneerOS/1",
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) {
        await store.finishDelivery(messageId, true, attempt);
        log("agent.delivery", { message: messageId, outcome: "delivered", attempts: attempt });
        return "delivered";
      }
      lastError = `Michael's webhook answered HTTP ${res.status}`;
      retryable = res.status >= 500 || res.status === 429;
    } catch (e) {
      lastError =
        e instanceof Error && e.name === "TimeoutError"
          ? "Michael's webhook didn't answer in time"
          : "Couldn't reach Michael's webhook";
    }
    if (!retryable) {
      await store.finishDelivery(messageId, false, attempt, lastError);
      log("agent.delivery", { message: messageId, outcome: "failed", attempts: attempt });
      return "failed";
    }
    if (attempt < MAX_ATTEMPTS) await sleep(backoffMs(attempt));
  }
  await store.finishDelivery(messageId, false, MAX_ATTEMPTS, lastError);
  log("agent.delivery", { message: messageId, outcome: "failed", attempts: MAX_ATTEMPTS });
  return "failed";
}
