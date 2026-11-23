import type { Metadata } from "next";

import { ActionForm } from "@/components/forms/action-form";
import { NativeSelect } from "@/components/forms/native-select";
import { Textarea } from "@/components/forms/textarea";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { REQUEST_KIND_LABELS, REQUEST_STATUS_LABELS } from "@/features/portal/schemas";
import { submitRequest } from "@/features/portal/server/actions";
import { listPortalProjects, listPortalRequests } from "@/features/portal/server/queries";
import { formatDate } from "@/lib/format";
import { requireClient } from "@/server/auth/session";

export const metadata: Metadata = { title: "Requests" };

export default async function PortalRequestsPage() {
  const { user } = await requireClient();
  const [requests, projects] = await Promise.all([listPortalRequests(), listPortalProjects()]);

  return (
    <>
      <PageHeader
        title="Requests"
        description="Ask a question or ask for a change. You'll see our answer and progress here."
      />

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>New request</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={submitRequest}
            successMessage="Sent. We'll get back to you soon."
            className="flex flex-col gap-3"
          >
            <label htmlFor="request-kind" className="text-sm font-medium">
              What is it?
            </label>
            <NativeSelect id="request-kind" name="kind" defaultValue="question">
              <option value="question">A question</option>
              <option value="change">A change request</option>
            </NativeSelect>
            {projects.length > 1 ? (
              <>
                <label htmlFor="request-project" className="text-sm font-medium">
                  Which project?
                </label>
                <NativeSelect id="request-project" name="projectId" defaultValue="">
                  <option value="">Not sure / general</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </>
            ) : projects.length === 1 ? (
              <input type="hidden" name="projectId" value={projects[0]!.id} />
            ) : null}
            <label htmlFor="request-subject" className="text-sm font-medium">
              Short title
            </label>
            <Input id="request-subject" name="subject" required maxLength={200} />
            <label htmlFor="request-body" className="text-sm font-medium">
              Details
            </label>
            <Textarea id="request-body" name="body" required maxLength={5000} rows={5} />
            <Button type="submit" className="self-start">
              Send request
            </Button>
          </ActionForm>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Your requests</h2>
        {requests.length === 0 ? (
          <EmptyState title="No requests yet" />
        ) : (
          <ul className="bg-background divide-y rounded-md border">
            {requests.map((request) => (
              <li key={request.id} className="flex flex-col gap-1 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{request.subject}</span>
                  <Badge variant={request.status === "done" ? "secondary" : "default"}>
                    {REQUEST_STATUS_LABELS[request.status] ?? request.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs">
                  {REQUEST_KIND_LABELS[request.kind]} ·{" "}
                  {formatDate(request.created_at, user.client.timezone)}
                  {request.project ? ` · ${request.project.name}` : ""}
                </p>
                <p className="text-sm whitespace-pre-line">{request.body}</p>
                {request.admin_reply ? (
                  <div className="bg-muted mt-1 rounded-md p-2 text-sm">
                    <span className="font-medium">Our reply: </span>
                    <span className="whitespace-pre-line">{request.admin_reply}</span>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
