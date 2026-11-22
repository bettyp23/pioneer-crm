"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  acceptInviteSchema,
  MIN_PASSWORD_LENGTH,
  type AcceptInviteInput,
} from "@/features/auth/schemas";
import { acceptInvite } from "@/features/auth/server/actions";

export function AcceptInviteForm({ tokenHash }: { tokenHash: string }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<AcceptInviteInput>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { tokenHash, password: "", confirm: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await acceptInvite(values);
      if (result && !result.ok) setServerError(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {serverError ? (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}
        <input type="hidden" {...form.register("tokenHash")} />
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="new-password">Choose a password</FieldLabel>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            autoFocus
            aria-invalid={!!errors.password}
            {...form.register("password")}
          />
          <FieldDescription>At least {MIN_PASSWORD_LENGTH} characters.</FieldDescription>
          <FieldError errors={[errors.password]} />
        </Field>
        <Field data-invalid={!!errors.confirm}>
          <FieldLabel htmlFor="confirm-password">Type it again</FieldLabel>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirm}
            {...form.register("confirm")}
          />
          <FieldError errors={[errors.confirm]} />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save password and continue"}
        </Button>
      </FieldGroup>
    </form>
  );
}
