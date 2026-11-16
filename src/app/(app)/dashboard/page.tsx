import type { Metadata } from "next";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AiPauseControl } from "@/features/agents/components/ai-pause-control";
import { getAiPauseState } from "@/features/agents/server/queries";
import { ChatAutoRefresh } from "@/features/chat/components/chat-auto-refresh";
import { ChatComposer } from "@/features/chat/components/chat-composer";
import { ChatScrollToEnd } from "@/features/chat/components/chat-scroll-to-end";
import { ChatThread, isOpen } from "@/features/chat/components/chat-thread";
import { ResumeConnectionButton } from "@/features/chat/components/resume-connection-button";
import { CONNECTION_LABELS, type Connection } from "@/features/chat/schemas";
import { listConnectionBrakes, listMessages } from "@/features/chat/server/queries";
import { formatDateTime } from "@/lib/format";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";
import { scheduleGrokDispatch } from "@/server/relay/schedule";

export const metadata: Metadata = { title: "Dashboard" };
// The webhook call runs in after() and needs longer than the platform default.
export const maxDuration = 60;

// One chat with Michael Scott (Grok). Sending and replies run on the host. The Mac worker can
// still do the same work; a message is delivered once.
export default async function DashboardPage() {
  const { member } = await requireMember();
  scheduleGrokDispatch();
  const [messages, brakes, pause] = await Promise.all([
    listMessages(),
    listConnectionBrakes(),
    getAiPauseState(),
  ]);
  const michaelBrake = brakes.find((b) => b.connection === "grok_webhook" && b.paused_at);
  const canWrite = can(member.role, "agents.dispatch");
  const canResume = can(member.role, "agents.kill_switch");

  return (
    <>
      <PageHeader
        title="Michael Scott"
        description="Your direct line to Michael. A message goes out when you send it, and his reply shows up here."
      />
      {pause.pausedAt ? (
        <AiPauseControl
          pausedLabel={formatDateTime(pause.pausedAt, member.workspaceTimezone)}
          reason={pause.reason}
          canControl={canResume}
        />
      ) : null}
      {michaelBrake ? (
        <Alert variant="destructive">
          <AlertTitle>
            {CONNECTION_LABELS[michaelBrake.connection as Connection]} is paused
          </AlertTitle>
          <AlertDescription>
            <p>{michaelBrake.paused_reason ?? "The loop brake stopped this connection."}</p>
            {canResume ? (
              <div className="mt-2">
                <ResumeConnectionButton connection="grok_webhook" />
              </div>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {messages.length === 0 ? (
        <EmptyState title="No messages yet">
          <p>Say hi to Michael below.</p>
        </EmptyState>
      ) : (
        <ChatThread messages={messages} timeZone={member.workspaceTimezone} />
      )}
      {canWrite ? (
        <div className="bg-background sticky bottom-0 -mx-4 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:-mx-6 md:px-6">
          <ChatComposer />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Only owners and admins can message Michael.</p>
      )}
      <ChatAutoRefresh active={messages.some(isOpen)} />
      <ChatScrollToEnd count={messages.length} />
    </>
  );
}
