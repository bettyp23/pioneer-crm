"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { FormError } from "@/components/forms/form-error";
import { NativeSelect } from "@/components/forms/native-select";
import { Textarea } from "@/components/forms/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  CONTEXT_SECTION_KEYS,
  CONTEXT_SECTIONS,
  WORK_TYPE_LABELS,
  WORK_TYPES,
  workItemFormSchema,
  type WorkItemFormInput,
  type WorkType,
} from "@/features/agents/schemas";
import { saveWorkItem } from "@/features/agents/server/actions";

type Option = { id: string; name: string };

export function WorkItemForm({
  itemId,
  defaultValues,
  agents,
  clients,
  projects,
}: {
  itemId?: string;
  defaultValues: WorkItemFormInput;
  agents: (Option & { workTypes: WorkType[] })[];
  clients: Option[];
  projects: (Option & { clientId: string })[];
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<WorkItemFormInput, unknown, z.output<typeof workItemFormSchema>>({
    resolver: zodResolver(workItemFormSchema),
    defaultValues,
  });
  const { errors } = form.formState;
  const agentId = useWatch({ control: form.control, name: "agent_id" });
  const clientId = useWatch({ control: form.control, name: "client_id" });
  const agent = agents.find((a) => a.id === agentId);

  // Client-side validation gates submission; the server re-parses the raw input and builds
  // the context snapshot itself (the browser never decides what is shared).
  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setServerError(null);
      const result = await saveWorkItem(itemId ?? null, form.getValues());
      if (result && !result.ok) setServerError(result.error);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-2xl">
      <FieldGroup>
        <FormError message={serverError} />
        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors.agent_id}>
            <FieldLabel htmlFor="agent_id">Agent</FieldLabel>
            <NativeSelect
              id="agent_id"
              {...form.register("agent_id", {
                onChange: (e) => {
                  const next = agents.find((a) => a.id === e.target.value);
                  const current = form.getValues("work_type") as WorkType;
                  if (next && !next.workTypes.includes(current) && next.workTypes[0]) {
                    form.setValue("work_type", next.workTypes[0]);
                  }
                },
              })}
            >
              <option value="">Choose an agent…</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
            <FieldError errors={[errors.agent_id]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="work_type">Kind of work</FieldLabel>
            <NativeSelect id="work_type" {...form.register("work_type")}>
              {WORK_TYPES.filter((t) => !agent || agent.workTypes.includes(t)).map((t) => (
                <option key={t} value={t}>
                  {WORK_TYPE_LABELS[t]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="client_id">Client</FieldLabel>
            <NativeSelect
              id="client_id"
              {...form.register("client_id", { onChange: () => form.setValue("project_id", "") })}
            >
              <option value="">No client (internal)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="project_id">Project</FieldLabel>
            <NativeSelect id="project_id" disabled={!clientId} {...form.register("project_id")}>
              <option value="">None</option>
              {projects
                .filter((p) => p.clientId === clientId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Field data-invalid={!!errors.title} className="sm:col-span-2">
            <FieldLabel htmlFor="title">Title</FieldLabel>
            <Input id="title" aria-invalid={!!errors.title} {...form.register("title")} />
            <FieldError errors={[errors.title]} />
          </Field>
          <Field data-invalid={!!errors.instructions} className="sm:col-span-2">
            <FieldLabel htmlFor="instructions">What should the agent do?</FieldLabel>
            <Textarea id="instructions" rows={5} {...form.register("instructions")} />
            <FieldDescription>No passwords, keys or health information.</FieldDescription>
            <FieldError errors={[errors.instructions]} />
          </Field>
        </div>
        <FieldSet>
          <FieldLegend variant="label">Context to share</FieldLegend>
          <FieldDescription>
            Business information is included by default. Personal details, notes, SOWs and invoices
            are flagged and need a reason before sending.
          </FieldDescription>
          <div className="grid gap-2 sm:grid-cols-2">
            {CONTEXT_SECTION_KEYS.map((key) => (
              <label key={key} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary mt-0.5 size-4"
                  {...form.register(`context_options.${key}`)}
                />
                <span>
                  {CONTEXT_SECTIONS[key].label}{" "}
                  {CONTEXT_SECTIONS[key].optIn ? <Badge variant="outline">flagged</Badge> : null}
                </span>
              </label>
            ))}
          </div>
        </FieldSet>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Building context…" : itemId ? "Save draft" : "Create draft"}
        </Button>
      </FieldGroup>
    </form>
  );
}
