"use client";

import { verifyTotp } from "@/features/auth/server/actions";

import { TotpCodeForm } from "./totp-code-form";

export function MfaVerify() {
  return <TotpCodeForm submitLabel="Verify" onSubmitCode={(code) => verifyTotp({ code })} />;
}
