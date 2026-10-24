"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signInSchema, type SignInInput } from "@/features/auth/schemas";
import { signIn } from "@/features/auth/server/actions";

export function LoginForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await signIn(values);
      if (result && !result.ok) {
        setServerError(result.error);
        form.resetField("password");
      }
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
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...form.register("password")}
          />
          <FieldError errors={[errors.password]} />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </FieldGroup>
    </form>
  );
}
