"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { FormError } from "@/components/forms/form-error";
import { NativeSelect } from "@/components/forms/native-select";
import { Textarea } from "@/components/forms/textarea";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  CLIENT_STATUS_LABELS,
  CLIENT_STATUSES,
  clientFormSchema,
  type ClientFormInput,
  type ClientFormValues,
} from "@/features/clients/schemas";
import { createClient, updateClient } from "@/features/clients/server/actions";

const EMPTY: ClientFormInput = {
  name: "",
  legal_name: "",
  kind: "organization",
  status: "prospect",
  industry: "",
  website_url: "",
  drive_folder_url: "",
  notes: "",
};

export function ClientForm({
  clientId,
  defaultValues,
}: {
  clientId?: string;
  defaultValues?: ClientFormInput;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<ClientFormInput, unknown, ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: defaultValues ?? EMPTY,
  });
  const { errors } = form.formState;

  // Client-side validation only gates submission; the server re-parses the raw input.
  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setServerError(null);
      const result = clientId
        ? await updateClient(clientId, form.getValues())
        : await createClient(form.getValues());
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
            <FieldLabel htmlFor="kind">Type</FieldLabel>
            <NativeSelect id="kind" {...form.register("kind")}>
              <option value="organization">Organization</option>
              <option value="individual">Individual</option>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="status">Status</FieldLabel>
            <NativeSelect id="status" {...form.register("status")}>
              {CLIENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CLIENT_STATUS_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field data-invalid={!!errors.legal_name}>
            <FieldLabel htmlFor="legal_name">Legal name</FieldLabel>
            <Input id="legal_name" {...form.register("legal_name")} />
            <FieldError errors={[errors.legal_name]} />
          </Field>
          <Field data-invalid={!!errors.industry}>
            <FieldLabel htmlFor="industry">Industry</FieldLabel>
            <Input id="industry" {...form.register("industry")} />
            <FieldError errors={[errors.industry]} />
          </Field>
          <Field data-invalid={!!errors.website_url}>
            <FieldLabel htmlFor="website_url">Website</FieldLabel>
            <Input
              id="website_url"
              type="url"
              placeholder="https://"
              aria-invalid={!!errors.website_url}
              {...form.register("website_url")}
            />
            <FieldError errors={[errors.website_url]} />
          </Field>
          <Field data-invalid={!!errors.drive_folder_url}>
            <FieldLabel htmlFor="drive_folder_url">Google Drive folder</FieldLabel>
            <Input
              id="drive_folder_url"
              type="url"
              placeholder="https://drive.google.com/…"
              aria-invalid={!!errors.drive_folder_url}
              {...form.register("drive_folder_url")}
            />
            <FieldDescription>
              Restrict sharing in Drive; don&apos;t use public links.
            </FieldDescription>
            <FieldError errors={[errors.drive_folder_url]} />
          </Field>
          <Field data-invalid={!!errors.notes} className="sm:col-span-2">
            <FieldLabel htmlFor="notes">Notes</FieldLabel>
            <Textarea id="notes" rows={4} {...form.register("notes")} />
            <FieldDescription>
              Business information only — no health information, card data or passwords.
            </FieldDescription>
            <FieldError errors={[errors.notes]} />
          </Field>
        </div>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : clientId ? "Save changes" : "Create client"}
        </Button>
      </FieldGroup>
    </form>
  );
}
