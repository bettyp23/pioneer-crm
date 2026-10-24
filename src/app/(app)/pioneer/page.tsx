import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAiPauseState } from "@/features/agents/server/queries";
import { ChatAutoRefresh } from "@/features/chat/components/chat-auto-refresh";
import { ChatComposer } from "@/features/chat/components/chat-composer";
import { ChatThread, isOpen } from "@/features/chat/components/chat-thread";
import { CONNECTION_LABELS, type Connection } from "@/features/chat/schemas";
import { listConnectionBrakes, listMessages } from "@/features/chat/server/queries";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Pioneer" };

export default async function PioneerChatPage() {
  const { member } = await requireMember();
  const [messages, brakes, pause] = await Promise.all([
    listMessages(),
    listConnectionBrakes(),
    getAiPauseState(),
  ]);
  const braked = brakes.filter((b) => b.paused_at);
  const canWrite = can(member.role, "agents.dispatch");
  return (
    <>
      <PageHeader
        title="Pioneer"
        description="Write to Pioneer. Claude answers or hands agency work to Michael Scott, and replies appear here. Your Mac must be on with the worker running."
      />
      {pause.pausedAt ? (
        <Alert variant="destructive">
          <AlertTitle>All agents are paused</AlertTitle>
          <AlertDescription>
            Messages are saved but not sent until you resume agents in the{" "}
            <Link href="/agents/queue" className="underline underline-offset-2">
              AI Command Center
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}
      {braked.map((b) => (
        <Alert key={b.connection} variant="destructive">
          <AlertTitle>{CONNECTION_LABELS[b.connection as Connection]} is paused</AlertTitle>
          <AlertDescription>
            {b.paused_reason ?? "The loop brake stopped this connection."} Resume it on{" "}
            <Link href="/agents/usage" className="underline underline-offset-2">
              Agents → Usage
            </Link>
            .
          </AlertDescription>
        </Alert>
      ))}
      {messages.length === 0 ? (
        <EmptyState title="No messages yet">
          <p>Ask Pioneer something, or send a task to Michael Scott.</p>
        </EmptyState>
      ) : (
        <ChatThread messages={messages} timeZone={member.workspaceTimezone} />
      )}
      {canWrite ? (
        <ChatComposer />
      ) : (
        <p className="text-muted-foreground text-sm">
          Only owners and admins can write to Pioneer.
        </p>
      )}
      <ChatAutoRefresh active={messages.some(isOpen)} />
    </>
  );
}
