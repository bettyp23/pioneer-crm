"use server";

import { redirect } from "next/navigation";

import {
  signInSchema,
  totpCodeSchema,
  verifyEnrollmentSchema,
  type ActionResult,
} from "@/features/auth/schemas";
import { getClaims, getSupabase } from "@/server/auth/session";

// Server Actions are public HTTP endpoints: every input is re-validated here.
// Error messages are deliberately generic (no account enumeration; docs/security.md §2).

const SIGN_IN_FAILED = "Sign-in failed. Check your email and password and try again.";
const CODE_FAILED = "That code didn't work. Wait for a new code and try again.";

export async function signIn(input: unknown): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: SIGN_IN_FAILED };

  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    console.warn("auth.sign_in_failed", { code: error.code, status: error.status });
    return { ok: false, error: SIGN_IN_FAILED };
  }
  redirect("/login/mfa");
}

export type EnrollmentStart =
  { ok: true; factorId: string; qrCode: string; secret: string } | { ok: false; error: string };

export async function startTotpEnrollment(): Promise<EnrollmentStart> {
  const claims = await getClaims();
  if (!claims) redirect("/login");

  const supabase = await getSupabase();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return { ok: false, error: "Could not start enrollment. Try again." };
  if (factors.totp.length > 0) redirect("/login/mfa");

  // Remove abandoned, unverified enrollments before starting a new one.
  for (const factor of factors.all) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Authenticator app",
  });
  if (error) {
    console.warn("auth.mfa_enroll_failed", { code: error.code });
    return { ok: false, error: "Could not start enrollment. Try again." };
  }
  return { ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyTotpEnrollment(input: unknown): Promise<ActionResult> {
  const parsed = verifyEnrollmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: CODE_FAILED };
  if (!(await getClaims())) redirect("/login");

  const supabase = await getSupabase();
  const { error } = await supabase.auth.mfa.challengeAndVerify(parsed.data);
  if (error) {
    console.warn("auth.mfa_enroll_verify_failed", { code: error.code });
    return { ok: false, error: CODE_FAILED };
  }
  redirect("/dashboard");
}

export async function verifyTotp(input: unknown): Promise<ActionResult> {
  const parsed = totpCodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: CODE_FAILED };
  if (!(await getClaims())) redirect("/login");

  const supabase = await getSupabase();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp[0];
  if (listError || !factor) redirect("/login/mfa");

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: parsed.data.code,
  });
  if (error) {
    console.warn("auth.mfa_verify_failed", { code: error.code });
    return { ok: false, error: CODE_FAILED };
  }
  redirect("/dashboard");
}
