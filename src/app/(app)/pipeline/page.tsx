import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { TabNav } from "@/components/layout/tab-nav";
import { Button } from "@/components/ui/button";
import { LeadTable } from "@/features/leads/components/lead-table";
import { PipelineBoard } from "@/features/leads/components/pipeline-board";
import { pipelineViewSchema } from "@/features/leads/schemas";
import { listLeads, listStages } from "@/features/leads/server/queries";
import { formatMoney } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage({ searchParams }: PageProps<"/pipeline">) {
  const { member } = await requireMember();
  const view = pipelineViewSchema.parse((await searchParams).view);
  const [leads, stages] = await Promise.all([listLeads(), listStages()]);
  const openStageIds = new Set(stages.filter((s) => s.kind === "open").map((s) => s.id));
  const openLeads = leads.filter((l) => openStageIds.has(l.stage_id));
  const openValue = openLeads.reduce((sum, l) => sum + (l.estimated_value_minor ?? 0), 0);
  const canWrite = can(member.role, "records.write");

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Pipeline"
          description={`${openLeads.length} open lead${openLeads.length === 1 ? "" : "s"} · ${formatMoney(openValue)} estimated`}
        />
        <div className="flex gap-2">
          {can(member.role, "pipeline.configure") ? (
            <Button variant="outline" asChild>
              <Link href="/settings/pipeline">Edit stages</Link>
            </Button>
          ) : null}
          {canWrite ? (
            <Button asChild>
              <Link href="/leads/new">New lead</Link>
            </Button>
          ) : null}
        </div>
      </div>
      <TabNav
        label="Pipeline view"
        active={view}
        tabs={[
          { key: "board", label: "Board", href: "/pipeline" },
          { key: "list", label: "List", href: "/pipeline?view=list" },
        ]}
      />
      {view === "board" ? (
        <PipelineBoard leads={leads} stages={stages} canWrite={canWrite} />
      ) : (
        <LeadTable leads={leads} stages={stages} />
      )}
    </>
  );
}
