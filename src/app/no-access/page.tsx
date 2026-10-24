import type { Metadata } from "next";

import { SignOutButton } from "@/components/layout/sign-out-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "No workspace access" };

// Signed in (with MFA) but without an active workspace membership.
export default function NoAccessPage() {
  return (
    <main className="bg-muted/40 flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1>No workspace access</h1>
          </CardTitle>
          <CardDescription>
            Your account isn&apos;t an active member of a workspace. Ask the workspace owner to add
            you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutButton className="w-full" formClassName="w-full" />
        </CardContent>
      </Card>
    </main>
  );
}
