import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { TabNav } from "@/components/layout/tab-nav";
import { Button } from "@/components/ui/button";
import { IssueTable } from "@/features/operations/components/issue-table";
import { listIssues } from "@/features/operations/server/queries";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Issues" };

const paramsSchema = z.object({
  view: z.enum(["open", "all"]).catch("open"),
  client: z.uuid().optional().catch(undefined),
});

export default async function IssuesPage({ searchParams }: PageProps<"/issues">) {
  const { member } = await requireMember();
  const params = paramsSchema.parse(await searchParams);
  const issues = await listIssues({ open: params.view === "open", clientId: params.client });
  const suffix = params.client ? `&client=${params.client}` : "";
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Issues"
          description="Problems to fix, from diagnostics, projects or anywhere."
        />
        {can(member.role, "records.write") ? (
          <Button asChild>
            <Link href="/issues/new">Open issue</Link>
          </Button>
        ) : null}
      </div>
      <TabNav
        label="Issue filter"
        active={params.view}
        tabs={[
          { key: "open", label: "Open", href: `/issues?view=open${suffix}` },
          { key: "all", label: "All", href: `/issues?view=all${suffix}` },
        ]}
      />
      {issues.length === 0 ? <EmptyState title="No issues" /> : <IssueTable issues={issues} />}
    </>
  );
}
