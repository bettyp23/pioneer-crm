import { TabNav } from "@/components/layout/tab-nav";

export function AgentTabs({ active }: { active: "queue" | "roster" | "actions" | "usage" }) {
  return (
    <TabNav
      label="AI Command Center"
      active={active}
      tabs={[
        { key: "queue", label: "Queue", href: "/agents/queue" },
        { key: "roster", label: "Agents", href: "/agents/roster" },
        { key: "actions", label: "Actions", href: "/agents/actions" },
        { key: "usage", label: "Usage", href: "/agents/usage" },
      ]}
    />
  );
}
