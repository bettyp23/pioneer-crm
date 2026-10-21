import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { AgentForm } from "@/features/agents/components/agent-form";
import { PROVIDER_LABELS, type WorkType } from "@/features/agents/schemas";
import { getAgent } from "@/features/agents/server/queries";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Agent" };

export default async function AgentPage({ params }: PageProps<"/agents/roster/[id]">) {
  const { member } = await requireMember();
  const agent = await getAgent((await params).id);
  if (!can(member.role, "agents.dispatch")) {
    return (
      <>
        <PageHeader
          title={agent.name}
          description={`${PROVIDER_LABELS[agent.provider]} · ${agent.role_summary ?? ""}`}
        />
        <pre className="bg-muted/50 rounded-md p-3 text-xs whitespace-pre-wrap">
          {agent.instructions || "No saved instructions."}
        </pre>
      </>
    );
  }
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title={agent.name}
          description="Edit the role and the instructions every prompt starts with."
        />
        <Button variant="outline" asChild>
          <Link href={`/agents/queue/new?agent=${agent.id}`}>Give it work</Link>
        </Button>
      </div>
      <AgentForm
        agentId={agent.id}
        defaultValues={{
          name: agent.name,
          role_summary: agent.role_summary ?? "",
          instructions: agent.instructions ?? "",
          provider: agent.provider,
          model: agent.model ?? "",
          allowed_work_types: agent.allowed_work_types as WorkType[],
          is_active: agent.is_active,
        }}
      />
    </>
  );
}
