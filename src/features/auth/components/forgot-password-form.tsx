"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/features/auth/schemas";
import { requestPasswordReset } from "@/features/auth/server/actions";

export function ForgotPasswordForm() {
  const [result, setResult] = useState<
    { kind: "sent"; text: string } | { kind: "error"; text: string } | null
  >(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      const r = await requestPasswordReset(values);
      setResult(r.ok ? { kind: "sent", text: r.message } : { kind: "error", text: r.error });
    });
  });

  if (result?.kind === "sent") {
    return (
      <Alert role="status">
        <AlertDescription>{result.text}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {result?.kind === "error" ? (
          <Alert variant="destructive">
            <AlertDescription>{result.text}</AlertDescription>
          </Alert>
        ) : null}
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            autoFocus
            aria-invalid={!!errors.email}
            {...form.register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Email me a reset link"}
        </Button>
      </FieldGroup>
    </form>
  );
}
