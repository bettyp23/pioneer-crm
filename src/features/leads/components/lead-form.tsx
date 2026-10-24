"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormError } from "@/components/forms/form-error";
import { NativeSelect } from "@/components/forms/native-select";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { leadFormSchema, type LeadFormInput } from "@/features/leads/schemas";
import { createLead, updateLead } from "@/features/leads/server/actions";

type Option = { id: string; name: string };

export function LeadForm({
  clientId,
  leadId,
  clients,
  contacts,
  stages,
  members,
  defaultValues,
}: {
  clientId?: string;
  leadId?: string;
  clients?: Option[]; // shown when creating a lead without a preselected client
  contacts: (Option & { clientId: string })[];
  stages: Option[];
  members: Option[];
  defaultValues: LeadFormInput;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState(clientId ?? "");
  const [pending, startTransition] = useTransition();
  const form = useForm<LeadFormInput, unknown, z.output<typeof leadFormSchema>>({
    resolver: zodResolver(leadFormSchema),
    defaultValues,
  });
  const { errors } = form.formState;
  const clientContacts = contacts.filter((c) => c.clientId === selectedClient);

  // Client-side validation only gates submission; the server re-parses the raw input.
  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setServerError(null);
      if (!leadId && !selectedClient) {
        setServerError("Choose a client.");
        return;
      }
      const result = leadId
        ? await updateLead(leadId, form.getValues())
        : await createLead(selectedClient, form.getValues());
      if (result && !result.ok) setServerError(result.error);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-2xl">
      <FieldGroup>
        <FormError message={serverError} />
        <div className="grid gap-6 sm:grid-cols-2">
          {clients ? (
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="client">Client</FieldLabel>
              <NativeSelect
                id="client"
                value={selectedClient}
                onChange={(e) => {
                  setSelectedClient(e.target.value);
                  form.setValue("primary_contact_id", "");
                }}
              >
                <option value="">Choose a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
          <Field data-invalid={!!errors.title} className="sm:col-span-2">
            <FieldLabel htmlFor="title">Title</FieldLabel>
            <Input
              id="title"
              placeholder="e.g. Website rebuild"
              aria-invalid={!!errors.title}
              {...form.register("title")}
            />
            <FieldError errors={[errors.title]} />
          </Field>
          {leadId ? null : (
            <Field data-invalid={!!errors.stage_id}>
              <FieldLabel htmlFor="stage_id">Stage</FieldLabel>
              <NativeSelect id="stage_id" {...form.register("stage_id")}>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
              <FieldError errors={[errors.stage_id]} />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="primary_contact_id">Primary contact</FieldLabel>
            <NativeSelect id="primary_contact_id" {...form.register("primary_contact_id")}>
              <option value="">None</option>
              {clientContacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field data-invalid={!!errors.estimated_value}>
            <FieldLabel htmlFor="estimated_value">Estimated value (USD)</FieldLabel>
            <Input
              id="estimated_value"
              inputMode="decimal"
              placeholder="e.g. 12500"
              aria-invalid={!!errors.estimated_value}
              {...form.register("estimated_value")}
            />
            <FieldDescription>Your estimate; leave blank if unknown.</FieldDescription>
            <FieldError errors={[errors.estimated_value]} />
          </Field>
          <Field data-invalid={!!errors.expected_close_on}>
            <FieldLabel htmlFor="expected_close_on">Expected close</FieldLabel>
            <Input id="expected_close_on" type="date" {...form.register("expected_close_on")} />
            <FieldError errors={[errors.expected_close_on]} />
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
          <Field data-invalid={!!errors.source}>
            <FieldLabel htmlFor="source">Source</FieldLabel>
            <Input id="source" placeholder="e.g. Referral" {...form.register("source")} />
            <FieldError errors={[errors.source]} />
          </Field>
        </div>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : leadId ? "Save lead" : "Create lead"}
        </Button>
      </FieldGroup>
    </form>
  );
}
