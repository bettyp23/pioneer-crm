import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { AiPauseControl } from "@/features/agents/components/ai-pause-control";
import { getAiPauseState } from "@/features/agents/server/queries";
import { AgentComposer } from "@/features/agent-chat/components/agent-composer";
import { AgentTabs } from "@/features/agent-chat/components/agent-tabs";
import { AgentThread } from "@/features/agent-chat/components/agent-thread";
import { ChatLive } from "@/features/agent-chat/components/chat-live";
import { AGENTS, isAgentKey, type AgentKey } from "@/features/agent-chat/schemas";
import { getAgentThread } from "@/features/agent-chat/server/queries";
import { ChatScrollToEnd } from "@/features/chat/components/chat-scroll-to-end";
import { formatDateTime } from "@/lib/format";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

// One chat for all agents: pick Hermes (receptionist) or Michael Scott (Grok). Messages leave
// Pioneer from the server; replies arrive live.
export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const { agent: requested } = await props.searchParams;
  const agent: AgentKey = isAgentKey(requested) ? requested : "hermes";
  const { member } = await requireMember();
  const [{ threadId, messages, loadedAt }, pause] = await Promise.all([
    getAgentThread(agent),
    getAiPauseState(),
  ]);
  const canWrite = can(member.role, "agents.dispatch");
  const canResume = can(member.role, "agents.kill_switch");

  return (
    <>
      <PageHeader title={AGENTS[agent].name} description={AGENTS[agent].description} />
      <AgentTabs active={agent} />
      {pause.pausedAt ? (
        <AiPauseControl
          pausedLabel={formatDateTime(pause.pausedAt, member.workspaceTimezone)}
          reason={pause.reason}
          canControl={canResume}
        />
      ) : null}
      {messages.length === 0 ? (
        <EmptyState title="No messages yet">
          <p>Say hi to {AGENTS[agent].name} below.</p>
        </EmptyState>
      ) : (
        <AgentThread messages={messages} timeZone={member.workspaceTimezone} now={loadedAt} />
      )}
      {canWrite ? (
        <div className="bg-background sticky bottom-0 -mx-4 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:-mx-6 md:px-6">
          <AgentComposer agent={agent} />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Only owners and admins can message agents.</p>
      )}
      <p className="text-muted-foreground text-xs">
        Looking for the original Michael chat (worker and results sheet)?{" "}
        <Link href="/dashboard/classic" className="underline">
          Open the classic view
        </Link>
        .
      </p>
      <ChatLive threadId={threadId} />
      <ChatScrollToEnd count={messages.length} />
    </>
  );
}
