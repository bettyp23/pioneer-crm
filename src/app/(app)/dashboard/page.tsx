import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FollowUpList } from "@/features/follow-ups/components/follow-up-list";
import { followUpBucket } from "@/features/follow-ups/schemas";
import { listOpenFollowUps } from "@/features/follow-ups/server/queries";
import { listLeads, listStages } from "@/features/leads/server/queries";
import { ensureRoutineRuns, listDueRuns, listIssues } from "@/features/operations/server/queries";
import { listPendingApprovals, listReadyTasks } from "@/features/projects/server/queries";
import { formatIsoDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

// Widgets planned for the "Today" dashboard (docs/architecture.md §8) that later milestones fill.
const UPCOMING_WIDGETS: { title: string; description: string; milestone: number }[] = [];

export default async function DashboardPage() {
  const { member } = await requireMember();
  const opsToday = await ensureRoutineRuns();
  const [{ followUps, today }, leads, stages, readyTasks, approvals, dueRuns, openIssues] =
    await Promise.all([
      listOpenFollowUps({ scope: "mine" }),
      listLeads(),
      listStages(),
      listReadyTasks(),
      listPendingApprovals(),
      listDueRuns(opsToday),
      listIssues({ open: true }),
    ]);
  const severeIssues = openIssues.filter((i) => i.severity === "high" || i.severity === "critical");
  const due = followUps.filter((f) => followUpBucket(f.due_on, today) !== "upcoming");
  const overdueCount = due.filter((f) => f.due_on < today).length;
  const openStageIds = new Set(stages.filter((s) => s.kind === "open").map((s) => s.id));
  const openLeads = leads.filter((l) => openStageIds.has(l.stage_id));
  const openValue = openLeads.reduce((sum, l) => sum + (l.estimated_value_minor ?? 0), 0);

  return (
    <>
      <PageHeader
        title={`Welcome, ${member.displayName}`}
        description={`Today in ${member.workspaceName}`}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              <h2>Follow-ups due</h2>
            </CardTitle>
            <CardDescription>
              {overdueCount} overdue · {due.length - overdueCount} due today (yours and unassigned).{" "}
              <Link href="/follow-ups" className="underline underline-offset-2">
                All follow-ups
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FollowUpList
              followUps={due.slice(0, 8)}
              today={today}
              canWrite={can(member.role, "records.write")}
              emptyTitle="Nothing due — you're all caught up"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <h2>Pipeline</h2>
            </CardTitle>
            <CardDescription>Open leads and your estimated value.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <p className="text-3xl font-semibold tabular-nums">{openLeads.length}</p>
            <p className="text-muted-foreground text-sm">
              open lead{openLeads.length === 1 ? "" : "s"} · {formatMoney(openValue)}
            </p>
            <Link href="/pipeline" className="mt-2 text-sm underline underline-offset-2">
              Open the pipeline
            </Link>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <h2>Tasks ready to start</h2>
            </CardTitle>
            <CardDescription>Every prerequisite and client input is in place.</CardDescription>
          </CardHeader>
          <CardContent>
            {readyTasks.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing ready right now.</p>
            ) : (
              <ul className="divide-y text-sm">
                {readyTasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                    <Link href={`/projects/${t.project?.id}`} className="hover:underline">
                      {t.title}
                      <span className="text-muted-foreground block text-xs">{t.project?.name}</span>
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {t.due_on ? `Due ${formatIsoDate(t.due_on)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <h2>Pending approvals</h2>
            </CardTitle>
            <CardDescription>
              {approvals.length} waiting.{" "}
              <Link href="/approvals" className="underline underline-offset-2">
                Approval inbox
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {approvals.length === 0 ? (
              <p className="text-muted-foreground text-sm">No approvals waiting.</p>
            ) : (
              <ul className="divide-y text-sm">
                {approvals.slice(0, 6).map((a) => (
                  <li key={a.id} className="py-2">
                    <Link
                      href={`/projects/${a.project?.id}?tab=approvals`}
                      className="hover:underline"
                    >
                      {a.title}
                    </Link>
                    <span className="text-muted-foreground block text-xs">
                      {a.project?.name} · {a.approver_type === "client" ? "client" : "internal"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <h2>Routines due</h2>
            </CardTitle>
            <CardDescription>
              {dueRuns.length} due or missed.{" "}
              <Link href="/routines" className="underline underline-offset-2">
                Routines
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dueRuns.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing due.</p>
            ) : (
              <ul className="divide-y text-sm">
                {dueRuns.slice(0, 6).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                    <Link href={`/routines/${r.routine?.id}`} className="hover:underline">
                      {r.routine?.name}
                      <span className="text-muted-foreground block text-xs">
                        {r.routine?.client?.name ?? "Internal"}
                      </span>
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {r.scheduled_for < opsToday ? "missed · " : ""}
                      {formatIsoDate(r.scheduled_for)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <h2>High-severity issues</h2>
            </CardTitle>
            <CardDescription>
              {severeIssues.length} open high or critical.{" "}
              <Link href="/issues" className="underline underline-offset-2">
                Issues
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {severeIssues.length === 0 ? (
              <p className="text-muted-foreground text-sm">None open.</p>
            ) : (
              <ul className="divide-y text-sm">
                {severeIssues.slice(0, 6).map((i) => (
                  <li key={i.id} className="py-2">
                    <Link href={`/issues/${i.id}`} className="hover:underline">
                      {i.title}
                    </Link>
                    <span className="text-muted-foreground block text-xs capitalize">
                      {i.client?.name} · {i.severity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {UPCOMING_WIDGETS.map((widget) => (
          <Card key={widget.title}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{widget.title}</CardTitle>
                <Badge variant="secondary">M{widget.milestone}</Badge>
              </div>
              <CardDescription>
                {widget.description} Available once milestone {widget.milestone} ships.
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </>
  );
}
