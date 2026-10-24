"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ActionButton } from "@/components/forms/action-button";
import { Textarea } from "@/components/forms/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { INPUT_KIND_LABELS, type InputKind } from "@/features/blueprints/schemas";
import {
  deleteDraft,
  deleteInputTemplate,
  deleteTaskTemplate,
  publishVersion,
} from "@/features/blueprints/server/actions";

import { InputTemplateForm } from "./input-template-form";
import { TaskTemplateForm } from "./task-template-form";

export type EditorTask = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  phase: string | null;
  position: number;
  estimated_hours: number | null;
  due_offset_days: number | null;
  requires_approval: boolean;
  approval_approver: "internal" | "client" | null;
  dependsOn: string[];
};

export type EditorInput = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  input_kind: InputKind;
  required: boolean;
  blocks_task_template_id: string | null;
};

export function DraftEditor({
  versionId,
  tasks,
  inputs,
  problems,
  canPublish,
}: {
  versionId: string;
  tasks: EditorTask[];
  inputs: EditorInput[];
  problems: string[];
  canPublish: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null); // task id, input id, "new-task", "new-input"
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const nextPosition = Math.max(0, ...tasks.map((t) => t.position)) + 1;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Tasks ({tasks.length})</h2>
        {tasks.length === 0 ? (
          <p className="text-muted-foreground text-sm">No tasks yet. Add the first one below.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {tasks.map((t) =>
              editing === t.id ? (
                <li key={t.id}>
                  <TaskTemplateForm
                    taskId={t.id}
                    otherTasks={tasks.filter((o) => o.id !== t.id)}
                    onDone={() => setEditing(null)}
                    defaultValues={{
                      version_id: versionId,
                      key: t.key,
                      title: t.title,
                      description: t.description ?? "",
                      phase: t.phase ?? "",
                      position: String(t.position),
                      estimated_hours: t.estimated_hours === null ? "" : String(t.estimated_hours),
                      due_offset_days: t.due_offset_days === null ? "" : String(t.due_offset_days),
                      approval: t.approval_approver ?? "none",
                      depends_on: t.dependsOn,
                    }}
                  />
                </li>
              ) : (
                <li
                  key={t.id}
                  className="flex flex-wrap items-start gap-3 rounded-md border p-3 text-sm"
                >
                  <span className="text-muted-foreground w-6 tabular-nums">{t.position}.</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {t.title}{" "}
                      <span className="text-muted-foreground font-mono text-xs font-normal">
                        {t.key}
                      </span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {[
                        t.phase,
                        t.estimated_hours !== null ? `${t.estimated_hours} h` : null,
                        t.due_offset_days !== null ? `due day ${t.due_offset_days}` : null,
                        t.dependsOn.length > 0
                          ? `after ${t.dependsOn.map((d) => byId.get(d)?.title ?? "?").join(", ")}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                  {t.requires_approval ? (
                    <Badge variant="secondary">
                      {t.approval_approver === "client" ? "Client approval" : "Internal approval"}
                    </Badge>
                  ) : null}
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => setEditing(t.id)}>
                      Edit
                    </Button>
                    <ActionButton
                      size="sm"
                      variant="ghost"
                      action={deleteTaskTemplate.bind(null, t.id)}
                      confirmMessage={`Delete task “${t.title}”? Its dependencies are removed too.`}
                      successMessage="Task deleted"
                      aria-label={`Delete task ${t.title}`}
                    >
                      Delete
                    </ActionButton>
                  </div>
                </li>
              ),
            )}
          </ol>
        )}
        {editing === "new-task" ? (
          <TaskTemplateForm
            otherTasks={tasks}
            onDone={() => setEditing(null)}
            defaultValues={{
              version_id: versionId,
              key: "",
              title: "",
              description: "",
              phase: tasks.at(-1)?.phase ?? "",
              position: String(nextPosition),
              estimated_hours: "",
              due_offset_days: "",
              approval: "none",
              depends_on: [],
            }}
          />
        ) : (
          <Button variant="outline" className="self-start" onClick={() => setEditing("new-task")}>
            Add task
          </Button>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Client inputs ({inputs.length})</h2>
        {inputs.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Files, answers, access confirmations or decisions you need from the client.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {inputs.map((i) =>
              editing === i.id ? (
                <li key={i.id}>
                  <InputTemplateForm
                    inputId={i.id}
                    tasks={tasks}
                    onDone={() => setEditing(null)}
                    defaultValues={{
                      version_id: versionId,
                      key: i.key,
                      label: i.label,
                      description: i.description ?? "",
                      input_kind: i.input_kind,
                      required: i.required,
                      blocks_task_template_id: i.blocks_task_template_id ?? "",
                    }}
                  />
                </li>
              ) : (
                <li
                  key={i.id}
                  className="flex flex-wrap items-start gap-3 rounded-md border p-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {i.label}{" "}
                      <span className="text-muted-foreground font-mono text-xs font-normal">
                        {i.key}
                      </span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {INPUT_KIND_LABELS[i.input_kind]} · {i.required ? "required" : "optional"}
                      {i.blocks_task_template_id
                        ? ` · blocks ${byId.get(i.blocks_task_template_id)?.title ?? "?"}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => setEditing(i.id)}>
                      Edit
                    </Button>
                    <ActionButton
                      size="sm"
                      variant="ghost"
                      action={deleteInputTemplate.bind(null, i.id)}
                      confirmMessage={`Delete input “${i.label}”?`}
                      successMessage="Input deleted"
                      aria-label={`Delete input ${i.label}`}
                    >
                      Delete
                    </ActionButton>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
        {editing === "new-input" ? (
          <InputTemplateForm
            tasks={tasks}
            onDone={() => setEditing(null)}
            defaultValues={{
              version_id: versionId,
              key: "",
              label: "",
              description: "",
              input_kind: "file",
              required: true,
              blocks_task_template_id: "",
            }}
          />
        ) : (
          <Button variant="outline" className="self-start" onClick={() => setEditing("new-input")}>
            Add client input
          </Button>
        )}
      </section>

      <PublishPanel versionId={versionId} problems={problems} canPublish={canPublish} />
    </div>
  );
}

function PublishPanel({
  versionId,
  problems,
  canPublish,
}: {
  versionId: string;
  problems: string[];
  canPublish: boolean;
}) {
  const [summary, setSummary] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <section className="flex flex-col gap-3 rounded-md border p-4">
      <h2 className="font-medium">Publish</h2>
      {problems.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>Fix before publishing</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : (
        <p className="text-muted-foreground text-sm">
          Publishing freezes this version permanently. Later changes need a new draft.
        </p>
      )}
      <label className="text-sm font-medium" htmlFor="change-summary">
        What changed?
      </label>
      <Textarea
        id="change-summary"
        rows={2}
        maxLength={2000}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!canPublish || pending || problems.length > 0}
          onClick={() => {
            if (!window.confirm("Publish this version? It can't be edited afterwards.")) return;
            startTransition(async () => {
              const result = await publishVersion({
                version_id: versionId,
                change_summary: summary,
              });
              if (result.ok) toast.success("Version published");
              else toast.error(result.error);
            });
          }}
        >
          {pending ? "Publishing…" : "Publish version"}
        </Button>
        <ActionButton
          variant="ghost"
          action={deleteDraft.bind(null, versionId)}
          confirmMessage="Delete this draft and all its tasks and inputs?"
        >
          Delete draft
        </ActionButton>
      </div>
      {!canPublish ? (
        <p className="text-muted-foreground text-xs">Only owners and admins can publish.</p>
      ) : null}
    </section>
  );
}
