"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { FormError } from "@/components/forms/form-error";
import { NativeSelect } from "@/components/forms/native-select";
import { Textarea } from "@/components/forms/textarea";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  taskTemplateFormSchema,
  toTemplateKey,
  type TaskTemplateFormInput,
} from "@/features/blueprints/schemas";
import { saveTaskTemplate } from "@/features/blueprints/server/actions";

export function TaskTemplateForm({
  taskId,
  defaultValues,
  otherTasks,
  onDone,
}: {
  taskId?: string;
  defaultValues: TaskTemplateFormInput;
  otherTasks: { id: string; key: string; title: string }[];
  onDone: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [keyEdited, setKeyEdited] = useState(Boolean(taskId));
  const [pending, startTransition] = useTransition();
  const form = useForm<TaskTemplateFormInput, unknown, z.output<typeof taskTemplateFormSchema>>({
    resolver: zodResolver(taskTemplateFormSchema),
    defaultValues,
  });
  const { errors } = form.formState;
  const titleField = form.register("title");
  const keyField = form.register("key");
  // Managed explicitly: a single registered checkbox would yield a boolean, not an array.
  const dependsOn = useWatch({ control: form.control, name: "depends_on" });

  // Client-side validation gates submission; the server re-parses the raw input.
  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setServerError(null);
      const result = await saveTaskTemplate(taskId ?? null, form.getValues());
      if (result.ok) {
        toast.success(taskId ? "Task saved" : "Task added");
        onDone();
      } else {
        setServerError(result.error);
      }
    }),
  );

  const idp = taskId ?? "new";
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-md border p-4">
      <FormError message={serverError} />
      <div className="grid gap-4 sm:grid-cols-4">
        <Field data-invalid={!!errors.title} className="sm:col-span-2">
          <FieldLabel htmlFor={`task-title-${idp}`}>Task title</FieldLabel>
          <Input
            id={`task-title-${idp}`}
            aria-invalid={!!errors.title}
            {...titleField}
            onChange={(e) => {
              void titleField.onChange(e);
              if (!keyEdited) form.setValue("key", toTemplateKey(e.target.value));
            }}
          />
          <FieldError errors={[errors.title]} />
        </Field>
        <Field data-invalid={!!errors.key}>
          <FieldLabel htmlFor={`task-key-${idp}`}>Key</FieldLabel>
          <Input
            id={`task-key-${idp}`}
            className="font-mono text-xs"
            aria-invalid={!!errors.key}
            {...keyField}
            onChange={(e) => {
              setKeyEdited(true);
              void keyField.onChange(e);
            }}
          />
          <FieldError errors={[errors.key]} />
        </Field>
        <Field data-invalid={!!errors.phase}>
          <FieldLabel htmlFor={`task-phase-${idp}`}>Phase</FieldLabel>
          <Input id={`task-phase-${idp}`} placeholder="e.g. Build" {...form.register("phase")} />
          <FieldError errors={[errors.phase]} />
        </Field>
        <Field data-invalid={!!errors.position}>
          <FieldLabel htmlFor={`task-position-${idp}`}>Order</FieldLabel>
          <Input id={`task-position-${idp}`} type="number" min={1} {...form.register("position")} />
          <FieldError errors={[errors.position]} />
        </Field>
        <Field data-invalid={!!errors.estimated_hours}>
          <FieldLabel htmlFor={`task-hours-${idp}`}>Estimate (hours)</FieldLabel>
          <Input
            id={`task-hours-${idp}`}
            inputMode="decimal"
            {...form.register("estimated_hours")}
          />
          <FieldError errors={[errors.estimated_hours]} />
        </Field>
        <Field data-invalid={!!errors.due_offset_days}>
          <FieldLabel htmlFor={`task-due-${idp}`}>Due (days after start)</FieldLabel>
          <Input id={`task-due-${idp}`} inputMode="numeric" {...form.register("due_offset_days")} />
          <FieldError errors={[errors.due_offset_days]} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`task-approval-${idp}`}>Approval</FieldLabel>
          <NativeSelect id={`task-approval-${idp}`} {...form.register("approval")}>
            <option value="none">Not required</option>
            <option value="internal">Internal approval</option>
            <option value="client">Client approval</option>
          </NativeSelect>
        </Field>
        <Field className="sm:col-span-4">
          <FieldLabel htmlFor={`task-description-${idp}`}>Description</FieldLabel>
          <Textarea id={`task-description-${idp}`} rows={2} {...form.register("description")} />
        </Field>
        {otherTasks.length > 0 ? (
          <FieldSet className="sm:col-span-4">
            <FieldLegend variant="label">Can start after</FieldLegend>
            <FieldDescription>Prerequisite tasks that must be done first.</FieldDescription>
            <div className="grid gap-2 sm:grid-cols-2">
              {otherTasks.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-primary size-4"
                    checked={dependsOn.includes(t.id)}
                    onChange={(e) =>
                      form.setValue(
                        "depends_on",
                        e.target.checked
                          ? [...dependsOn, t.id]
                          : dependsOn.filter((id) => id !== t.id),
                        { shouldDirty: true },
                      )
                    }
                  />
                  {t.title} <span className="text-muted-foreground font-mono text-xs">{t.key}</span>
                </label>
              ))}
            </div>
          </FieldSet>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : taskId ? "Save task" : "Add task"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
