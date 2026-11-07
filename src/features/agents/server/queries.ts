import "server-only";

import { requireMember } from "@/server/auth/session";

export async function getAiPauseState() {
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("workspaces")
    .select("ai_paused_at, ai_pause_reason")
    .eq("id", member.workspaceId)
    .single();
  if (error) throw new Error(`Failed to load agent status (${error.code})`);
  return { pausedAt: data.ai_paused_at, reason: data.ai_pause_reason };
}
