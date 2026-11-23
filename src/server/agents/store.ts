import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/server/db/database.types";

// What the app server does on an agent's behalf, using the secret key. The functions it calls
// are granted to service_role only and re-check everything (one delivery per message, replies
// only to the right message in the right thread). Reads are limited to chat tables.
// Import-restricted by ESLint to src/server/agents/** and the agent-reply route.

export type AgentAuthor = "michael_scott" | "hermes" | "system";
export type AgentStatus = "working" | "done" | "needs_decision";
export type AgentLink = { label: string; url: string };

export type OutboundMessage = {
  id: string;
  threadId: string;
  body: string;
  createdAt: string;
  sentFrom: "bettina" | "hermes";
};

export type ThreadTurn = { author: string; body: string };

export type AgentStore = {
  claimDelivery(messageId: string): Promise<boolean>;
  finishDelivery(
    messageId: string,
    delivered: boolean,
    attempts: number,
    error?: string,
  ): Promise<void>;
  outboundMessage(messageId: string): Promise<OutboundMessage | null>;
  hermesRequest(
    messageId: string,
  ): Promise<{ threadId: string; body: string; history: ThreadTurn[] } | null>;
  routeMessage(messageId: string, target: "michael"): Promise<boolean>;
  recordReply(reply: {
    threadId: string;
    inReplyTo: string;
    author: AgentAuthor;
    body: string;
    status: AgentStatus | null;
    links?: AgentLink[];
    kind?: "answer" | "routed" | "notice";
  }): Promise<{ messageId: string; duplicate: boolean }>;
};

// Postgres error codes the functions raise for bad references (shown to the caller as 404).
export class AgentStoreNotFound extends Error {}

export function createAgentStore(
  url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  secretKey = process.env.SUPABASE_SECRET_KEY ?? "",
): AgentStore {
  if (!url || !secretKey) throw new Error("Agent store is not configured");
  const db = createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async claimDelivery(messageId) {
      const { data, error } = await db.rpc("claim_agent_delivery", { p_message_id: messageId });
      if (error) throw new Error(`claim_agent_delivery failed (${error.code})`);
      return data === true;
    },
    async finishDelivery(messageId, delivered, attempts, err) {
      const { error } = await db.rpc("finish_agent_delivery", {
        p_message_id: messageId,
        p_delivered: delivered,
        p_attempts: attempts,
        p_error: err ?? undefined,
      });
      if (error) throw new Error(`finish_agent_delivery failed (${error.code})`);
    },
    async outboundMessage(messageId) {
      const { data, error } = await db
        .from("messages")
        .select(
          "id, thread_id, body, created_at, delivery:agent_deliveries!agent_deliveries_message_fkey(sent_from)",
        )
        .eq("id", messageId)
        .maybeSingle();
      if (error) throw new Error(`load message failed (${error.code})`);
      const delivery = Array.isArray(data?.delivery) ? data.delivery[0] : data?.delivery;
      if (!data?.thread_id || !delivery) return null;
      return {
        id: data.id,
        threadId: data.thread_id,
        body: data.body,
        createdAt: data.created_at,
        sentFrom: delivery.sent_from as OutboundMessage["sentFrom"],
      };
    },
    async hermesRequest(messageId) {
      const { data: msg, error } = await db
        .from("messages")
        .select("id, thread_id, body, recipient, author, created_at")
        .eq("id", messageId)
        .maybeSingle();
      if (error) throw new Error(`load message failed (${error.code})`);
      if (!msg?.thread_id || msg.author !== "owner" || msg.recipient !== "hermes") return null;
      const { data: earlier, error: histError } = await db
        .from("messages")
        .select("author, body")
        .eq("thread_id", msg.thread_id)
        .lt("created_at", msg.created_at)
        .order("created_at", { ascending: false })
        .limit(10);
      if (histError) throw new Error(`load history failed (${histError.code})`);
      return { threadId: msg.thread_id, body: msg.body, history: (earlier ?? []).reverse() };
    },
    async routeMessage(messageId, target) {
      const { data, error } = await db.rpc("route_agent_message", {
        p_message_id: messageId,
        p_target: target,
      });
      if (error) throw new Error(`route_agent_message failed (${error.code})`);
      return data === true;
    },
    async recordReply(r) {
      const { data, error } = await db
        .rpc("record_agent_reply", {
          p_thread_id: r.threadId,
          p_in_reply_to: r.inReplyTo,
          p_author: r.author,
          p_body: r.body,
          // System notices carry no agent status; the column allows null.
          p_status: (r.status ?? null) as unknown as string,
          p_links: (r.links?.length ? r.links : undefined) as Json | undefined,
          p_kind: r.kind ?? "answer",
        })
        .single();
      if (error) {
        if (error.code === "P0002") throw new AgentStoreNotFound("Unknown thread or message");
        throw new Error(`record_agent_reply failed (${error.code})`);
      }
      return { messageId: data.message_id, duplicate: data.duplicate };
    },
  };
}
