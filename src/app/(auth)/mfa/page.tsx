import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/layout/sign-out-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MfaEnroll } from "@/features/auth/components/mfa-enroll";
import { MfaVerify } from "@/features/auth/components/mfa-verify";
import { getClaims, getPortalClient, hasAuthenticator, homePath } from "@/server/auth/session";

export const metadata: Metadata = { title: "Two-step verification" };

// Staff must set up and use an authenticator app. For client accounts it's optional (D-39):
// a client without one is offered setup here with a way to skip; once they have one, its code
// is required like everyone else's.
export default async function MfaPage() {
  const claims = await getClaims();
  if (!claims) redirect("/");
  if (claims.aal === "aal2") redirect(await homePath());

  const hasVerifiedTotp = await hasAuthenticator();
  const optional = !hasVerifiedTotp && (await getPortalClient()) !== null;

  if (optional) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>Add an authenticator app (optional)</h1>
          </CardTitle>
          <CardDescription>
            An extra step that keeps your project information safe. You can also do this later from
            Account in your portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <MfaEnroll optional />
          <Link href="/portal" className="self-center text-sm underline">
            Skip for now
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>{hasVerifiedTotp ? "Two-step verification" : "Set up two-step verification"}</h1>
        </CardTitle>
        <CardDescription>
          {hasVerifiedTotp
            ? "Enter the 6-digit code from your authenticator app."
            : "Required for every account before any data is shown."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {hasVerifiedTotp ? <MfaVerify /> : <MfaEnroll />}
        <SignOutButton variant="link" formClassName="self-center" label="Use a different account" />
      </CardContent>
    </Card>
  );
}
