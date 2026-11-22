import "server-only";

import { createClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";

// Sends Supabase Auth's invite email for a new client account.
//
// The ONLY place the app uses the secret (service-role) key. It never reaches the browser:
// this module is server-only, the key has no NEXT_PUBLIC_ prefix, and ESLint allows importing
// this file only from the client-admin Server Actions (which check owner + MFA first).
// The key is used for exactly one call, auth.admin.inviteUserByEmail; everything else the
// admin does runs as the signed-in owner under RLS.

export type InviteResult =
  { ok: true; userId: string } | { ok: false; error: string; code?: string };

export async function sendPortalInvite(email: string, displayName: string): Promise<InviteResult> {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    return { ok: false, error: "Invites aren't set up on this server yet." };
  }
  const admin = createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // The email template builds the link from the project's Site URL (supabase/templates/invite.html).
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { display_name: displayName },
  });
  if (error || !data.user) {
    console.warn("portal.invite_failed", { code: error?.code, status: error?.status });
    if (error?.code === "email_exists") {
      return {
        ok: false,
        code: error.code,
        error: "That email already has an account. Use a different email address.",
      };
    }
    return { ok: false, code: error?.code, error: "Could not send the invite. Try again." };
  }
  return { ok: true, userId: data.user.id };
}
