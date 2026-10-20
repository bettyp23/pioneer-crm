import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

// Widgets planned for the "Today" dashboard (docs/architecture.md §8). Each fills in when
// its module ships; until then it shows an empty state.
const WIDGETS = [
  { title: "Overdue follow-ups", description: "Follow-ups past their due date.", milestone: 2 },
  { title: "Tasks ready to start", description: "Tasks with every blocker cleared.", milestone: 4 },
  {
    title: "Pending approvals",
    description: "Internal and client approvals waiting.",
    milestone: 4,
  },
  { title: "Routines due", description: "Recurring operations due today.", milestone: 5 },
  { title: "High-severity issues", description: "Open high and critical issues.", milestone: 5 },
];

export default async function DashboardPage() {
  const { member } = await requireMember();

  return (
    <>
      <PageHeader
        title={`Welcome, ${member.displayName}`}
        description={`Today in ${member.workspaceName}`}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {WIDGETS.map((widget) => (
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
