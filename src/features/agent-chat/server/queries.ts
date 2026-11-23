import "server-only";

import type { AgentKey } from "@/features/agent-chat/schemas";
import { requireMember } from "@/server/auth/session";

// The latest thread with an agent and its messages (oldest first), with each message's
// delivery status. RLS limits this to staff of the workspace.
export async function getAgentThread(agent: AgentKey, limit = 100) {
  const { supabase, member } = await requireMember();
  const { data: thread, error } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("workspace_id", member.workspaceId)
    .eq("agent", agent)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load the thread (${error.code})`);
  // Read once per request, for "stuck" delivery badges (kept out of render, which must be pure).
  const loadedAt = Date.now();
  if (!thread) return { threadId: null, messages: [], loadedAt };

  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select(
      "id, author, kind, body, flagged, created_at, agent_status, links, in_reply_to, delivery:agent_deliveries!agent_deliveries_message_fkey(status, attempts, last_error, updated_at)",
    )
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (msgError) throw new Error(`Failed to load messages (${msgError.code})`);
  return {
    loadedAt,
    threadId: thread.id,
    messages: messages.reverse().map((m) => ({
      ...m,
      delivery: Array.isArray(m.delivery) ? (m.delivery[0] ?? null) : m.delivery,
    })),
  };
}
export type AgentThreadMessage = Awaited<ReturnType<typeof getAgentThread>>["messages"][number];
