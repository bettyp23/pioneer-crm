"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormError } from "@/components/forms/form-error";
import { Textarea } from "@/components/forms/textarea";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { contactFormSchema, type ContactFormInput } from "@/features/contacts/schemas";
import { createContact, updateContact } from "@/features/contacts/server/actions";

const EMPTY: ContactFormInput = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  job_title: "",
  is_primary: false,
  notes: "",
};

export function ContactForm({
  clientId,
  contactId,
  defaultValues,
}: {
  clientId: string;
  contactId?: string;
  defaultValues?: ContactFormInput;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<ContactFormInput, unknown, z.output<typeof contactFormSchema>>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: defaultValues ?? EMPTY,
  });
  const { errors } = form.formState;

  // Client-side validation only gates submission; the server re-parses the raw input.
  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setServerError(null);
      const result = contactId
        ? await updateContact(contactId, form.getValues())
        : await createContact(clientId, form.getValues());
      if (result && !result.ok) setServerError(result.error);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-2xl">
      <FieldGroup>
        <FormError message={serverError} />
        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors.first_name}>
            <FieldLabel htmlFor="first_name">First name</FieldLabel>
            <Input
              id="first_name"
              aria-invalid={!!errors.first_name}
              {...form.register("first_name")}
            />
            <FieldError errors={[errors.first_name]} />
          </Field>
          <Field data-invalid={!!errors.last_name}>
            <FieldLabel htmlFor="last_name">Last name</FieldLabel>
            <Input id="last_name" {...form.register("last_name")} />
            <FieldError errors={[errors.last_name]} />
          </Field>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              aria-invalid={!!errors.email}
              {...form.register("email")}
            />
            <FieldError errors={[errors.email]} />
          </Field>
          <Field data-invalid={!!errors.phone}>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <Input id="phone" type="tel" {...form.register("phone")} />
            <FieldError errors={[errors.phone]} />
          </Field>
          <Field data-invalid={!!errors.job_title}>
            <FieldLabel htmlFor="job_title">Job title</FieldLabel>
            <Input id="job_title" {...form.register("job_title")} />
            <FieldError errors={[errors.job_title]} />
          </Field>
          <Field orientation="horizontal" className="items-center self-end">
            <input
              id="is_primary"
              type="checkbox"
              className="accent-primary size-4"
              {...form.register("is_primary")}
            />
            <FieldLabel htmlFor="is_primary">Primary contact</FieldLabel>
          </Field>
          <Field data-invalid={!!errors.notes} className="sm:col-span-2">
            <FieldLabel htmlFor="notes">Notes</FieldLabel>
            <Textarea id="notes" rows={3} {...form.register("notes")} />
            <FieldError errors={[errors.notes]} />
          </Field>
        </div>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : contactId ? "Save contact" : "Add contact"}
        </Button>
      </FieldGroup>
    </form>
  );
}
