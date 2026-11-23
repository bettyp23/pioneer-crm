import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ActionButton } from "@/components/forms/action-button";
import { ActionForm } from "@/components/forms/action-form";
import { NativeSelect } from "@/components/forms/native-select";
import { Textarea } from "@/components/forms/textarea";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FileUploadForm } from "@/features/client-admin/components/file-upload-form";
import {
  NEXT_TASK_STATUSES,
  PROJECT_STATUSES,
  REQUEST_STATUSES,
  STAFF_TASK_STATUS_LABELS,
} from "@/features/client-admin/schemas";
import {
  addTask,
  createApproval,
  createProject,
  deleteClientFile,
  inviteClientUser,
  moveTask,
  removeClientUser,
  updateProject,
  updateRequest,
  withdrawApproval,
} from "@/features/client-admin/server/actions";
import { getClientAdmin, portalInvitesConfigured } from "@/features/client-admin/server/queries";
import {
  APPROVAL_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  REQUEST_KIND_LABELS,
  REQUEST_STATUS_LABELS,
} from "@/features/portal/schemas";
import { formatBytes, formatDate, formatDay } from "@/lib/format";
import { publicPath } from "@/lib/mount";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "Client" };

const label = "text-sm font-medium";

export default async function ClientAdminPage(props: PageProps<"/dashboard/clients/[clientId]">) {
  const { clientId } = await props.params;
  if (!z.uuid().safeParse(clientId).success) notFound();
  const { member } = await requirePagePermission("records.read");
  const detail = await getClientAdmin(clientId);
  if (!detail) notFound();

  const { client, users, projects, approvals, files, requests } = detail;
  const tz = member.workspaceTimezone;
  const canWrite = can(member.role, "records.write");
  const canInvite = can(member.role, "portal.invite");
  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/dashboard/clients" className="text-muted-foreground text-sm underline">
          ← All clients
        </Link>
        <PageHeader
          title={client.name}
          description="Everything below is what this client sees in their portal (except the staff controls)."
        />
      </div>

      {/* ── Portal access ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Portal access</h2>
          </CardTitle>
          <CardDescription>
            Invited people set a password and an authenticator app, then see only {client.name}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {users.length === 0 ? (
            <p className="text-muted-foreground text-sm">No one from this client has access yet.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {users.map((u) => (
                <li
                  key={u.user_id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3"
                >
                  <span>
                    <span className="font-medium">{u.display_name}</span>
                    {u.email ? (
                      <span className="text-muted-foreground text-sm"> · {u.email}</span>
                    ) : null}
                  </span>
                  {canInvite ? (
                    <ActionButton
                      variant="outline"
                      size="sm"
                      action={removeClientUser.bind(null, client.id, u.user_id)}
                      confirmMessage={`Remove ${u.display_name}'s portal access?`}
                      successMessage="Access removed."
                    >
                      Remove access
                    </ActionButton>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canInvite ? (
            portalInvitesConfigured() ? (
              <ActionForm
                action={inviteClientUser}
                successMessage="Invite sent."
                className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              >
                <input type="hidden" name="clientId" value={client.id} />
                <div className="flex flex-col gap-1">
                  <label htmlFor="invite-name" className={label}>
                    Name
                  </label>
                  <Input id="invite-name" name="displayName" required maxLength={120} />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="invite-email" className={label}>
                    Email
                  </label>
                  <Input id="invite-email" name="email" type="email" required maxLength={320} />
                </div>
                <Button type="submit">Send invite</Button>
              </ActionForm>
            ) : (
              <p className="text-muted-foreground text-sm">
                Invites need the server&apos;s Supabase secret key (SUPABASE_SECRET_KEY), which
                isn&apos;t set here.
              </p>
            )
          ) : null}
        </CardContent>
      </Card>

      {/* ── Projects and steps ──────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Projects</h2>
        {projects.length === 0 ? <EmptyState title="No projects yet" /> : null}
        {projects.map((project) => (
          <Card key={project.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>
                  <h3>{project.name}</h3>
                </CardTitle>
                <Badge variant="secondary">{PROJECT_STATUS_LABELS[project.status]}</Badge>
              </div>
              <CardDescription>Started {formatDay(project.start_on)}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {canWrite ? (
                <ActionForm
                  action={updateProject.bind(null, client.id)}
                  successMessage="Project updated."
                  resetOnSuccess={false}
                  className="grid gap-3 sm:grid-cols-3"
                >
                  <input type="hidden" name="projectId" value={project.id} />
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`status-${project.id}`} className={label}>
                      Status
                    </label>
                    <NativeSelect
                      id={`status-${project.id}`}
                      name="status"
                      defaultValue={project.status}
                    >
                      {PROJECT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {PROJECT_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`phase-${project.id}`} className={label}>
                      Current phase
                    </label>
                    <Input
                      id={`phase-${project.id}`}
                      name="currentPhase"
                      maxLength={120}
                      defaultValue={project.current_phase ?? ""}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`launch-${project.id}`} className={label}>
                      Launch date
                    </label>
                    <Input
                      id={`launch-${project.id}`}
                      name="launchOn"
                      type="date"
                      defaultValue={project.launch_on ?? ""}
                    />
                  </div>
                  <div className="flex flex-col gap-1 sm:col-span-3">
                    <label htmlFor={`next-${project.id}`} className={label}>
                      What happens next (plain language, shown to the client)
                    </label>
                    <Textarea
                      id={`next-${project.id}`}
                      name="nextSteps"
                      maxLength={2000}
                      defaultValue={project.next_steps ?? ""}
                    />
                  </div>
                  <Button type="submit" className="self-start">
                    Save project
                  </Button>
                </ActionForm>
              ) : null}

              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-medium">Steps</h4>
                {project.tasks.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No steps yet.</p>
                ) : (
                  <ol className="divide-y rounded-md border">
                    {project.tasks.map((task) => (
                      <li key={task.id} className="flex flex-wrap items-center gap-2 p-3">
                        <span className="min-w-40 flex-1">
                          {task.title}
                          <span className="text-muted-foreground block text-xs">
                            {[task.phase, task.due_on ? `Due ${formatDay(task.due_on)}` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <Badge variant="outline">{STAFF_TASK_STATUS_LABELS[task.status]}</Badge>
                        {canWrite
                          ? (NEXT_TASK_STATUSES[task.status] ?? []).map((next) => (
                              <ActionForm
                                key={next}
                                action={moveTask.bind(null, client.id)}
                                resetOnSuccess={false}
                              >
                                <input type="hidden" name="taskId" value={task.id} />
                                <input type="hidden" name="version" value={task.version} />
                                <input type="hidden" name="status" value={next} />
                                <Button type="submit" size="sm" variant="ghost">
                                  → {STAFF_TASK_STATUS_LABELS[next]}
                                </Button>
                              </ActionForm>
                            ))
                          : null}
                      </li>
                    ))}
                  </ol>
                )}
                {canWrite ? (
                  <ActionForm
                    action={addTask.bind(null, client.id)}
                    successMessage="Step added."
                    className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
                  >
                    <input type="hidden" name="projectId" value={project.id} />
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`task-title-${project.id}`} className={label}>
                        New step
                      </label>
                      <Input
                        id={`task-title-${project.id}`}
                        name="title"
                        required
                        maxLength={200}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`task-phase-${project.id}`} className={label}>
                        Phase
                      </label>
                      <Input id={`task-phase-${project.id}`} name="phase" maxLength={120} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`task-due-${project.id}`} className={label}>
                        Due
                      </label>
                      <Input id={`task-due-${project.id}`} name="dueOn" type="date" />
                    </div>
                    <Button type="submit" variant="outline">
                      Add step
                    </Button>
                  </ActionForm>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
        {canWrite ? (
          <ActionForm
            action={createProject}
            successMessage="Project added."
            className="grid gap-2 rounded-md border border-dashed p-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
          >
            <input type="hidden" name="clientId" value={client.id} />
            <div className="flex flex-col gap-1">
              <label htmlFor="project-name" className={label}>
                New project
              </label>
              <Input id="project-name" name="name" required maxLength={200} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="project-start" className={label}>
                Start
              </label>
              <Input id="project-start" name="startOn" type="date" required defaultValue={today} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="project-launch" className={label}>
                Launch (optional)
              </label>
              <Input id="project-launch" name="launchOn" type="date" />
            </div>
            <Button type="submit">Add project</Button>
          </ActionForm>
        ) : null}
      </section>

      {/* ── Approvals ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Approvals</h2>
          </CardTitle>
          <CardDescription>
            Ask the client for a yes or no. Their answer appears here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {canWrite && projects.length > 0 ? (
            <ActionForm
              action={createApproval.bind(null, client.id)}
              successMessage="Sent to the client's portal."
              className="flex flex-col gap-2"
            >
              <label htmlFor="approval-project" className={label}>
                Project
              </label>
              <NativeSelect
                id="approval-project"
                name="projectId"
                defaultValue={projectOptions[0]?.id}
              >
                {projectOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
              <label htmlFor="approval-title" className={label}>
                What needs approval
              </label>
              <Input id="approval-title" name="title" required maxLength={200} />
              <label htmlFor="approval-details" className={label}>
                Details for the client (optional)
              </label>
              <Textarea id="approval-details" name="details" maxLength={2000} />
              <Button type="submit" className="self-start">
                Ask for approval
              </Button>
            </ActionForm>
          ) : null}
          {approvals.length === 0 ? (
            <p className="text-muted-foreground text-sm">No approvals yet.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {approvals.map((a) => (
                <li key={a.id} className="flex flex-col gap-1 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{a.title}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant={a.status === "pending" ? "default" : "secondary"}>
                        {a.status === "pending"
                          ? "Waiting for client"
                          : a.status === "approved"
                            ? "Approved"
                            : a.status === "rejected"
                              ? "Declined"
                              : APPROVAL_STATUS_LABELS[a.status]}
                      </Badge>
                      {canWrite && a.status === "pending" ? (
                        <ActionForm
                          action={withdrawApproval.bind(null, client.id)}
                          resetOnSuccess={false}
                        >
                          <input type="hidden" name="approvalId" value={a.id} />
                          <input type="hidden" name="version" value={a.version} />
                          <Button type="submit" size="sm" variant="ghost">
                            Withdraw
                          </Button>
                        </ActionForm>
                      ) : null}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {a.project?.name} · asked {formatDate(a.created_at, tz)}
                    {a.decided_at ? ` · answered ${formatDate(a.decided_at, tz)}` : ""}
                    {a.decided_in_portal ? " in the portal" : ""}
                  </p>
                  {a.decision_note ? <p className="text-sm">“{a.decision_note}”</p> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Files ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Files</h2>
          </CardTitle>
          <CardDescription>
            Files shared here can be downloaded by this client only.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {canWrite ? <FileUploadForm clientId={client.id} projects={projectOptions} /> : null}
          {files.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing shared yet.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {files.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <a href={publicPath(`/dashboard/clients/files/${f.id}`)} className="min-w-0">
                    <span className="block font-medium underline">{f.title}</span>
                    <span className="text-muted-foreground block text-xs">
                      {[
                        f.file_name,
                        formatBytes(f.size_bytes),
                        f.project?.name,
                        formatDate(f.created_at, tz),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </a>
                  {canWrite ? (
                    <ActionButton
                      variant="ghost"
                      size="sm"
                      action={deleteClientFile.bind(null, client.id, f.id)}
                      confirmMessage={`Stop sharing “${f.title}” and delete it?`}
                      successMessage="File deleted."
                    >
                      Delete
                    </ActionButton>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Requests ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Requests</h2>
          </CardTitle>
          <CardDescription>Questions and change requests from the client.</CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-muted-foreground text-sm">No requests yet.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{r.subject}</span>
                    <Badge variant={r.status === "open" ? "default" : "secondary"}>
                      {REQUEST_STATUS_LABELS[r.status]}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {REQUEST_KIND_LABELS[r.kind]} · {formatDate(r.created_at, tz)}
                    {r.project ? ` · ${r.project.name}` : ""}
                  </p>
                  <p className="text-sm whitespace-pre-line">{r.body}</p>
                  {canWrite ? (
                    <ActionForm
                      action={updateRequest.bind(null, client.id)}
                      successMessage="Request updated."
                      resetOnSuccess={false}
                      className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"
                    >
                      <input type="hidden" name="requestId" value={r.id} />
                      <div className="flex flex-col gap-1 sm:col-span-2">
                        <label htmlFor={`reply-${r.id}`} className={label}>
                          Reply (the client sees this)
                        </label>
                        <Textarea
                          id={`reply-${r.id}`}
                          name="reply"
                          maxLength={5000}
                          defaultValue={r.admin_reply ?? ""}
                        />
                      </div>
                      <NativeSelect
                        aria-label="Request status"
                        name="status"
                        defaultValue={r.status}
                      >
                        {REQUEST_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {REQUEST_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </NativeSelect>
                      <Button type="submit" variant="outline">
                        Save
                      </Button>
                    </ActionForm>
                  ) : r.admin_reply ? (
                    <p className="bg-muted rounded-md p-2 text-sm">{r.admin_reply}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
