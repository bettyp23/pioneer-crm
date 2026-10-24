"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { FormError } from "@/components/forms/form-error";
import { NativeSelect } from "@/components/forms/native-select";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUSES,
  INVOICE_SYSTEM_LABELS,
  INVOICE_SYSTEMS,
  invoiceFormSchema,
  type InvoiceFormInput,
} from "@/features/operations/schemas";
import { saveInvoice } from "@/features/operations/server/actions";

type Option = { id: string; name: string };

// Invoice METADATA only — the invoice itself lives in the accounting system (D-9).
export function InvoiceForm({
  invoiceId,
  defaultValues,
  clients,
  projects,
}: {
  invoiceId?: string;
  defaultValues: InvoiceFormInput;
  clients: Option[];
  projects: (Option & { clientId: string })[];
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<InvoiceFormInput, unknown, z.output<typeof invoiceFormSchema>>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues,
  });
  const { errors } = form.formState;
  const clientId = useWatch({ control: form.control, name: "client_id" });
  const status = useWatch({ control: form.control, name: "status" });

  // Client-side validation gates submission; the server re-parses the raw input.
  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setServerError(null);
      const result = await saveInvoice(invoiceId ?? null, form.getValues());
      if (result && !result.ok) setServerError(result.error);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-2xl">
      <FieldGroup>
        <FormError message={serverError} />
        <p className="text-muted-foreground text-sm">
          Record the invoice you issued in your accounting tool. No payment or card details are
          stored here.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors.client_id}>
            <FieldLabel htmlFor="client_id">Client</FieldLabel>
            <NativeSelect
              id="client_id"
              disabled={Boolean(invoiceId)}
              {...form.register("client_id", { onChange: () => form.setValue("project_id", "") })}
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
            <FieldLabel htmlFor="project_id">Project (optional)</FieldLabel>
            <NativeSelect id="project_id" {...form.register("project_id")}>
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
          <Field>
            <FieldLabel htmlFor="external_system">Issued in</FieldLabel>
            <NativeSelect id="external_system" {...form.register("external_system")}>
              {INVOICE_SYSTEMS.map((s) => (
                <option key={s} value={s}>
                  {INVOICE_SYSTEM_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field data-invalid={!!errors.external_number}>
            <FieldLabel htmlFor="external_number">Invoice number</FieldLabel>
            <Input
              id="external_number"
              aria-invalid={!!errors.external_number}
              {...form.register("external_number")}
            />
            <FieldError errors={[errors.external_number]} />
          </Field>
          <Field data-invalid={!!errors.external_url} className="sm:col-span-2">
            <FieldLabel htmlFor="external_url">Link to the invoice</FieldLabel>
            <Input
              id="external_url"
              type="url"
              placeholder="https://"
              {...form.register("external_url")}
            />
            <FieldError errors={[errors.external_url]} />
          </Field>
          <Field data-invalid={!!errors.amount}>
            <FieldLabel htmlFor="amount">Amount (USD)</FieldLabel>
            <Input
              id="amount"
              inputMode="decimal"
              aria-invalid={!!errors.amount}
              {...form.register("amount")}
            />
            <FieldError errors={[errors.amount]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="status">Status</FieldLabel>
            <NativeSelect id="status" {...form.register("status")}>
              {INVOICE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {INVOICE_STATUS_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
            <FieldDescription>Sent invoices past their due date show as overdue.</FieldDescription>
          </Field>
          <Field data-invalid={!!errors.issued_on}>
            <FieldLabel htmlFor="issued_on">Issued on</FieldLabel>
            <Input id="issued_on" type="date" {...form.register("issued_on")} />
            <FieldError errors={[errors.issued_on]} />
          </Field>
          <Field data-invalid={!!errors.due_on}>
            <FieldLabel htmlFor="due_on">Due on</FieldLabel>
            <Input id="due_on" type="date" {...form.register("due_on")} />
            <FieldError errors={[errors.due_on]} />
          </Field>
          {status === "paid" ? (
            <Field data-invalid={!!errors.paid_on}>
              <FieldLabel htmlFor="paid_on">Paid on</FieldLabel>
              <Input id="paid_on" type="date" {...form.register("paid_on")} />
              <FieldError errors={[errors.paid_on]} />
            </Field>
          ) : null}
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="notes">Notes</FieldLabel>
            <Input id="notes" {...form.register("notes")} />
          </Field>
        </div>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : invoiceId ? "Save invoice" : "Record invoice"}
        </Button>
      </FieldGroup>
    </form>
  );
}
