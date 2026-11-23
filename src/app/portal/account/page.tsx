import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { removeAuthenticator } from "@/features/portal/server/actions";
import { hasAuthenticator, requireClient } from "@/server/auth/session";

export const metadata: Metadata = { title: "Account" };

export default async function PortalAccountPage() {
  const { user } = await requireClient();
  const authenticatorOn = await hasAuthenticator();

  return (
    <>
      <PageHeader title="Account" description="How you sign in to this portal." />

      <section className="bg-background flex flex-col gap-3 rounded-md border p-4">
        <h2 className="font-medium">Email</h2>
        <p className="text-sm">{user.email ?? "—"}</p>
      </section>

      <section className="bg-background flex flex-col gap-3 rounded-md border p-4">
        <h2 className="font-medium">Authenticator app: {authenticatorOn ? "on" : "off"}</h2>
        {authenticatorOn ? (
          <>
            <p className="text-muted-foreground text-sm">
              Signing in asks for your password and a 6-digit code from your authenticator app.
            </p>
            <ActionForm action={removeAuthenticator} successMessage="Authenticator app turned off">
              <Button type="submit" variant="outline" className="self-start">
                Turn off
              </Button>
            </ActionForm>
          </>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              Optional. With it on, signing in also asks for a 6-digit code from your phone, so
              nobody can get in with just your password.
            </p>
            <Button asChild className="self-start">
              <Link href="/mfa">Set up authenticator app</Link>
            </Button>
          </>
        )}
      </section>

      <section className="bg-background flex flex-col gap-3 rounded-md border p-4">
        <h2 className="font-medium">Password</h2>
        <p className="text-muted-foreground text-sm">
          To change your password, we&apos;ll email you a link.
        </p>
        <Button asChild variant="outline" className="self-start">
          <Link href="/forgot-password">Change password</Link>
        </Button>
      </section>
    </>
  );
}
