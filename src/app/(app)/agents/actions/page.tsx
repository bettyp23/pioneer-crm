import type { Metadata } from "next";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ActionCard } from "@/features/agents/components/action-card";
import { AgentTabs } from "@/features/agents/components/agent-tabs";
import { ProposeActionForm } from "@/features/agents/components/propose-action-form";
import { listActions } from "@/features/agents/server/queries";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Actions" };

export default async function ActionsPage() {
  const { member } = await requireMember();
  const actions = await listActions();
  const canDecide = can(member.role, "agents.dispatch");
  const isOwner = member.role === "owner";
  const pending = actions.filter((a) => a.status === "pending" || a.status === "approved");
  const done = actions.filter((a) => a.status !== "pending" && a.status !== "approved");
  return (
    <>
      <PageHeader
        title="AI Command Center"
        description="Approval Center: nothing is sent, deployed, priced or signed until it is approved here."
      />
      <AgentTabs active="actions" />
      {can(member.role, "records.write") ? <ProposeActionForm /> : null}
      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Waiting ({pending.length})</h2>
        {pending.length === 0 ? (
          <EmptyState title="Nothing waiting for approval" />
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((a) => (
              <ActionCard key={a.id} action={a} canDecide={canDecide} isOwner={isOwner} />
            ))}
          </ul>
        )}
      </section>
      {done.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">History ({done.length})</h2>
          <ul className="flex flex-col gap-3">
            {done.map((a) => (
              <ActionCard key={a.id} action={a} canDecide={false} isOwner={isOwner} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
