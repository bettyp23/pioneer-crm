import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PROJECT_STATUS_LABELS, TASK_STATUS_LABELS } from "@/features/portal/schemas";
import { countPendingApprovals, listPortalProjects } from "@/features/portal/server/queries";
import { formatDay } from "@/lib/format";
import { requireClient } from "@/server/auth/session";

export const metadata: Metadata = { title: "My project" };

export default async function PortalHomePage() {
  const { user } = await requireClient();
  const [projects, pendingApprovals] = await Promise.all([
    listPortalProjects(),
    countPendingApprovals(),
  ]);

  return (
    <>
      <PageHeader
        title={`Hi, ${user.displayName.split(" ")[0]}`}
        description="Here's where your project stands."
      />

      {pendingApprovals > 0 ? (
        <Alert>
          <AlertTitle>
            {pendingApprovals === 1
              ? "1 item is waiting for your yes or no"
              : `${pendingApprovals} items are waiting for your yes or no`}
          </AlertTitle>
          <AlertDescription>
            <Link href="/portal/approvals" className="underline">
              Review approvals
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      {projects.length === 0 ? (
        <EmptyState title="No project here yet">
          <p>We&apos;ll add your project as soon as work starts.</p>
        </EmptyState>
      ) : (
        projects.map((project) => {
          const steps = project.tasks.filter((t) => t.status !== "cancelled");
          const done = steps.filter((t) => t.status === "done").length;
          return (
            <Card key={project.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>
                    <h2>{project.name}</h2>
                  </CardTitle>
                  <Badge variant={project.status === "active" ? "default" : "secondary"}>
                    {PROJECT_STATUS_LABELS[project.status] ?? project.status}
                  </Badge>
                </div>
                {steps.length > 0 ? (
                  <CardDescription>
                    {done} of {steps.length} steps done
                  </CardDescription>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground text-xs uppercase">Current phase</dt>
                    <dd className="font-medium">{project.current_phase ?? "Getting started"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs uppercase">Launch date</dt>
                    <dd className="font-medium">
                      {project.launch_on ? formatDay(project.launch_on) : "Not set yet"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground text-xs uppercase">What happens next</dt>
                    <dd className="whitespace-pre-line">
                      {project.next_steps ?? "We'll update this as the project moves along."}
                    </dd>
                  </div>
                </dl>
                {steps.length > 0 ? (
                  <section aria-label="Steps">
                    <h3 className="mb-2 text-sm font-medium">Steps</h3>
                    <ol className="divide-y rounded-md border">
                      {steps.map((step) => (
                        <li key={step.id} className="flex items-center justify-between gap-3 p-3">
                          <span className={step.status === "done" ? "text-muted-foreground" : ""}>
                            {step.title}
                            {step.due_on && step.status !== "done" ? (
                              <span className="text-muted-foreground block text-xs">
                                Target: {formatDay(step.due_on)}
                              </span>
                            ) : null}
                          </span>
                          <Badge variant={step.status === "done" ? "secondary" : "outline"}>
                            {TASK_STATUS_LABELS[step.status] ?? step.status}
                          </Badge>
                        </li>
                      ))}
                    </ol>
                  </section>
                ) : null}
              </CardContent>
            </Card>
          );
        })
      )}
    </>
  );
}
