"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormError } from "@/components/forms/form-error";
import { Textarea } from "@/components/forms/textarea";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { serviceFormSchema, type ServiceFormInput } from "@/features/catalog/schemas";
import { saveService } from "@/features/catalog/server/actions";

const EMPTY: ServiceFormInput = {
  code: "",
  name: "",
  category: "",
  description: "",
  list_price: "",
  is_active: true,
};

export function ServiceForm({
  serviceId,
  defaultValues,
}: {
  serviceId?: string;
  defaultValues?: ServiceFormInput;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<ServiceFormInput, unknown, z.output<typeof serviceFormSchema>>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: defaultValues ?? EMPTY,
  });
  const { errors } = form.formState;

  // Client-side validation gates submission; the server re-parses the raw input.
  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setServerError(null);
      const result = await saveService(serviceId ?? null, form.getValues());
      if (result && !result.ok) setServerError(result.error);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-2xl">
      <FieldGroup>
        <FormError message={serverError} />
        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input id="name" aria-invalid={!!errors.name} {...form.register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>
          <Field data-invalid={!!errors.code}>
            <FieldLabel htmlFor="code">Code</FieldLabel>
            <Input
              id="code"
              placeholder="website-build"
              aria-invalid={!!errors.code}
              {...form.register("code")}
            />
            <FieldDescription>Short identifier used in reports.</FieldDescription>
            <FieldError errors={[errors.code]} />
          </Field>
          <Field data-invalid={!!errors.category}>
            <FieldLabel htmlFor="category">Category</FieldLabel>
            <Input id="category" {...form.register("category")} />
            <FieldError errors={[errors.category]} />
          </Field>
          <Field data-invalid={!!errors.list_price}>
            <FieldLabel htmlFor="list_price">List price (USD, optional)</FieldLabel>
            <Input
              id="list_price"
              inputMode="decimal"
              aria-invalid={!!errors.list_price}
              {...form.register("list_price")}
            />
            <FieldDescription>Your price, if you have a standard one.</FieldDescription>
            <FieldError errors={[errors.list_price]} />
          </Field>
          <Field data-invalid={!!errors.description} className="sm:col-span-2">
            <FieldLabel htmlFor="description">Description</FieldLabel>
            <Textarea id="description" rows={3} {...form.register("description")} />
            <FieldError errors={[errors.description]} />
          </Field>
          <Field orientation="horizontal" className="items-center">
            <input
              id="is_active"
              type="checkbox"
              className="accent-primary size-4"
              {...form.register("is_active")}
            />
            <FieldLabel htmlFor="is_active">Active (offered to clients)</FieldLabel>
          </Field>
        </div>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : serviceId ? "Save service" : "Create service"}
        </Button>
      </FieldGroup>
    </form>
  );
}
