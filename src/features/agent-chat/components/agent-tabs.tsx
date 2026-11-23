import Link from "next/link";

import { AGENT_KEYS, AGENTS, type AgentKey } from "@/features/agent-chat/schemas";
import { cn } from "@/lib/utils";

export function AgentTabs({ active }: { active: AgentKey }) {
  return (
    <nav aria-label="Agents" className="flex gap-1 border-b">
      {AGENT_KEYS.map((key) => (
        <Link
          key={key}
          href={`/dashboard?agent=${key}`}
          aria-current={key === active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm",
            key === active
              ? "border-foreground font-medium"
              : "text-muted-foreground hover:text-foreground border-transparent",
          )}
        >
          {AGENTS[key].name}
        </Link>
      ))}
    </nav>
  );
}
