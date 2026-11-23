"use server";

import { redirect } from "next/navigation";

import {
  forgotPasswordSchema,
  setPasswordSchema,
  signInSchema,
  totpCodeSchema,
  verifyEnrollmentSchema,
  type ActionResult,
  type MessageResult,
  type SetPasswordResult,
} from "@/features/auth/schemas";
import { afterPasswordPath, getClaims, getSupabase, homePath } from "@/server/auth/session";

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
  // Clients without an authenticator go straight to their portal (D-39); others to /mfa.
  redirect(await afterPasswordPath());
}

export type EnrollmentStart =
  { ok: true; factorId: string; qrCode: string; secret: string } | { ok: false; error: string };

export async function startTotpEnrollment(): Promise<EnrollmentStart> {
  const claims = await getClaims();
  if (!claims) redirect("/");

  const supabase = await getSupabase();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return { ok: false, error: "Could not start enrollment. Try again." };
  if (factors.totp.length > 0) redirect("/mfa");

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
  if (!(await getClaims())) redirect("/");

  const supabase = await getSupabase();
  const { error } = await supabase.auth.mfa.challengeAndVerify(parsed.data);
  if (error) {
    console.warn("auth.mfa_enroll_verify_failed", { code: error.code });
    return { ok: false, error: CODE_FAILED };
  }
  redirect(await homePath());
}

export async function verifyTotp(input: unknown): Promise<ActionResult> {
  const parsed = totpCodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: CODE_FAILED };
  if (!(await getClaims())) redirect("/");

  const supabase = await getSupabase();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp[0];
  if (listError || !factor) redirect("/mfa");

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: parsed.data.code,
  });
  if (error) {
    console.warn("auth.mfa_verify_failed", { code: error.code });
    return { ok: false, error: CODE_FAILED };
  }
  redirect(await homePath());
}

const LINK_FAILED = {
  invite:
    "This invite link has expired or was already used. Ask Pioneer Digital AI to send a new one.",
  recovery: "This reset link has expired or was already used. Ask for a new one below.",
} as const;
const CODE_NEEDED = "Now enter the 6-digit code from your authenticator app to save the password.";

// Emailed invite and password-reset links carry a one-time token. Verifying it here (on a
// button press, not on page load) means email link scanners can't use it up. Then the new
// password is saved. Supabase Auth only lets an account with an authenticator app change its
// password after the app's code (aal2), so a reset for such an account takes a second submit
// with the code; that submit relies on the session the first one created.
async function setPasswordFromLink(
  type: "invite" | "recovery",
  input: unknown,
): Promise<SetPasswordResult> {
  const parsed = setPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const { tokenHash, code, password } = parsed.data;

  const supabase = await getSupabase();
  if (tokenHash) {
    const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (verifyError) {
      console.warn(`auth.${type}_verify_failed`, { code: verifyError.code });
      return { ok: false, error: LINK_FAILED[type] };
    }
  } else if (type === "invite" || !code || !(await getClaims())) {
    return { ok: false, error: LINK_FAILED[type] };
  }

  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return { ok: false, error: "Could not save your password. Try again." };
  const factor = factors.totp[0];
  if (factor) {
    if (!code) return { ok: false, error: CODE_NEEDED, needsCode: true };
    const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code,
    });
    if (mfaError) {
      console.warn("auth.mfa_verify_failed", { code: mfaError.code });
      return { ok: false, error: CODE_FAILED, needsCode: true };
    }
  }

  const { error: passwordError } = await supabase.auth.updateUser({ password });
  if (passwordError) {
    console.warn(`auth.${type}_password_failed`, { code: passwordError.code });
    return {
      ok: false,
      needsCode: factor ? true : undefined,
      error:
        passwordError.code === "weak_password"
          ? "Choose a stronger password."
          : passwordError.code === "same_password"
            ? "Choose a password you haven't used here before."
            : "Could not save your password. Try again.",
    };
  }
}

// New client accounts: after the password, /mfa offers (for clients) or requires (for admins)
// an authenticator app.
export async function acceptInvite(input: unknown): Promise<SetPasswordResult> {
  const failed = await setPasswordFromLink("invite", input);
  if (failed) return failed;
  redirect("/mfa");
}

// Forgotten password, step 2: the emailed link's token plus the new password (and the
// authenticator code, for accounts that have one).
export async function resetPassword(input: unknown): Promise<SetPasswordResult> {
  const failed = await setPasswordFromLink("recovery", input);
  if (failed) return failed;
  redirect(await afterPasswordPath());
}

const RESET_SENT =
  "If that email has an account, we've sent a link to reset the password. It works once and expires in an hour.";

// Forgotten password, step 1: email a reset link (supabase/templates/recovery.html). Always the
// same answer, whether or not the account exists (no account enumeration).
export async function requestPasswordReset(input: unknown): Promise<MessageResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };

  const supabase = await getSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email);
  if (error) {
    console.warn("auth.reset_request_failed", { code: error.code, status: error.status });
    if (error.status === 429) {
      return { ok: false, error: "Too many reset emails were sent. Wait a while and try again." };
    }
  }
  return { ok: true, message: RESET_SENT };
}
