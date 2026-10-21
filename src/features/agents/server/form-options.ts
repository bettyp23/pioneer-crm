import "server-only";

import type { WorkType } from "@/features/agents/schemas";
import { listAgents } from "@/features/agents/server/queries";
import { listClientOptions } from "@/features/clients/server/queries";
import { listProjectOptions } from "@/features/operations/server/queries";

export async function getWorkItemFormOptions() {
  const [agents, clients, projects] = await Promise.all([
    listAgents(),
    listClientOptions(),
    listProjectOptions(),
  ]);
  return {
    agents: agents
      .filter((a) => a.is_active)
      .map((a) => ({ id: a.id, name: a.name, workTypes: a.allowed_work_types as WorkType[] })),
    clients,
    projects,
  };
}
