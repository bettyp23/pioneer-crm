import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { EmptyState } from "@/components/layout/empty-state";
import { TabNav } from "@/components/layout/tab-nav";
import { Badge } from "@/components/ui/badge";
import { contactName } from "@/features/contacts/schemas";
import { listClientContacts } from "@/features/contacts/server/queries";
import { INPUT_KIND_LABELS } from "@/features/blueprints/schemas";
import { listMemberOptions } from "@/features/leads/server/queries";
import { DecideApproval } from "@/features/projects/components/decide-approval";
import { InputRequestActions } from "@/features/projects/components/input-request-actions";
import { ProjectStatusControl } from "@/features/projects/components/project-status-control";
import { TaskActions, TaskDetailsForm } from "@/features/projects/components/task-actions";
import { getProject } from "@/features/projects/server/queries";
import {
  APPROVAL_STATUS_LABELS,
  INPUT_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  TASK_STATUS_LABELS,
} from "@/features/projects/transitions";
import { listMembers } from "@/features/workspace/server/queries";
import { dateInZone, formatIsoDate } from "@/lib/dates";
import { formatDateTime } from "@/lib/format";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Project" };

const tabSchema = z.enum(["tasks", "inputs", "approvals", "details"]).catch("tasks");

const TASK_VARIANT = {
  todo: "outline",
  in_progress: "default",
  in_review: "secondary",
  on_hold: "outline",
  done: "secondary",
  cancelled: "outline",
} as const;

export default async function ProjectPage({ params, searchParams }: PageProps<"/projects/[id]">) {
  const { member } = await requireMember();
  const { project, tasks, inputs, approvals, progress } = await getProject((await params).id);
  const tab = tabSchema.parse((await searchParams).tab);
  const tz = member.workspaceTimezone;
  const today = dateInZone(new Date(), tz);
  const canWrite = can(member.role, "records.write") && project.status !== "cancelled";
  const isAdmin = can(member.role, "approvals.decide_internal");
  const [memberOptions, members, contacts] = await Promise.all([
    listMemberOptions(),
    listMembers(),
    listClientContacts(project.client_id),
  ]);
  const names = new Map(members.map((m) => [m.user_id, m.profile?.display_name ?? "Unknown"]));
  const pendingApprovalTasks = new Set(
    approvals.filter((a) => a.status === "pending").map((a) => a.task_id),
  );
  const approvedTasks = new Set(
    approvals.filter((a) => a.status === "approved").map((a) => a.task_id),
  );
  const openInputs = inputs.filter((i) => !["accepted", "waived"].includes(i.status)).length;
  const pendingApprovals = approvals.filter((a) => a.status === "pending").length;
  const phases = [...new Set(tasks.map((t) => t.phase ?? "Other"))];
  const href = (t: string) => `/projects/${project.id}${t === "tasks" ? "" : `?tab=${t}`}`;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">
            <Link href="/projects" className="hover:underline">
              Projects
            </Link>
            {project.client ? (
              <>
                {" · "}
                <Link href={`/clients/${project.client.id}`} className="hover:underline">
                  {project.client.name}
                </Link>
              </>
            ) : null}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground text-sm">
            {progress?.percent_done ?? 0}% done · {progress?.done_tasks ?? 0} of{" "}
            {progress?.total_tasks ?? 0} tasks
            {(progress?.overdue_tasks ?? 0) > 0 ? ` · ${progress?.overdue_tasks} overdue` : ""} ·
            started {formatIsoDate(project.start_on)}
            {project.target_end_on ? ` · target ${formatIsoDate(project.target_end_on)}` : ""}
          </p>
        </div>
        {can(member.role, "records.write") ? (
          <ProjectStatusControl projectId={project.id} status={project.status} />
        ) : (
          <Badge>{PROJECT_STATUS_LABELS[project.status]}</Badge>
        )}
      </div>

      <TabNav
        label="Project sections"
        active={tab}
        tabs={[
          { key: "tasks", label: `Tasks (${tasks.length})`, href: href("tasks") },
          { key: "inputs", label: `Client inputs (${openInputs} open)`, href: href("inputs") },
          {
            key: "approvals",
            label: `Approvals (${pendingApprovals} pending)`,
            href: href("approvals"),
          },
          { key: "details", label: "Details", href: href("details") },
        ]}
      />

      {tab === "tasks" ? (
        <div className="flex flex-col gap-6">
          {phases.map((phase) => (
            <section key={phase} className="flex flex-col gap-2">
              <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {phase}
              </h2>
              <ol className="divide-y rounded-md border">
                {tasks
                  .filter((t) => (t.phase ?? "Other") === phase)
                  .map((t) => {
                    const blockers = (t.readiness?.start_blockers ?? []) as {
                      title: string;
                      type: string;
                    }[];
                    const overdue =
                      t.due_on && t.due_on < today && !["done", "cancelled"].includes(t.status);
                    const needsApproval = t.requires_approval && !approvedTasks.has(t.id);
                    return (
                      <li key={t.id} className="flex flex-col gap-2 p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{t.title}</span>
                          <Badge variant={TASK_VARIANT[t.status]}>
                            {TASK_STATUS_LABELS[t.status]}
                          </Badge>
                          {t.requires_approval ? (
                            <Badge variant="outline">
                              {approvedTasks.has(t.id)
                                ? "Approved"
                                : t.approval_approver === "client"
                                  ? "Needs client approval"
                                  : "Needs internal approval"}
                            </Badge>
                          ) : null}
                          {overdue ? <Badge variant="destructive">Overdue</Badge> : null}
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {t.due_on ? `Due ${formatIsoDate(t.due_on)}` : "No due date"}
                          {t.assignee_user_id
                            ? ` · ${names.get(t.assignee_user_id) ?? "Unknown"}`
                            : " · unassigned"}
                          {t.estimated_hours !== null ? ` · ${t.estimated_hours} h` : ""}
                          {t.cancel_reason ? ` · cancelled: ${t.cancel_reason}` : ""}
                        </p>
                        {t.status === "todo" && blockers.length > 0 ? (
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            Waiting on: {blockers.map((b) => b.title).join(", ")}
                          </p>
                        ) : null}
                        {canWrite && !["done", "cancelled"].includes(t.status) ? (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <TaskActions
                              taskId={t.id}
                              title={t.title}
                              status={t.status}
                              version={t.version}
                              canStart={t.readiness?.can_start ?? false}
                              needsApproval={needsApproval}
                              hasPendingApproval={pendingApprovalTasks.has(t.id)}
                              canCancel={isAdmin}
                            />
                            <TaskDetailsForm
                              taskId={t.id}
                              title={t.title}
                              assigneeId={t.assignee_user_id}
                              dueOn={t.due_on}
                              members={memberOptions}
                            />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
              </ol>
            </section>
          ))}
        </div>
      ) : null}

      {tab === "inputs" ? (
        inputs.length === 0 ? (
          <EmptyState title="No client inputs for this project" />
        ) : (
          <ul className="divide-y rounded-md border">
            {inputs.map((i) => (
              <li key={i.id} className="flex flex-col gap-2 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{i.label}</span>
                  <Badge
                    variant={
                      i.status === "accepted" || i.status === "waived" ? "secondary" : "outline"
                    }
                  >
                    {INPUT_STATUS_LABELS[i.status]}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {INPUT_KIND_LABELS[i.input_kind]} · {i.required ? "required" : "optional"}
                    {i.blocks_task_id
                      ? ` · blocks ${tasks.find((t) => t.id === i.blocks_task_id)?.title ?? "a task"}`
                      : ""}
                  </span>
                </div>
                {i.description ? (
                  <p className="text-muted-foreground text-xs">{i.description}</p>
                ) : null}
                {i.drive_url ? (
                  <a
                    href={i.drive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs underline underline-offset-2"
                  >
                    Open in Drive <ExternalLink className="size-3" />
                  </a>
                ) : null}
                {i.response_text ? <p className="text-xs">Response: {i.response_text}</p> : null}
                {i.waive_reason ? (
                  <p className="text-muted-foreground text-xs">Waived: {i.waive_reason}</p>
                ) : null}
                {canWrite && i.status !== "waived" ? (
                  <InputRequestActions
                    requestId={i.id}
                    label={i.label}
                    status={i.status}
                    version={i.version}
                    kind={i.input_kind}
                    canWaive={isAdmin}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}

      {tab === "approvals" ? (
        approvals.length === 0 ? (
          <EmptyState title="No approvals for this project" />
        ) : (
          <ul className="divide-y rounded-md border">
            {approvals.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{a.title}</span>
                  <Badge
                    variant={
                      a.status === "approved"
                        ? "default"
                        : a.status === "pending"
                          ? "outline"
                          : "secondary"
                    }
                  >
                    {APPROVAL_STATUS_LABELS[a.status]}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {a.approver_type === "client" ? "Client" : "Internal"}
                  </span>
                </div>
                {a.status !== "pending" ? (
                  <p className="text-muted-foreground text-xs">
                    {a.decided_at ? formatDateTime(a.decided_at, tz) : ""}
                    {a.decided_by_user_id
                      ? ` · recorded by ${names.get(a.decided_by_user_id) ?? "former member"}`
                      : ""}
                    {a.contact ? ` · ${contactName(a.contact)}` : ""}
                    {a.decision_note ? ` · “${a.decision_note}”` : ""}
                    {a.evidence_url ? (
                      <>
                        {" · "}
                        <a
                          href={a.evidence_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          evidence
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : canWrite ? (
                  <DecideApproval
                    approvalId={a.id}
                    title={a.title}
                    version={a.version}
                    approverType={a.approver_type}
                    contacts={contacts
                      .filter((c) => !c.archived_at)
                      .map((c) => ({ id: c.id, name: contactName(c) }))}
                    canDecide={a.approver_type === "client" || isAdmin}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}

      {tab === "details" ? (
        <dl className="grid max-w-2xl grid-cols-[10rem_1fr] gap-y-2 text-sm">
          <dt className="text-muted-foreground">Blueprint</dt>
          <dd>
            {project.version ? (
              <Link
                href={`/blueprints/${project.version.blueprint_id}/versions/${project.version.version_number}`}
                className="underline underline-offset-2"
              >
                {project.version.blueprint?.name} v{project.version.version_number}
              </Link>
            ) : null}
          </dd>
          <dt className="text-muted-foreground">SOW</dt>
          <dd>
            {project.sow ? (
              <>
                {project.sow.title}
                {project.sow.version_label ? ` (${project.sow.version_label})` : ""} · signed{" "}
                {project.sow.signed_on} by {project.sow.client_signatory}
                {project.sow.status !== "signed" ? ` · now ${project.sow.status}` : ""}
                {project.sow.drive_url ? (
                  <>
                    {" · "}
                    <a
                      href={project.sow.drive_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Drive
                    </a>
                  </>
                ) : null}
              </>
            ) : (
              <span>Internal / pilot — {project.no_sow_reason}</span>
            )}
          </dd>
          <dt className="text-muted-foreground">From lead</dt>
          <dd>
            {project.lead ? (
              <Link href={`/leads/${project.lead.id}`} className="underline underline-offset-2">
                {project.lead.title}
              </Link>
            ) : (
              "—"
            )}
          </dd>
          <dt className="text-muted-foreground">Generated</dt>
          <dd>
            {formatDateTime(project.created_at, tz)}
            {project.generated_by
              ? ` by ${names.get(project.generated_by) ?? "former member"}`
              : ""}
          </dd>
        </dl>
      ) : null}
    </>
  );
}
