import { createHash, timingSafeEqual } from "node:crypto";

import type { RateLimiter } from "./rate-limit";
import { agentReplySchema, MAX_REPLY_BODY_BYTES, REPLY_SENDERS } from "./reply-schema";
import { AgentStoreNotFound, type AgentStore } from "./store";

// POST /api/agent-reply, as a plain function so it can be tested without a server.
// Order: rate limit → bearer key (constant time) → content type and size → JSON → fields →
// record (the database checks the thread and that the message was sent to that agent).
// Responses never echo the key or the text; logs carry ids and outcomes only.

export type ReplyDeps = {
  store: () => AgentStore;
  key: string | null;
  perClient: RateLimiter;
  global: RateLimiter;
  log?: (event: string, details: Record<string, unknown>) => void;
};

const json = (status: number, body: Record<string, unknown>, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...extra },
  });

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

export function bearerMatches(header: string | null, key: string | null): boolean {
  if (!key || !header) return false;
  const token = /^Bearer ([^\s]+)$/.exec(header)?.[1];
  if (!token) return false;
  return timingSafeEqual(digest(token), digest(key));
}

// Traefik appends the client address as the last X-Forwarded-For entry; earlier entries can be
// forged by the client, so only the last one is used.
export function clientAddress(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  const last = xff?.split(",").pop()?.trim();
  return last || "direct";
}

async function readCapped(req: Request, cap: number): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > cap) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const defaultLog = (event: string, details: Record<string, unknown>) =>
  console.info(JSON.stringify({ at: new Date().toISOString(), event, ...details }));

export async function handleAgentReply(req: Request, deps: ReplyDeps): Promise<Response> {
  const log = deps.log ?? defaultLog;
  const client = clientAddress(req);
  if (!deps.global.allow("all") || !deps.perClient.allow(client)) {
    log("agent.reply", { outcome: "rate_limited" });
    return json(429, { error: "Too many requests" }, { "retry-after": "60" });
  }
  if (!bearerMatches(req.headers.get("authorization"), deps.key)) {
    log("agent.reply", { outcome: "unauthorized" });
    return json(401, { error: "Unauthorized" }, { "www-authenticate": "Bearer" });
  }
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return json(415, { error: "Send application/json" });
  }
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_REPLY_BODY_BYTES) return json(413, { error: "Body is too large" });
  const raw = await readCapped(req, MAX_REPLY_BODY_BYTES);
  if (raw === null) return json(413, { error: "Body is too large" });

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return json(400, { error: "Body is not valid JSON" });
  }
  const parsed = agentReplySchema.safeParse(parsedJson);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join(".") || "body";
    log("agent.reply", { outcome: "invalid", field });
    return json(400, { error: `Invalid ${field}: ${issue?.message ?? "invalid"}` });
  }
  const r = parsed.data;
  try {
    const saved = await deps.store().recordReply({
      threadId: r.thread_id,
      inReplyTo: r.in_reply_to,
      author: REPLY_SENDERS[r.from],
      body: r.text,
      status: r.status,
      links: r.links,
    });
    log("agent.reply", {
      outcome: saved.duplicate ? "duplicate" : "recorded",
      thread: r.thread_id,
      in_reply_to: r.in_reply_to,
      message: saved.messageId,
    });
    return json(200, { ok: true, message_id: saved.messageId, duplicate: saved.duplicate });
  } catch (e) {
    if (e instanceof AgentStoreNotFound) {
      log("agent.reply", { outcome: "not_found", thread: r.thread_id, in_reply_to: r.in_reply_to });
      return json(404, { error: "Unknown thread or message" });
    }
    log("agent.reply", { outcome: "error" });
    return json(500, { error: "Could not save the reply" });
  }
}
