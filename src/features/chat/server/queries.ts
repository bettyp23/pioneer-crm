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

// Sends per connection in the last hour (what the loop brake counts) and this month.
export async function listConnectionUsage() {
  const { supabase, member } = await requireMember();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [brakes, sends] = await Promise.all([
    listConnectionBrakes(),
    supabase
      .from("job_dispatches")
      .select("connection, dispatched_at")
      .eq("workspace_id", member.workspaceId)
      .gte("dispatched_at", monthStart.toISOString())
      .limit(5000),
  ]);
  if (sends.error) throw new Error(`Failed to load sends (${sends.error.code})`);
  const hourAgo = Date.now() - 60 * 60 * 1000;
  return brakes.map((b) => {
    const mine = sends.data.filter((s) => s.connection === b.connection);
    return {
      ...b,
      lastHour: mine.filter((s) => new Date(s.dispatched_at).getTime() > hourAgo).length,
      thisMonth: mine.length,
    };
  });
}
