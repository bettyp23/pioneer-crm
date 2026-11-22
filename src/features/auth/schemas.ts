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

// Accepting an emailed invite: the link's one-time token plus the new password.
export const acceptInviteSchema = z
  .object({
    tokenHash: z.string().min(8).max(200),
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
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
