import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { listContactOptions } from "@/features/contacts/server/queries";
import { DecideApproval } from "@/features/projects/components/decide-approval";
import { listPendingApprovals } from "@/features/projects/server/queries";
import { formatDateTime } from "@/lib/format";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  const { member } = await requireMember();
  const [approvals, contacts] = await Promise.all([listPendingApprovals(), listContactOptions()]);
  const canWrite = can(member.role, "records.write");
  const canInternal = can(member.role, "approvals.decide_internal");

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Pending approvals across projects. Client approvals need an evidence link."
      />
      {approvals.length === 0 ? (
        <EmptyState title="Nothing waiting for approval" />
      ) : (
        <ul className="flex flex-col gap-3">
          {approvals.map((a) => (
            <li key={a.id} className="flex flex-col gap-2 rounded-md border p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{a.title}</span>
                <Badge variant={a.approver_type === "client" ? "secondary" : "outline"}>
                  {a.approver_type === "client" ? "Client approval" : "Internal approval"}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs">
                {a.project ? (
                  <Link
                    href={`/projects/${a.project.id}?tab=approvals`}
                    className="underline underline-offset-2"
                  >
                    {a.project.name}
                  </Link>
                ) : null}
                {a.project?.client ? ` · ${a.project.client.name}` : ""} · requested{" "}
                {formatDateTime(a.created_at, member.workspaceTimezone)}
                {a.task ? ` · task is ${a.task.status.replace("_", " ")}` : ""}
              </p>
              {canWrite ? (
                <DecideApproval
                  approvalId={a.id}
                  title={a.title}
                  version={a.version}
                  approverType={a.approver_type}
                  contacts={contacts
                    .filter((c) => c.clientId === a.client_id)
                    .map((c) => ({ id: c.id, name: c.name }))}
                  canDecide={a.approver_type === "client" || canInternal}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
