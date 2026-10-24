import type { Metadata } from "next";

import { StageSettings } from "@/features/leads/components/stage-settings";
import { listLeads, listStages } from "@/features/leads/server/queries";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "Pipeline stages" };

export default async function PipelineSettingsPage() {
  await requirePagePermission("pipeline.configure");
  const [stages, leads] = await Promise.all([listStages(), listLeads()]);
  const counts = new Map<string, number>();
  for (const lead of leads) counts.set(lead.stage_id, (counts.get(lead.stage_id) ?? 0) + 1);

  return (
    <section className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Rename, reorder and add the stages your leads move through.
      </p>
      <StageSettings
        stages={stages.map((s) => ({
          id: s.id,
          name: s.name,
          kind: s.kind,
          leadCount: counts.get(s.id) ?? 0,
        }))}
      />
    </section>
  );
}
