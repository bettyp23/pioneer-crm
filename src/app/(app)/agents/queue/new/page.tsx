import type { Metadata } from "next";
import { z } from "zod";

import { PageHeader } from "@/components/layout/page-header";
import { WorkItemForm } from "@/features/agents/components/work-item-form";
import { CONTEXT_SECTION_KEYS, CONTEXT_SECTIONS } from "@/features/agents/schemas";
import { getWorkItemFormOptions } from "@/features/agents/server/form-options";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "New work item" };

export default async function NewWorkItemPage({ searchParams }: PageProps<"/agents/queue/new">) {
  await requirePagePermission("records.write");
  const options = await getWorkItemFormOptions();
  const sp = await searchParams;
  const requestedAgent = z.uuid().catch("").parse(sp.agent);
  const agent = options.agents.find((a) => a.id === requestedAgent);
  const client = z.uuid().catch("").parse(sp.client);
  const first = agent ?? options.agents[0];
  return (
    <>
      <PageHeader
        title="New work item"
        description="Pioneer OS builds the context on the server and flags anything sensitive before it can be sent."
      />
      <WorkItemForm
        {...options}
        defaultValues={{
          agent_id: first?.id ?? "",
          client_id: options.clients.some((c) => c.id === client) ? client : "",
          project_id: "",
          work_type: first?.workTypes[0] ?? "research",
          title: "",
          instructions: "",
          context_options: Object.fromEntries(
            CONTEXT_SECTION_KEYS.map((k) => [k, CONTEXT_SECTIONS[k].default]),
          ) as Record<(typeof CONTEXT_SECTION_KEYS)[number], boolean>,
        }}
      />
    </>
  );
}
