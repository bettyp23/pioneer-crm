"use client";

import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  startTotpEnrollment,
  verifyTotpEnrollment,
  type EnrollmentStart,
} from "@/features/auth/server/actions";

import { TotpCodeForm } from "./totp-code-form";

// Register an authenticator app (TOTP), then confirm with a first code. Required for staff;
// optional for client accounts (D-39), which see different wording.
export function MfaEnroll({ optional = false }: { optional?: boolean }) {
  const [enrollment, setEnrollment] = useState<EnrollmentStart | null>(null);
  const [pending, startTransition] = useTransition();

  const begin = () =>
    startTransition(async () => {
      setEnrollment(await startTotpEnrollment());
    });

  if (!enrollment || pending) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          {optional
            ? "With an authenticator app, signing in also asks for a 6-digit code from your phone, so nobody can get in with just your password. You'll scan a QR code to set it up."
            : "Pioneer OS requires an authenticator app. You'll scan a QR code and enter a 6-digit code to finish signing in."}
        </p>
        <Button onClick={begin} disabled={pending}>
          {pending ? "Preparing…" : "Set up authenticator app"}
        </Button>
      </div>
    );
  }

  if (!enrollment.ok) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <AlertDescription>{enrollment.error}</AlertDescription>
        </Alert>
        <Button onClick={begin}>Try again</Button>
      </div>
    );
  }

  const { factorId, qrCode, secret } = enrollment;
  return (
    <div className="flex flex-col gap-6">
      <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
        <li>Open your authenticator app (1Password, Authy, Google Authenticator…).</li>
        <li>Scan the QR code, or enter the setup key manually.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element -- data: URI from Supabase Auth */}
      <img
        src={qrCode}
        alt="QR code for your authenticator app"
        width={176}
        height={176}
        className="mx-auto rounded-md bg-white p-2"
      />
      <div className="text-sm">
        <p className="text-muted-foreground">Setup key</p>
        <code className="bg-muted mt-1 block rounded px-2 py-1 font-mono text-xs break-all select-all">
          {secret}
        </code>
      </div>
      <TotpCodeForm
        submitLabel="Confirm and continue"
        onSubmitCode={(code) => verifyTotpEnrollment({ factorId, code })}
      />
    </div>
  );
}
