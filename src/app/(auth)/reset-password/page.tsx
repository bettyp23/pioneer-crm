import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SetPasswordForm } from "@/features/auth/components/set-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

// Landing page for the emailed reset link (supabase/templates/recovery.html). Public: the
// visitor has no session until the token is verified by the form's Server Action.
export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const { token_hash: tokenHash, type } = await props.searchParams;
  const valid = typeof tokenHash === "string" && tokenHash.length >= 8 && type === "recovery";

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Choose a new password</h1>
        </CardTitle>
        <CardDescription>
          {valid
            ? "Your old password stops working once you save the new one."
            : "This link isn't complete. Open the reset email again and use its button, or ask for a new link."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {valid ? (
          <SetPasswordForm tokenHash={tokenHash} purpose="recovery" />
        ) : (
          <Link href="/forgot-password" className="self-center text-sm underline">
            Send a new reset link
          </Link>
        )}
        <Link href="/" className="text-muted-foreground self-center text-sm underline">
          Back to sign in
        </Link>
      </CardContent>
    </Card>
  );
}
