import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FollowUpList } from "@/features/follow-ups/components/follow-up-list";
import { followUpBucket } from "@/features/follow-ups/schemas";
import { listOpenFollowUps } from "@/features/follow-ups/server/queries";
import { listLeads, listStages } from "@/features/leads/server/queries";
import { formatMoney } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

// Widgets planned for the "Today" dashboard (docs/architecture.md §8) that later milestones fill.
const UPCOMING_WIDGETS = [
  { title: "Tasks ready to start", description: "Tasks with every blocker cleared.", milestone: 4 },
  { title: "Pending approvals", description: "Approvals waiting on a decision.", milestone: 4 },
  { title: "Routines due", description: "Recurring operations due today.", milestone: 5 },
  { title: "High-severity issues", description: "Open high and critical issues.", milestone: 5 },
];

export default async function DashboardPage() {
  const { member } = await requireMember();
  const [{ followUps, today }, leads, stages] = await Promise.all([
    listOpenFollowUps({ scope: "mine" }),
    listLeads(),
    listStages(),
  ]);
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
