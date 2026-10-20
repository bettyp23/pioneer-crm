"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { FormError } from "@/components/forms/form-error";
import { NativeSelect } from "@/components/forms/native-select";
import { Textarea } from "@/components/forms/textarea";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  INPUT_KIND_LABELS,
  INPUT_KINDS,
  inputTemplateFormSchema,
  toTemplateKey,
  type InputTemplateFormInput,
} from "@/features/blueprints/schemas";
import { saveInputTemplate } from "@/features/blueprints/server/actions";

export function InputTemplateForm({
  inputId,
  defaultValues,
  tasks,
  onDone,
}: {
  inputId?: string;
  defaultValues: InputTemplateFormInput;
  tasks: { id: string; title: string }[];
  onDone: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [keyEdited, setKeyEdited] = useState(Boolean(inputId));
  const [pending, startTransition] = useTransition();
  const form = useForm<InputTemplateFormInput, unknown, z.output<typeof inputTemplateFormSchema>>({
    resolver: zodResolver(inputTemplateFormSchema),
    defaultValues,
  });
  const { errors } = form.formState;
  const labelField = form.register("label");
  const keyField = form.register("key");

  // Client-side validation gates submission; the server re-parses the raw input.
  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setServerError(null);
      const result = await saveInputTemplate(inputId ?? null, form.getValues());
      if (result.ok) {
        toast.success(inputId ? "Input saved" : "Input added");
        onDone();
      } else {
        setServerError(result.error);
      }
    }),
  );

  const idp = inputId ?? "new";
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-md border p-4">
      <FormError message={serverError} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field data-invalid={!!errors.label} className="sm:col-span-2">
          <FieldLabel htmlFor={`input-label-${idp}`}>What the client provides</FieldLabel>
          <Input
            id={`input-label-${idp}`}
            aria-invalid={!!errors.label}
            {...labelField}
            onChange={(e) => {
              void labelField.onChange(e);
              if (!keyEdited) form.setValue("key", toTemplateKey(e.target.value));
            }}
          />
          <FieldError errors={[errors.label]} />
        </Field>
        <Field data-invalid={!!errors.key}>
          <FieldLabel htmlFor={`input-key-${idp}`}>Key</FieldLabel>
          <Input
            id={`input-key-${idp}`}
            className="font-mono text-xs"
            {...keyField}
            onChange={(e) => {
              setKeyEdited(true);
              void keyField.onChange(e);
            }}
          />
          <FieldError errors={[errors.key]} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`input-kind-${idp}`}>Kind</FieldLabel>
          <NativeSelect id={`input-kind-${idp}`} {...form.register("input_kind")}>
            {INPUT_KINDS.map((k) => (
              <option key={k} value={k}>
                {INPUT_KIND_LABELS[k]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={`input-blocks-${idp}`}>Blocks task</FieldLabel>
          <NativeSelect id={`input-blocks-${idp}`} {...form.register("blocks_task_template_id")}>
            <option value="">None</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field orientation="horizontal" className="items-center self-end">
          <input
            id={`input-required-${idp}`}
            type="checkbox"
            className="accent-primary size-4"
            {...form.register("required")}
          />
          <FieldLabel htmlFor={`input-required-${idp}`}>Required</FieldLabel>
        </Field>
        <Field className="sm:col-span-3">
          <FieldLabel htmlFor={`input-description-${idp}`}>Instructions</FieldLabel>
          <Textarea id={`input-description-${idp}`} rows={2} {...form.register("description")} />
          <FieldDescription>
            For access: record <em>where</em> the credential lives (e.g. a password-manager item),
            never the credential itself.
          </FieldDescription>
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : inputId ? "Save input" : "Add input"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
