import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage() {
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error(`Failed to load MFA factors (${error.code})`);

  return (
    <section className="flex max-w-xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Two-step verification</CardTitle>
          <CardDescription>
            Required for every account. Your session is verified with an authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-md border text-sm">
            {data.totp.map((factor) => (
              <li key={factor.id} className="flex items-center justify-between gap-4 p-3">
                <div>
                  <p className="font-medium">{factor.friendly_name || "Authenticator app"}</p>
                  <p className="text-muted-foreground text-xs">
                    Added {formatDateTime(factor.created_at, member.workspaceTimezone)}
                  </p>
                </div>
                <Badge variant="secondary">Active</Badge>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-3 text-xs">
            Replacing or removing an authenticator isn&apos;t available in the app yet. If you lose
            your authenticator, the workspace owner can reset it.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
