import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { AgentTabs } from "@/features/agents/components/agent-tabs";
import { PROVIDER_LABELS, WORK_TYPE_LABELS, type WorkType } from "@/features/agents/schemas";
import { listAgents } from "@/features/agents/server/queries";
import { formatDateTime } from "@/lib/format";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Agents" };

// Connected agents (M8): "Verified" only after a real round trip — a reply row that matched its
// job and one-time code.
const CONNECTION_STATE: Record<string, string> = {
  not_connected: "Not verified yet",
  verified: "Verified",
  error: "Connection error",
};

export default async function RosterPage() {
  const { member } = await requireMember();
  const agents = await listAgents();
  return (
    <>
      <PageHeader
        title="AI Command Center"
        description="Your agent team. Agents have no login, no database access and no keys. The worker on your Mac reaches Pioneer (Claude) and Michael Scott (Grok) for you."
      />
      <AgentTabs active="roster" />
      <ul className="grid gap-3 md:grid-cols-2">
        {agents.map((a) => (
          <li key={a.id} className="flex flex-col gap-1 rounded-md border p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/agents/roster/${a.id}`} className="font-medium hover:underline">
                {a.name}
              </Link>
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary">{PROVIDER_LABELS[a.provider]}</Badge>
                {a.kind !== "manual" ? (
                  <Badge variant={a.integration_state === "verified" ? "default" : "outline"}>
                    {CONNECTION_STATE[a.integration_state] ?? a.integration_state}
                  </Badge>
                ) : null}
                {a.is_active ? null : <Badge variant="outline">Inactive</Badge>}
                {a.kind === "manual" && !a.instructions?.trim() ? (
                  <Badge variant="outline">No instructions yet</Badge>
                ) : null}
              </div>
            </div>
            {a.last_verified_at ? (
              <p className="text-muted-foreground text-xs">
                Last round trip {formatDateTime(a.last_verified_at, member.workspaceTimezone)}
              </p>
            ) : null}
            <p className="text-muted-foreground">{a.role_summary}</p>
            <p className="text-muted-foreground text-xs">
              Takes:{" "}
              {(a.allowed_work_types as WorkType[]).map((t) => WORK_TYPE_LABELS[t]).join(", ")}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
