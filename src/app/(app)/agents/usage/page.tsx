import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AgentTabs } from "@/features/agents/components/agent-tabs";
import { BudgetForm, UsageForm } from "@/features/agents/components/usage-forms";
import { formatMicroUsd, PROVIDER_LABELS } from "@/features/agents/schemas";
import { getUsageSummary } from "@/features/agents/server/queries";
import { formatDateTime } from "@/lib/format";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "AI usage" };

export default async function UsagePage() {
  const { member } = await requireMember();
  const { spend, ledger } = await getUsageSummary();
  const isOwner = can(member.role, "workspace.manage");
  return (
    <>
      <PageHeader
        title="AI Command Center"
        description="Monthly caps per provider. Connectors (later) must pass the cap check before every call."
      />
      <AgentTabs active="usage" />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead className="text-right">Spent this month</TableHead>
              <TableHead>Monthly cap</TableHead>
              <TableHead>Used</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {spend.map((s) => {
              const capMicro = (s.monthly_cap_minor ?? 0) * 10000;
              const pct =
                capMicro > 0
                  ? Math.min(100, Math.round((100 * (s.spent_microusd ?? 0)) / capMicro))
                  : 0;
              return (
                <TableRow key={s.provider}>
                  <TableCell>{s.provider ? PROVIDER_LABELS[s.provider] : ""}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMicroUsd(s.spent_microusd ?? 0)}
                  </TableCell>
                  <TableCell>
                    {isOwner && s.provider ? (
                      <BudgetForm
                        provider={s.provider}
                        capDollars={String((s.monthly_cap_minor ?? 0) / 100)}
                      />
                    ) : (
                      `$${(s.monthly_cap_minor ?? 0) / 100}`
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="bg-muted h-2 w-24 overflow-hidden rounded-full"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${s.provider} budget used`}
                      >
                        <div
                          className={pct >= 90 ? "bg-destructive h-full" : "bg-primary h-full"}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground text-xs tabular-nums">{pct}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {can(member.role, "records.write") ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Record a cost</h2>
          <p className="text-muted-foreground text-xs">
            For now, copy costs from your xAI or Anthropic console. Connectors will record them
            automatically.
          </p>
          <UsageForm />
        </section>
      ) : null}
      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Ledger</h2>
        {ledger.length === 0 ? (
          <p className="text-muted-foreground text-sm">No costs recorded yet.</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {ledger.map((u) => (
              <li key={u.id} className="flex flex-wrap justify-between gap-2 p-3">
                <span>
                  {PROVIDER_LABELS[u.provider]}
                  {u.note ? ` · ${u.note}` : ""}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {formatMicroUsd(u.cost_microusd)} ·{" "}
                  {formatDateTime(u.occurred_at, member.workspaceTimezone)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
