import type { Metadata } from "next";

import { ActionForm } from "@/components/forms/action-form";
import { Textarea } from "@/components/forms/textarea";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APPROVAL_STATUS_LABELS } from "@/features/portal/schemas";
import { respondToApproval } from "@/features/portal/server/actions";
import { listPortalApprovals } from "@/features/portal/server/queries";
import { formatDate } from "@/lib/format";
import { requireClient } from "@/server/auth/session";

export const metadata: Metadata = { title: "Approvals" };

export default async function PortalApprovalsPage() {
  const { user } = await requireClient();
  const approvals = await listPortalApprovals();
  const waiting = approvals.filter((a) => a.status === "pending");
  const answered = approvals.filter((a) => a.status !== "pending");

  return (
    <>
      <PageHeader
        title="Approvals"
        description="When we need your OK before moving on, it shows up here. Your answer goes straight to us."
      />

      {waiting.length === 0 ? (
        <EmptyState title="Nothing is waiting for you">
          <p>We&apos;ll let you know when there&apos;s something to look at.</p>
        </EmptyState>
      ) : (
        waiting.map((approval) => (
          <Card key={approval.id}>
            <CardHeader>
              <CardTitle>
                <h2>{approval.title}</h2>
              </CardTitle>
              {approval.project ? <CardDescription>{approval.project.name}</CardDescription> : null}
            </CardHeader>
            <CardContent>
              {approval.details ? (
                <p className="mb-4 whitespace-pre-line">{approval.details}</p>
              ) : null}
              <ActionForm
                action={respondToApproval}
                successMessage="Thanks — we've got your answer."
                className="flex flex-col gap-3"
              >
                <input type="hidden" name="approvalId" value={approval.id} />
                <label htmlFor={`comment-${approval.id}`} className="text-sm font-medium">
                  Comment (optional)
                </label>
                <Textarea
                  id={`comment-${approval.id}`}
                  name="comment"
                  maxLength={2000}
                  placeholder="Anything we should know?"
                />
                <div className="flex gap-2">
                  <Button type="submit" name="decision" value="approved" className="flex-1">
                    Yes, approve
                  </Button>
                  <Button
                    type="submit"
                    name="decision"
                    value="rejected"
                    variant="outline"
                    className="flex-1"
                  >
                    No, needs changes
                  </Button>
                </div>
              </ActionForm>
            </CardContent>
          </Card>
        ))
      )}

      {answered.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Already answered</h2>
          <ul className="bg-background divide-y rounded-md border">
            {answered.map((approval) => (
              <li key={approval.id} className="flex flex-col gap-1 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{approval.title}</span>
                  <Badge variant={approval.status === "approved" ? "default" : "secondary"}>
                    {APPROVAL_STATUS_LABELS[approval.status] ?? approval.status}
                  </Badge>
                </div>
                {approval.decision_note ? (
                  <p className="text-muted-foreground text-sm">“{approval.decision_note}”</p>
                ) : null}
                {approval.decided_at ? (
                  <p className="text-muted-foreground text-xs">
                    {formatDate(approval.decided_at, user.client.timezone)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
