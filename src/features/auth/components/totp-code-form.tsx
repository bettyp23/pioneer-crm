"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { totpCodeSchema, type ActionResult, type TotpCodeInput } from "@/features/auth/schemas";

// 6-digit TOTP entry shared by MFA verify and enrollment.
export function TotpCodeForm({
  submitLabel,
  onSubmitCode,
}: {
  submitLabel: string;
  onSubmitCode: (code: string) => Promise<ActionResult>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<TotpCodeInput>({
    resolver: zodResolver(totpCodeSchema),
    defaultValues: { code: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(({ code }) => {
    setServerError(null);
    startTransition(async () => {
      const result = await onSubmitCode(code);
      if (result && !result.ok) {
        setServerError(result.error);
        form.reset({ code: "" });
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
        <Field data-invalid={!!errors.code}>
          <FieldLabel htmlFor="totp-code">Authentication code</FieldLabel>
          <Controller
            control={form.control}
            name="code"
            render={({ field }) => (
              <InputOTP
                id="totp-code"
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                aria-invalid={!!errors.code}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            )}
          />
          <FieldError errors={[errors.code]} />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Verifying…" : submitLabel}
        </Button>
      </FieldGroup>
    </form>
  );
}
