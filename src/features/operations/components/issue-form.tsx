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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { issueFormSchema, SEVERITIES, type IssueFormInput } from "@/features/operations/schemas";
import { createIssue, updateIssue } from "@/features/operations/server/actions";

type Option = { id: string; name: string };

export function IssueForm({
  issueId,
  defaultValues,
  clients,
  diagnostics,
  members,
}: {
  issueId?: string;
  defaultValues: IssueFormInput;
  clients: Option[];
  diagnostics: (Option & { clientId: string })[];
  members: Option[];
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<IssueFormInput, unknown, z.output<typeof issueFormSchema>>({
    resolver: zodResolver(issueFormSchema),
    defaultValues,
  });
  const { errors } = form.formState;
  const clientId = useWatch({ control: form.control, name: "client_id" });

  // Client-side validation gates submission; the server re-parses the raw input.
  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setServerError(null);
      const result = issueId
        ? await updateIssue(issueId, form.getValues())
        : await createIssue(form.getValues());
      if (result && !result.ok) setServerError(result.error);
      else if (issueId) toast.success("Issue saved");
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-2xl">
      <FieldGroup>
        <FormError message={serverError} />
        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors.title} className="sm:col-span-2">
            <FieldLabel htmlFor="title">Title</FieldLabel>
            <Input id="title" aria-invalid={!!errors.title} {...form.register("title")} />
            <FieldError errors={[errors.title]} />
          </Field>
          {issueId ? null : (
            <>
              <Field data-invalid={!!errors.client_id}>
                <FieldLabel htmlFor="client_id">Client</FieldLabel>
                <NativeSelect
                  id="client_id"
                  {...form.register("client_id", {
                    onChange: () => form.setValue("diagnostic_id", ""),
                  })}
                >
                  <option value="">Choose a client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
                <FieldError errors={[errors.client_id]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="diagnostic_id">From diagnostic</FieldLabel>
                <NativeSelect id="diagnostic_id" {...form.register("diagnostic_id")}>
                  <option value="">None</option>
                  {diagnostics
                    .filter((d) => d.clientId === clientId)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </NativeSelect>
              </Field>
            </>
          )}
          <Field>
            <FieldLabel htmlFor="severity">Severity</FieldLabel>
            <NativeSelect id="severity" className="capitalize" {...form.register("severity")}>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s[0]!.toUpperCase() + s.slice(1)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="assignee_user_id">Assignee</FieldLabel>
            <NativeSelect id="assignee_user_id" {...form.register("assignee_user_id")}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="description">Description</FieldLabel>
            <Textarea id="description" rows={4} {...form.register("description")} />
          </Field>
        </div>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : issueId ? "Save issue" : "Open issue"}
        </Button>
      </FieldGroup>
    </form>
  );
}
