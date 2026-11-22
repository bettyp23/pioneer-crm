import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AcceptInviteForm } from "@/features/auth/components/accept-invite-form";

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
            ? "Choose a password. Next you'll connect an authenticator app, which keeps your project information private."
            : "This link isn't complete. Open the invite email again and use its button, or ask Pioneer Digital AI to send a new invite."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {valid ? <AcceptInviteForm tokenHash={tokenHash} /> : null}
        <Link href="/" className="text-muted-foreground self-center text-sm underline">
          Already set up? Sign in
        </Link>
      </CardContent>
    </Card>
  );
}
