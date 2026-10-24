import "server-only";

import { requireMember } from "@/server/auth/session";

// The most recent messages, oldest first, with the status of the send each one started.
export async function listMessages(limit = 100) {
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, author, recipient, kind, body, flagged, created_at, job:jobs!messages_job_fkey(id, status, waiting_until, last_error)",
    )
    .eq("workspace_id", member.workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load messages (${error.code})`);
  return data.reverse();
}

export async function listConnectionBrakes() {
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("connection_brakes")
    .select("connection, hourly_limit, paused_at, paused_reason")
    .eq("workspace_id", member.workspaceId)
    .order("connection");
  if (error) throw new Error(`Failed to load connections (${error.code})`);
  return data;
}
