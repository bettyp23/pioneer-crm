import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/layout/sign-out-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MfaEnroll } from "@/features/auth/components/mfa-enroll";
import { MfaVerify } from "@/features/auth/components/mfa-verify";
import { getClaims, getSupabase } from "@/server/auth/session";

export const metadata: Metadata = { title: "Two-step verification" };

export default async function MfaPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  if (claims.aal === "aal2") redirect("/dashboard");

  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error(`Failed to load MFA factors (${error.code})`);
  const hasVerifiedTotp = data.totp.length > 0;

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
