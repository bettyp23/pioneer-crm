import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { listMemberOptions } from "@/features/leads/server/queries";
import { IssueForm } from "@/features/operations/components/issue-form";
import { IssueStatusControl } from "@/features/operations/components/issue-status-control";
import { SEVERITY_VARIANT } from "@/features/operations/components/issue-table";
import { ISSUE_STATUS_LABELS } from "@/features/operations/schemas";
import { getIssue } from "@/features/operations/server/queries";
import { formatIsoDate } from "@/lib/dates";
import { formatDateTime } from "@/lib/format";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Issue" };

export default async function IssuePage({ params }: PageProps<"/issues/[id]">) {
  const { member } = await requireMember();
  const issue = await getIssue((await params).id);
  const canWrite = can(member.role, "records.write");
  const members = canWrite ? await listMemberOptions() : [];
  const tz = member.workspaceTimezone;

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">
          <Link href="/issues" className="hover:underline">
            Issues
          </Link>
          {" · "}
          <Link href={`/clients/${issue.client?.id}`} className="hover:underline">
            {issue.client?.name}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{issue.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={SEVERITY_VARIANT[issue.severity]} className="capitalize">
            {issue.severity}
          </Badge>
          <span>{ISSUE_STATUS_LABELS[issue.status]}</span>
          <span className="text-muted-foreground">
            · opened {formatDateTime(issue.opened_at, tz)}
            {issue.resolved_at ? ` · closed ${formatDateTime(issue.resolved_at, tz)}` : ""}
            {issue.diagnostic
              ? ` · from ${issue.diagnostic.diagnostic_type} (${formatIsoDate(issue.diagnostic.performed_on)})`
              : ""}
          </span>
        </div>
        {issue.resolution ? (
          <p className="bg-muted/50 max-w-2xl rounded-md p-3 text-sm">
            Resolution: {issue.resolution}
          </p>
        ) : null}
      </div>
      {canWrite ? (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="font-medium">Status</h2>
            <IssueStatusControl issueId={issue.id} status={issue.status} />
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="font-medium">Details</h2>
            <IssueForm
              issueId={issue.id}
              clients={[]}
              diagnostics={[]}
              members={members}
              defaultValues={{
                client_id: issue.client_id,
                diagnostic_id: issue.diagnostic_id ?? "",
                title: issue.title,
                description: issue.description ?? "",
                severity: issue.severity,
                assignee_user_id: issue.assignee_user_id ?? "",
              }}
            />
          </section>
        </>
      ) : issue.description ? (
        <p className="max-w-2xl text-sm whitespace-pre-wrap">{issue.description}</p>
      ) : null}
    </>
  );
}
