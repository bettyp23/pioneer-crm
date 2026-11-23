import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = { title: "Reset your password" };

// Public: step 1 of a password reset. The emailed link opens /reset-password.
export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Reset your password</h1>
        </CardTitle>
        <CardDescription>
          Enter the email you sign in with and we&apos;ll send you a link to choose a new password.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ForgotPasswordForm />
        <Link href="/" className="text-muted-foreground self-center text-sm underline">
          Back to sign in
        </Link>
      </CardContent>
    </Card>
  );
}
