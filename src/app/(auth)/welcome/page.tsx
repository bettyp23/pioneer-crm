import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SetPasswordForm } from "@/features/auth/components/set-password-form";

export const metadata: Metadata = { title: "Set up your account" };

// Landing page for the emailed invite link (supabase/templates/invite.html). Public: the
// visitor has no session until the token is verified by the form's Server Action.
export default async function WelcomePage(props: PageProps<"/welcome">) {
  const { token_hash: tokenHash, type } = await props.searchParams;
  const valid = typeof tokenHash === "string" && tokenHash.length >= 8 && type === "invite";

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Welcome to your client portal</h1>
        </CardTitle>
        <CardDescription>
          {valid
            ? "Choose a password to finish setting up your account."
            : "This link isn't complete. Open the invite email again and use its button, or ask Pioneer Digital AI to send a new invite."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {valid ? <SetPasswordForm tokenHash={tokenHash} purpose="invite" /> : null}
        <Link href="/" className="text-muted-foreground self-center text-sm underline">
          Already set up? Sign in
        </Link>
      </CardContent>
    </Card>
  );
}
