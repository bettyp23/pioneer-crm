import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";
import { getClaims, homePath } from "@/server/auth/session";

export const metadata: Metadata = { title: "Sign in" };

// App root. With basePath /login the public URL is /login, not /login/login.
export default async function LoginPage() {
  const claims = await getClaims();
  if (claims?.aal === "aal2") redirect(await homePath());
  if (claims) redirect("/mfa");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Sign in</h1>
        </CardTitle>
        <CardDescription>Accounts are created by the workspace owner.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
