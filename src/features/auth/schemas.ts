import { z } from "zod";

// Shared by the forms (client) and the Server Actions (server).

export const signInSchema = z.object({
  email: z.email("Enter a valid email address").max(320),
  password: z.string().min(1, "Enter your password").max(1024),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const totpCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app"),
});
export type TotpCodeInput = z.infer<typeof totpCodeSchema>;

export const verifyEnrollmentSchema = totpCodeSchema.extend({
  factorId: z.uuid(),
});
export type VerifyEnrollmentInput = z.infer<typeof verifyEnrollmentSchema>;

export type ActionResult = { ok: false; error: string } | undefined;

export const MIN_PASSWORD_LENGTH = 12;

// Accepting an emailed invite or password-reset link: the link's one-time token plus the new
// password. For a reset on an account with an authenticator app, a second submit carries the
// app's code instead of the token (the token is used up by the first submit).
export const setPasswordSchema = z
  .object({
    tokenHash: z.string().min(8).max(200).optional(),
    code: z
      .string()
      .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app")
      .optional(),
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
      .max(72, "Use at most 72 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "The passwords don't match",
    path: ["confirm"],
  });
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address").max(320),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// needsCode: the reset link was accepted, and the account's authenticator code is needed next.
export type SetPasswordResult = { ok: false; error: string; needsCode?: boolean } | undefined;

export type MessageResult = { ok: true; message: string } | { ok: false; error: string };
