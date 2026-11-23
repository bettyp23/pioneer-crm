import "server-only";

import { hermesApi, type HermesTarget } from "./config";
import { deliverToMichael, type DeliveryDeps } from "./michael-webhook";
import type { AgentStore } from "./store";

// Hermes, the receptionist: answers quick questions itself, or routes the message to the right
// Grok bot. Hermes only *decides*; Pioneer makes the outbound call (the same one as a direct
// message to Michael), so Hermes never holds a bot's webhook key, and Hermes's replies are always
// shown as Hermes — it never speaks as a bot. Reached over the private Docker network only.

// Grok bots Hermes may route to. Add one here (and its webhook) to make it routable.
export const ROUTABLE_BOTS = {
  michael:
    "Michael Scott: Bettina's Grok team lead. Client work, website plans, marketing, research, drafts, anything that needs real work or his team.",
} as const;
export type RoutableBot = keyof typeof ROUTABLE_BOTS;

export const RECEPTIONIST_PROMPT = `You are Hermes, the receptionist inside Pioneer OS for Bettina (Pioneer Digital AI).
Your job: answer quick questions yourself, and route everything else to the right Grok bot.

Grok bots you can route to:
${Object.entries(ROUTABLE_BOTS)
  .map(([key, what]) => `- "${key}": ${what}`)
  .join("\n")}

Rules:
- Never pretend to be a bot or write as one. You are always Hermes.
- Answer yourself only short, general questions you can answer well in a few sentences.
- Route requests for real work (planning, writing, client tasks, research) to a bot.
- You have no tools. Don't claim to have done anything outside this chat.
- Reply with JSON only, one of:
  {"action":"answer","text":"<your answer, markdown allowed>"}
  {"action":"route","to":"<bot key>","note":"<one short sentence for Bettina about why>"}`;

export type HermesDecision =
  { action: "answer"; text: string } | { action: "route"; to: RoutableBot; note: string };

const MAX_TEXT = 20_000;

// Accepts the JSON object alone, inside a code fence, or with text around it. Anything unusable
// becomes a plain answer (shown as Hermes), so a confused model can't route by accident.
export function parseHermesDecision(content: string): HermesDecision {
  const raw = content.trim();
  const candidates = [
    raw,
    raw.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1],
    raw.match(/\{[\s\S]*\}/)?.[0],
  ];
  for (const c of candidates) {
    if (!c) continue;
    try {
      const v = JSON.parse(c) as Record<string, unknown>;
      if (v.action === "answer" && typeof v.text === "string" && v.text.trim()) {
        return { action: "answer", text: v.text.trim().slice(0, MAX_TEXT) };
      }
      if (v.action === "route" && typeof v.to === "string" && v.to in ROUTABLE_BOTS) {
        const note = typeof v.note === "string" ? v.note.trim().slice(0, 300) : "";
        return { action: "route", to: v.to as RoutableBot, note };
      }
    } catch {
      // try the next candidate
    }
  }
  return { action: "answer", text: (raw || "(No answer.)").slice(0, MAX_TEXT) };
}

const HISTORY_ROLE: Record<string, "user" | "assistant"> = {
  owner: "user",
  hermes: "assistant",
  michael_scott: "assistant",
};

export type HermesDeps = {
  store: AgentStore;
  target?: HermesTarget | null;
  fetchImpl?: typeof fetch;
  delivery?: Omit<DeliveryDeps, "store">;
  log?: (event: string, details: Record<string, unknown>) => void;
};

const defaultLog = (event: string, details: Record<string, unknown>) =>
  console.info(JSON.stringify({ at: new Date().toISOString(), event, ...details }));

export async function askHermes(
  messageId: string,
  { store, target = hermesApi(), fetchImpl = fetch, delivery = {}, log = defaultLog }: HermesDeps,
): Promise<"answered" | "routed" | "failed"> {
  const req = await store.hermesRequest(messageId);
  if (!req) return "failed";
  const notice = (body: string) =>
    store.recordReply({
      threadId: req.threadId,
      inReplyTo: messageId,
      author: "system",
      body,
      status: null,
      kind: "notice",
    });
  if (!target) {
    await notice("Hermes isn't connected on the server yet.");
    log("agent.hermes", { message: messageId, outcome: "failed", reason: "not_configured" });
    return "failed";
  }

  let content: string;
  try {
    const res = await fetchImpl(`${target.url}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${target.key}` },
      body: JSON.stringify({
        model: target.model,
        stream: false,
        messages: [
          { role: "system", content: RECEPTIONIST_PROMPT },
          ...req.history
            .filter((t) => HISTORY_ROLE[t.author])
            .map((t) => ({
              role: HISTORY_ROLE[t.author],
              content: t.author === "michael_scott" ? `[Michael Scott replied] ${t.body}` : t.body,
            })),
          { role: "user", content: req.body },
        ],
      }),
      redirect: "error",
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
    const c = json.choices?.[0]?.message?.content;
    if (typeof c !== "string") throw new Error("no content");
    content = c;
  } catch (e) {
    await notice("Hermes couldn't answer right now. Try again in a minute.");
    log("agent.hermes", {
      message: messageId,
      outcome: "failed",
      reason: e instanceof Error ? e.message.slice(0, 80) : "unknown",
    });
    return "failed";
  }

  const decision = parseHermesDecision(content);
  if (decision.action === "answer") {
    await store.recordReply({
      threadId: req.threadId,
      inReplyTo: messageId,
      author: "hermes",
      body: decision.text,
      status: "done",
    });
    log("agent.hermes", { message: messageId, outcome: "answered" });
    return "answered";
  }

  await store.recordReply({
    threadId: req.threadId,
    inReplyTo: messageId,
    author: "hermes",
    body: `Sent to Michael Scott.${decision.note ? ` ${decision.note}` : ""}`,
    status: "done",
    kind: "routed",
  });
  await store.routeMessage(messageId, decision.to);
  const outcome = await deliverToMichael(messageId, { store, ...delivery });
  log("agent.hermes", { message: messageId, outcome: "routed", delivery: outcome });
  return "routed";
}
