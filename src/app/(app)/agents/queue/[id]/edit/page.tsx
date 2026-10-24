import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { WorkItemForm } from "@/features/agents/components/work-item-form";
import { CONTEXT_SECTION_KEYS, CONTEXT_SECTIONS, type WorkType } from "@/features/agents/schemas";
import { getWorkItemFormOptions } from "@/features/agents/server/form-options";
import { getWorkItem } from "@/features/agents/server/queries";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "Edit work item" };

export default async function EditWorkItemPage({ params }: PageProps<"/agents/queue/[id]/edit">) {
  await requirePagePermission("records.write");
  const item = await getWorkItem((await params).id);
  if (item.status !== "draft") notFound();
  const options = await getWorkItemFormOptions();
  const saved = (item.context_options ?? {}) as Record<string, unknown>;
  return (
    <>
      <PageHeader title={`Edit ${item.title}`} />
      <WorkItemForm
        itemId={item.id}
        {...options}
        defaultValues={{
          agent_id: item.agent_id,
          client_id: item.client_id ?? "",
          project_id: item.project_id ?? "",
          work_type: item.work_type as WorkType,
          title: item.title,
          instructions: item.instructions,
          context_options: Object.fromEntries(
            CONTEXT_SECTION_KEYS.map((k) => [
              k,
              typeof saved[k] === "boolean" ? saved[k] : CONTEXT_SECTIONS[k].default,
            ]),
          ) as Record<(typeof CONTEXT_SECTION_KEYS)[number], boolean>,
        }}
      />
    </>
  );
}
