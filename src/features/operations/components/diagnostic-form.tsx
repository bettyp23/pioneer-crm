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
import {
  DIAGNOSTIC_TYPE_SUGGESTIONS,
  diagnosticFormSchema,
  type DiagnosticFormInput,
} from "@/features/operations/schemas";
import { createDiagnostic } from "@/features/operations/server/actions";

type Option = { id: string; name: string };

export function DiagnosticForm({
  defaultValues,
  clients,
  members,
}: {
  defaultValues: DiagnosticFormInput;
  clients: Option[];
  members: Option[];
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<DiagnosticFormInput, unknown, z.output<typeof diagnosticFormSchema>>({
    resolver: zodResolver(diagnosticFormSchema),
    defaultValues,
  });
  const { errors } = form.formState;

  // Client-side validation gates submission; the server re-parses the raw input.
  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setServerError(null);
      const result = await createDiagnostic(form.getValues());
      if (result && !result.ok) setServerError(result.error);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-2xl">
      <FieldGroup>
        <FormError message={serverError} />
        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors.client_id}>
            <FieldLabel htmlFor="client_id">Client</FieldLabel>
            <NativeSelect id="client_id" {...form.register("client_id")}>
              <option value="">Choose a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
            <FieldError errors={[errors.client_id]} />
          </Field>
          <Field data-invalid={!!errors.diagnostic_type}>
            <FieldLabel htmlFor="diagnostic_type">Type</FieldLabel>
            <Input
              id="diagnostic_type"
              list="diagnostic-types"
              {...form.register("diagnostic_type")}
            />
            <datalist id="diagnostic-types">
              {DIAGNOSTIC_TYPE_SUGGESTIONS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <FieldError errors={[errors.diagnostic_type]} />
          </Field>
          <Field data-invalid={!!errors.performed_on}>
            <FieldLabel htmlFor="performed_on">Performed on</FieldLabel>
            <Input id="performed_on" type="date" {...form.register("performed_on")} />
            <FieldError errors={[errors.performed_on]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="performed_by">Performed by</FieldLabel>
            <NativeSelect id="performed_by" {...form.register("performed_by")}>
              <option value="">—</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field data-invalid={!!errors.score}>
            <FieldLabel htmlFor="score">Score (0–100, optional)</FieldLabel>
            <Input id="score" inputMode="decimal" {...form.register("score")} />
            <FieldError errors={[errors.score]} />
          </Field>
          <Field data-invalid={!!errors.report_url}>
            <FieldLabel htmlFor="report_url">Report link</FieldLabel>
            <Input
              id="report_url"
              type="url"
              placeholder="https://"
              {...form.register("report_url")}
            />
            <FieldError errors={[errors.report_url]} />
          </Field>
          <Field data-invalid={!!errors.summary} className="sm:col-span-2">
            <FieldLabel htmlFor="summary">Summary</FieldLabel>
            <Textarea id="summary" rows={4} {...form.register("summary")} />
            <FieldError errors={[errors.summary]} />
          </Field>
        </div>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : "Record diagnostic"}
        </Button>
      </FieldGroup>
    </form>
  );
}
