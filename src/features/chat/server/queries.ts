import "server-only";

import { requireMember } from "@/server/auth/session";

// The conversation with Michael Scott, oldest first: what you sent him, his replies, and system
// notices (e.g. "not available", "no reply before the deadline"). Pioneer (Claude) threads are
// left out of this view; they stay in the database.
export async function listMessages(limit = 100) {
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, author, recipient, kind, body, flagged, created_at, job:jobs!messages_job_fkey(id, status, waiting_until, last_error)",
    )
    .eq("workspace_id", member.workspaceId)
    .or("author.in.(michael_scott,system),recipient.eq.michael_scott")
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
