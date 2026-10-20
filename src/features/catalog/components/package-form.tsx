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
import { packageFormSchema, type PackageFormInput } from "@/features/catalog/schemas";
import { savePackage } from "@/features/catalog/server/actions";

const EMPTY: PackageFormInput = { name: "", description: "", list_price: "", is_active: true };

export function PackageForm({
  packageId,
  defaultValues,
}: {
  packageId?: string;
  defaultValues?: PackageFormInput;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<PackageFormInput, unknown, z.output<typeof packageFormSchema>>({
    resolver: zodResolver(packageFormSchema),
    defaultValues: defaultValues ?? EMPTY,
  });
  const { errors } = form.formState;

  // Client-side validation gates submission; the server re-parses the raw input.
  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setServerError(null);
      const result = await savePackage(packageId ?? null, form.getValues());
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
          <Field data-invalid={!!errors.list_price}>
            <FieldLabel htmlFor="list_price">Package price (USD, optional)</FieldLabel>
            <Input id="list_price" inputMode="decimal" {...form.register("list_price")} />
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
            <FieldLabel htmlFor="is_active">Active</FieldLabel>
          </Field>
        </div>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : packageId ? "Save package" : "Create package"}
        </Button>
      </FieldGroup>
    </form>
  );
}
