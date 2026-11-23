"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  MIN_PASSWORD_LENGTH,
  setPasswordSchema,
  type SetPasswordInput,
} from "@/features/auth/schemas";
import { acceptInvite, resetPassword } from "@/features/auth/server/actions";

// Sets a new password from an emailed link: an invite (new account) or a password reset.
export function SetPasswordForm({
  tokenHash,
  purpose,
}: {
  tokenHash: string;
  purpose: "invite" | "recovery";
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  // Reset of an account with an authenticator: the link is used up; the code comes next.
  const [needsCode, setNeedsCode] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<SetPasswordInput>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { tokenHash, code: undefined, password: "", confirm: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const input = needsCode
        ? { ...values, tokenHash: undefined }
        : { ...values, code: undefined };
      const result = await (purpose === "invite" ? acceptInvite : resetPassword)(input);
      if (result && !result.ok) {
        setServerError(result.error);
        if (result.needsCode) setNeedsCode(true);
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
        <input type="hidden" {...form.register("tokenHash")} />
        {needsCode ? (
          <Field data-invalid={!!errors.code}>
            <FieldLabel htmlFor="totp-code">Authenticator code</FieldLabel>
            <Input
              id="totp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              aria-invalid={!!errors.code}
              {...form.register("code")}
            />
            <FieldError errors={[errors.code]} />
          </Field>
        ) : null}
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="new-password">
            {purpose === "invite" ? "Choose a password" : "New password"}
          </FieldLabel>
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
