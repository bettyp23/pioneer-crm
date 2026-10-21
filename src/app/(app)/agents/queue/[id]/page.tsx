import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ProposeActionForm } from "@/features/agents/components/propose-action-form";
import { UsageForm } from "@/features/agents/components/usage-forms";
import { WorkItemPanel } from "@/features/agents/components/work-item-panel";
import {
  ACTION_STATUS_LABELS,
  ACTION_TYPE_LABELS,
  buildPrompt,
  formatMicroUsd,
  PROVIDER_LABELS,
  WORK_STATUS_LABELS,
  WORK_TYPE_LABELS,
} from "@/features/agents/schemas";
import { getWorkItem } from "@/features/agents/server/queries";
import { listMembers } from "@/features/workspace/server/queries";
import { SENSITIVITY_LABELS, type SensitivityFlag } from "@/lib/ai/sensitivity";
import { formatDateTime } from "@/lib/format";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Work item" };

export default async function WorkItemPage({ params }: PageProps<"/agents/queue/[id]">) {
  const { member } = await requireMember();
  const item = await getWorkItem((await params).id);
  const members = await listMembers();
  const names = new Map(members.map((m) => [m.user_id, m.profile?.display_name ?? "Unknown"]));
  const tz = member.workspaceTimezone;
  const flags = (
    Array.isArray(item.sensitivity_flags) ? item.sensitivity_flags : []
  ) as SensitivityFlag[];
  const canWrite = can(member.role, "records.write");
  const prompt = buildPrompt({
    agentName: item.agent?.name ?? "Agent",
    agentInstructions: item.agent?.instructions ?? null,
    title: item.title,
    instructions: item.instructions,
    context: item.context_snapshot ?? "",
  });

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">
          <Link href="/agents/queue" className="hover:underline">
            AI Command Center
          </Link>
          {item.agent ? (
            <>
              {" · "}
              <Link href={`/agents/roster/${item.agent.id}`} className="hover:underline">
                {item.agent.name}
              </Link>
            </>
          ) : null}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge>{WORK_STATUS_LABELS[item.status]}</Badge>
          <span className="text-muted-foreground">
            {WORK_TYPE_LABELS[item.work_type]}
            {item.client ? ` · ${item.client.name}` : ""}
            {item.project ? ` · ${item.project.name}` : ""}
            {item.dispatched_at
              ? ` · sent ${formatDateTime(item.dispatched_at, tz)} by ${names.get(item.dispatched_by ?? "") ?? "—"}`
              : ""}
          </span>
        </div>
      </div>

      {flags.length > 0 ? (
        <Alert variant={item.override_reason ? "default" : "destructive"}>
          <AlertTitle>Sensitive content flagged ({flags.length})</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {flags.map((f, i) => (
                <li key={i}>
                  {SENSITIVITY_LABELS[f.kind] ?? f.kind}: {f.sample}
                </li>
              ))}
            </ul>
            {item.override_reason ? (
              <p className="mt-2">Sent anyway because: {item.override_reason}</p>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {canWrite && !["accepted", "rejected", "cancelled"].includes(item.status) ? (
        <WorkItemPanel
          id={item.id}
          status={item.status}
          version={item.version}
          flagged={flags.length > 0}
          prompt={prompt}
          canDispatch={can(member.role, "agents.dispatch")}
        />
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Prompt</h2>
        <p className="text-muted-foreground text-xs">
          Agent instructions + task + the frozen context. Copy it into the Grok app or Claude when
          the item is ready.
        </p>
        <pre className="bg-muted/50 max-h-96 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
          {prompt}
        </pre>
      </section>

      {item.output_text || item.output_url ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Output</h2>
          <p className="text-muted-foreground text-xs">
            Returned {item.returned_at ? formatDateTime(item.returned_at, tz) : ""}
            {item.reviewed_at
              ? ` · ${item.status} by ${names.get(item.reviewed_by ?? "") ?? "—"}${item.review_note ? `: ${item.review_note}` : ""}`
              : ""}
          </p>
          {item.output_text ? (
            <pre className="max-h-[32rem] overflow-auto rounded-md border p-3 text-sm whitespace-pre-wrap">
              {item.output_text}
            </pre>
          ) : null}
          {item.output_url ? (
            <a
              href={item.output_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline"
            >
              Open the output
            </a>
          ) : null}
        </section>
      ) : null}

      {["returned", "accepted"].includes(item.status) || item.actions.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Actions for approval</h2>
          {item.actions.length > 0 ? (
            <ul className="divide-y rounded-md border text-sm">
              {item.actions.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 p-3">
                  <span>
                    {a.title}{" "}
                    <span className="text-muted-foreground">
                      · {ACTION_TYPE_LABELS[a.action_type]}
                    </span>
                  </span>
                  <Badge variant="secondary">{ACTION_STATUS_LABELS[a.status]}</Badge>
                </li>
              ))}
            </ul>
          ) : null}
          {canWrite && ["returned", "accepted"].includes(item.status) ? (
            <ProposeActionForm
              workItemId={item.id}
              clientId={item.client_id}
              defaultDetails={item.output_text ?? ""}
            />
          ) : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Cost</h2>
        {item.usage.length > 0 ? (
          <ul className="text-sm">
            {item.usage.map((u) => (
              <li key={u.id}>
                {formatMicroUsd(u.cost_microusd)} · {PROVIDER_LABELS[u.provider]}
                {u.note ? ` · ${u.note}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No cost recorded.</p>
        )}
        {canWrite ? <UsageForm workItemId={item.id} /> : null}
      </section>
    </>
  );
}
