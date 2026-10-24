"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormError } from "@/components/forms/form-error";
import { NativeSelect } from "@/components/forms/native-select";
import { Textarea } from "@/components/forms/textarea";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { blueprintFormSchema, type BlueprintFormInput } from "@/features/blueprints/schemas";
import { createBlueprint, updateBlueprint } from "@/features/blueprints/server/actions";

export function BlueprintForm({
  blueprintId,
  services,
  defaultValues,
}: {
  blueprintId?: string;
  services: { id: string; name: string }[];
  defaultValues?: BlueprintFormInput;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<BlueprintFormInput, unknown, z.output<typeof blueprintFormSchema>>({
    resolver: zodResolver(blueprintFormSchema),
    defaultValues: defaultValues ?? { name: "", description: "", service_id: "" },
  });
  const { errors } = form.formState;

  // Client-side validation gates submission; the server re-parses the raw input.
  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setServerError(null);
      const result = blueprintId
        ? await updateBlueprint(blueprintId, form.getValues())
        : await createBlueprint(form.getValues());
      if (result && !result.ok) setServerError(result.error);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-2xl">
      <FieldGroup>
        <FormError message={serverError} />
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input id="name" aria-invalid={!!errors.name} {...form.register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="service_id">Delivers service</FieldLabel>
          <NativeSelect id="service_id" {...form.register("service_id")}>
            <option value="">None</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Textarea id="description" rows={3} {...form.register("description")} />
          <FieldError errors={[errors.description]} />
        </Field>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : blueprintId ? "Save blueprint" : "Create blueprint and draft"}
        </Button>
      </FieldGroup>
    </form>
  );
}
