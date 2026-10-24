import Link from "next/link";

import type { LeadRow } from "@/features/leads/server/queries";
import { formatIsoDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

import { MoveLeadForm } from "./move-lead-form";

type Stage = { id: string; name: string; kind: "open" | "won" | "lost" };

// Kanban by stage (FR-LEAD-2). Columns scroll horizontally; each card moves with an
// accessible stage selector instead of drag-and-drop.
export function PipelineBoard({
  leads,
  stages,
  canWrite,
}: {
  leads: LeadRow[];
  stages: Stage[];
  canWrite: boolean;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
      <ol className="flex min-w-max gap-4" aria-label="Pipeline stages">
        {stages.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage_id === stage.id);
          const total = stageLeads.reduce((sum, l) => sum + (l.estimated_value_minor ?? 0), 0);
          return (
            <li key={stage.id} className="bg-muted/40 flex w-72 flex-col gap-3 rounded-lg p-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-medium">
                  {stage.name}{" "}
                  <span className="text-muted-foreground font-normal">({stageLeads.length})</span>
                </h2>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {total > 0 ? formatMoney(total) : ""}
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {stageLeads.map((lead) => (
                  <li
                    key={lead.id}
                    className="bg-background flex flex-col gap-2 rounded-md border p-3 text-sm shadow-xs"
                  >
                    <div>
                      <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                        {lead.title}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {lead.client?.name}
                        {lead.estimated_value_minor !== null
                          ? ` · ${formatMoney(lead.estimated_value_minor, lead.currency)}`
                          : ""}
                        {lead.expected_close_on
                          ? ` · closes ${formatIsoDate(lead.expected_close_on)}`
                          : ""}
                      </p>
                      {stage.kind === "lost" && lead.lost_reason ? (
                        <p className="text-muted-foreground mt-1 text-xs italic">
                          {lead.lost_reason}
                        </p>
                      ) : null}
                    </div>
                    {canWrite ? (
                      <MoveLeadForm
                        leadId={lead.id}
                        leadTitle={lead.title}
                        currentStageId={lead.stage_id}
                        stages={stages}
                        compact
                      />
                    ) : null}
                  </li>
                ))}
                {stageLeads.length === 0 ? (
                  <li className="text-muted-foreground rounded-md border border-dashed p-3 text-center text-xs">
                    No leads
                  </li>
                ) : null}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
