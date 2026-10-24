"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormError } from "@/components/forms/form-error";
import { NativeSelect } from "@/components/forms/native-select";
import { Textarea } from "@/components/forms/textarea";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  CADENCES,
  CADENCE_LABELS,
  routineFormSchema,
  type RoutineFormInput,
} from "@/features/operations/schemas";
import { saveRoutine } from "@/features/operations/server/actions";

type Option = { id: string; name: string };

export function RoutineForm({
  routineId,
  defaultValues,
  clients,
  members,
}: {
  routineId?: string;
  defaultValues: RoutineFormInput;
  clients: Option[];
  members: Option[];
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<RoutineFormInput, unknown, z.output<typeof routineFormSchema>>({
    resolver: zodResolver(routineFormSchema),
    defaultValues,
  });
  const { errors } = form.formState;

  // Client-side validation gates submission; the server re-parses the raw input.
  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setServerError(null);
      const result = await saveRoutine(routineId ?? null, form.getValues());
      if (result && !result.ok) setServerError(result.error);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-2xl">
      <FieldGroup>
        <FormError message={serverError} />
        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors.name} className="sm:col-span-2">
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input id="name" aria-invalid={!!errors.name} {...form.register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="client_id">Client</FieldLabel>
            <NativeSelect id="client_id" {...form.register("client_id")}>
              <option value="">Internal (no client)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="owner_user_id">Owner</FieldLabel>
            <NativeSelect id="owner_user_id" {...form.register("owner_user_id")}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field data-invalid={!!errors.interval_count}>
            <FieldLabel htmlFor="interval_count">Repeat every</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="interval_count"
                type="number"
                min={1}
                max={52}
                className="w-20"
                {...form.register("interval_count")}
              />
              <NativeSelect aria-label="Cadence" {...form.register("cadence")}>
                {CADENCES.map((c) => (
                  <option key={c} value={c}>
                    {CADENCE_LABELS[c][1]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <FieldError errors={[errors.interval_count]} />
          </Field>
          <Field data-invalid={!!errors.anchor_on}>
            <FieldLabel htmlFor="anchor_on">First occurrence</FieldLabel>
            <Input id="anchor_on" type="date" {...form.register("anchor_on")} />
            <FieldDescription>Later dates count from this one.</FieldDescription>
            <FieldError errors={[errors.anchor_on]} />
          </Field>
          <Field data-invalid={!!errors.runbook_url} className="sm:col-span-2">
            <FieldLabel htmlFor="runbook_url">Runbook link</FieldLabel>
            <Input
              id="runbook_url"
              type="url"
              placeholder="https://docs.google.com/…"
              aria-invalid={!!errors.runbook_url}
              {...form.register("runbook_url")}
            />
            <FieldError errors={[errors.runbook_url]} />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="description">Description</FieldLabel>
            <Textarea id="description" rows={3} {...form.register("description")} />
          </Field>
          <Field orientation="horizontal" className="items-center">
            <input
              id="is_active"
              type="checkbox"
              className="accent-primary size-4"
              {...form.register("is_active")}
            />
            <FieldLabel htmlFor="is_active">Active</FieldLabel>
          </Field>
        </div>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : routineId ? "Save routine" : "Create routine"}
        </Button>
      </FieldGroup>
    </form>
  );
}
