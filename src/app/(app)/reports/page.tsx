import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { INVOICE_STATUS_LABELS } from "@/features/operations/schemas";
import { getReports } from "@/features/operations/server/queries";
import { formatIsoDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Reports" };

const SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const Empty = ({ text }: { text: string }) => (
  <p className="text-muted-foreground text-sm">{text}</p>
);

export default async function ReportsPage() {
  await requireMember();
  const r = await getReports();
  const maxStage = Math.max(1, ...r.pipeline.map((s) => s.lead_count ?? 0));

  return (
    <>
      <PageHeader
        title="Reports"
        description="Operational snapshot. Dates use the workspace timezone."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Pipeline" description="Leads and estimated value by stage.">
          <ul className="flex flex-col gap-2 text-sm">
            {r.pipeline.map((s) => (
              <li key={s.stage_id} className="grid grid-cols-[8rem_1fr_6rem] items-center gap-2">
                <span className="truncate">{s.stage_name}</span>
                <div className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden>
                  <div
                    className="bg-primary h-full"
                    style={{ width: `${(100 * (s.lead_count ?? 0)) / maxStage}%` }}
                  />
                </div>
                <span className="text-right tabular-nums">
                  {s.lead_count} · {formatMoney(s.estimated_value_minor ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Receivables"
          description="Invoice metadata by status (sent past due = overdue)."
        >
          {r.receivables.length === 0 ? (
            <Empty text="No invoices recorded." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.receivables.map((x) => (
                  <TableRow key={`${x.status}-${x.currency}`}>
                    <TableCell>{x.status ? INVOICE_STATUS_LABELS[x.status] : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{x.invoice_count}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(x.amount_minor ?? 0, x.currency ?? "USD")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>

        <Section
          title="Project health"
          description="Active projects: progress, blockers, waiting items."
        >
          {r.health.length === 0 ? (
            <Empty text="No active projects." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">Done</TableHead>
                  <TableHead className="text-right">Overdue</TableHead>
                  <TableHead className="text-right">Blocked</TableHead>
                  <TableHead className="text-right">Waiting</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.health.map((p) => (
                  <TableRow key={p.project_id}>
                    <TableCell>
                      <Link href={`/projects/${p.project_id}`} className="hover:underline">
                        {p.name}
                      </Link>
                      <span className="text-muted-foreground block text-xs">{p.client_name}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.percent_done ?? 0}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.overdue_tasks ?? 0}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.blocked_tasks ?? 0}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {p.pending_approvals ?? 0} approvals · {p.open_inputs ?? 0} inputs
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>

        <Section
          title="Overdue tasks"
          description="Open tasks past their due date in active projects."
        >
          {r.overdue.length === 0 ? (
            <Empty text="Nothing overdue." />
          ) : (
            <ul className="divide-y text-sm">
              {r.overdue.map((t) => (
                <li key={t.task_id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/projects/${t.project_id}`} className="hover:underline">
                    {t.title}
                    <span className="text-muted-foreground block text-xs">{t.project_name}</span>
                  </Link>
                  <Badge variant="destructive">
                    {t.days_overdue}d · {t.due_on ? formatIsoDate(t.due_on) : ""}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Routine compliance" description="Last 90 days: done vs. due occurrences.">
          {r.compliance.length === 0 ? (
            <Empty text="No active routines." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Routine</TableHead>
                  <TableHead className="text-right">Compliance</TableHead>
                  <TableHead className="text-right">Missed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.compliance.map((c) => (
                  <TableRow key={c.routine_id}>
                    <TableCell>
                      <Link href={`/routines/${c.routine_id}`} className="hover:underline">
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.compliance_percent === null ? "—" : `${c.compliance_percent}%`} (
                      {c.done_runs}/{c.due_runs})
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.missed_runs}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>

        <Section title="Open issues" description="By severity.">
          {r.issues.length === 0 ? (
            <Empty text="No open issues." />
          ) : (
            <ul className="flex flex-wrap gap-2">
              {SEVERITY_ORDER.map((sev) => {
                const row = r.issues.find((i) => i.severity === sev);
                return (
                  <li key={sev}>
                    <Link href="/issues">
                      <Badge
                        variant={sev === "critical" ? "destructive" : "secondary"}
                        className="capitalize"
                      >
                        {sev}: {row?.open_count ?? 0}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
