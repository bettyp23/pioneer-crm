import { TabNav } from "@/components/layout/tab-nav";
import { AiPauseControl } from "@/features/agents/components/ai-pause-control";
import { getAiPauseState } from "@/features/agents/server/queries";
import { formatDateTime } from "@/lib/format";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export async function AgentTabs({
  active,
}: {
  active: "queue" | "roster" | "actions" | "jobs" | "usage";
}) {
  const [{ member }, pause] = await Promise.all([requireMember(), getAiPauseState()]);
  return (
    <>
      <AiPauseControl
        pausedLabel={
          pause.pausedAt ? formatDateTime(pause.pausedAt, member.workspaceTimezone) : null
        }
        reason={pause.reason}
        canControl={can(member.role, "agents.kill_switch")}
      />
      <TabNav
        label="AI Command Center"
        active={active}
        tabs={[
          { key: "queue", label: "Queue", href: "/agents/queue" },
          { key: "roster", label: "Agents", href: "/agents/roster" },
          { key: "actions", label: "Actions", href: "/agents/actions" },
          { key: "jobs", label: "Jobs", href: "/agents/jobs" },
          { key: "usage", label: "Usage", href: "/agents/usage" },
        ]}
      />
    </>
  );
}
