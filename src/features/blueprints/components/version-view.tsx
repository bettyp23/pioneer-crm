import { Badge } from "@/components/ui/badge";
import { INPUT_KIND_LABELS } from "@/features/blueprints/schemas";

import type { EditorInput, EditorTask } from "./draft-editor";

// Read-only rendering of a published or retired version.
export function VersionView({ tasks, inputs }: { tasks: EditorTask[]; inputs: EditorInput[] }) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const phases = [...new Set(tasks.map((t) => t.phase ?? "Other"))];

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="font-medium">Tasks ({tasks.length})</h2>
        {phases.map((phase) => (
          <div key={phase} className="flex flex-col gap-2">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {phase}
            </h3>
            <ol className="divide-y rounded-md border">
              {tasks
                .filter((t) => (t.phase ?? "Other") === phase)
                .map((t) => (
                  <li key={t.id} className="flex flex-wrap items-start gap-3 p-3 text-sm">
                    <span className="text-muted-foreground w-6 tabular-nums">{t.position}.</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{t.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {[
                          t.estimated_hours !== null ? `${t.estimated_hours} h` : null,
                          t.due_offset_days !== null ? `due day ${t.due_offset_days}` : null,
                          t.dependsOn.length > 0
                            ? `after ${t.dependsOn.map((d) => byId.get(d)?.title ?? "?").join(", ")}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                      {t.description ? (
                        <p className="mt-1 whitespace-pre-wrap">{t.description}</p>
                      ) : null}
                    </div>
                    {t.requires_approval ? (
                      <Badge variant="secondary">
                        {t.approval_approver === "client" ? "Client approval" : "Internal approval"}
                      </Badge>
                    ) : null}
                  </li>
                ))}
            </ol>
          </div>
        ))}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Client inputs ({inputs.length})</h2>
        {inputs.length === 0 ? (
          <p className="text-muted-foreground text-sm">None.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {inputs.map((i) => (
              <li key={i.id} className="p-3 text-sm">
                <p className="font-medium">{i.label}</p>
                <p className="text-muted-foreground text-xs">
                  {INPUT_KIND_LABELS[i.input_kind]} · {i.required ? "required" : "optional"}
                  {i.blocks_task_template_id
                    ? ` · blocks ${byId.get(i.blocks_task_template_id)?.title ?? "?"}`
                    : ""}
                </p>
                {i.description ? <p className="mt-1">{i.description}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
