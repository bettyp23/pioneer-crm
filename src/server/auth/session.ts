import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { can, isRole, type Permission, type Role } from "@/server/auth/permissions";
import { createSupabaseServerClient } from "@/server/db/server-client";

export type CurrentMember = {
  userId: string;
  email: string | null;
  displayName: string;
  workspaceId: string;
  workspaceName: string;
  workspaceTimezone: string;
  role: Role;
};

// One Supabase client per request (React cache is request-scoped).
export const getSupabase = cache(createSupabaseServerClient);

// Verified JWT claims, or null when signed out. Never trusts getSession() server-side:
// getClaims() validates the token signature (docs/security.md §2).
export const getClaims = cache(async () => {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  return data.claims;
});

// Signed in with password + TOTP (aal2), and an active member of a workspace.
// Redirects otherwise. Call from every protected page, query and Server Action.
export const requireMember = cache(async () => {
  const claims = await getClaims();
  if (!claims) redirect("/");
  if (claims.aal !== "aal2") redirect("/mfa");

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspace:workspaces(id, name, timezone), profile:profiles(display_name)")
    .eq("user_id", claims.sub)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load membership (${error.code})`);
  if (!data || !data.workspace || !data.profile || !isRole(data.role)) {
    // Client accounts have no membership; send them to their portal instead.
    if (await getPortalClient()) redirect("/portal");
    redirect("/no-access");
  }

  const member: CurrentMember = {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    displayName: data.profile.display_name,
    workspaceId: data.workspace.id,
    workspaceName: data.workspace.name,
    workspaceTimezone: data.workspace.timezone,
    role: data.role,
  };
  return { supabase, member };
});

// For pages: a missing permission renders 404 (does not reveal the page exists).
export async function requirePagePermission(permission: Permission) {
  const ctx = await requireMember();
  if (!can(ctx.member.role, permission)) notFound();
  return ctx;
}

export class ForbiddenError extends Error {
  constructor(permission: Permission) {
    super(`Forbidden: missing permission ${permission}`);
    this.name = "ForbiddenError";
  }
}

// For Server Actions and Route Handlers.
export async function requireRole(permission: Permission) {
  const ctx = await requireMember();
  if (!can(ctx.member.role, permission)) throw new ForbiddenError(permission);
  return ctx;
}

export type PortalClient = { id: string; name: string; timezone: string };

// The signed-in client account's own client record, or null (staff, unlinked accounts, or a
// client with an authenticator who hasn't entered the code yet; enforced in the database).
export const getPortalClient = cache(async (): Promise<PortalClient | null> => {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc("portal_client").maybeSingle();
  if (error) throw new Error(`Failed to load portal client (${error.code})`);
  return data ?? null;
});

export type CurrentClientUser = {
  userId: string;
  email: string | null;
  displayName: string;
  client: PortalClient;
};

// True when the signed-in account has a verified authenticator app. listFactors() reads the
// user from the Auth server (not the unverified cookie).
export const hasAuthenticator = cache(async (): Promise<boolean> => {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error(`Failed to load MFA factors (${error.code})`);
  return data.totp.length > 0;
});

// Signed in as a client account linked to a client record. Authenticator apps are optional
// for clients (D-39): a password-only session is enough until the client adds one, then the
// code is required. Staff go to their dashboard (which always requires the code); anyone
// else to /no-access. Call from every portal page, query, Route Handler and Server Action.
// The database enforces the same rules (RLS, private.is_mfa()).
export const requireClient = cache(async () => {
  const claims = await getClaims();
  if (!claims) redirect("/");
  if (claims.aal !== "aal2") {
    if (await hasAuthenticator()) redirect("/mfa");
    // Without the code, only a client account can continue; admins must set one up.
    if (!(await getPortalClient())) redirect("/mfa");
  }

  const supabase = await getSupabase();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("user_id", claims.sub)
    .maybeSingle();
  if (error) throw new Error(`Failed to load profile (${error.code})`);
  if (profile?.role === "admin") redirect("/dashboard");

  const client = await getPortalClient();
  if (!profile || !client) redirect("/no-access");

  const user: CurrentClientUser = {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    displayName: profile.display_name,
    client,
  };
  return { supabase, user };
});

// Where a fully signed-in (aal2) account starts: client accounts in their portal, staff on
// the dashboard (which sends anyone without a membership to /no-access).
export async function homePath(): Promise<"/portal" | "/dashboard"> {
  return (await getPortalClient()) ? "/portal" : "/dashboard";
}

// Where to go right after a password is accepted (sign-in, invite, password reset): a client
// without an authenticator goes straight to the portal; everyone else to /mfa for the code
// (or to set one up). Call after the session exists; nothing earlier in the request may have
// read the cached session helpers.
export async function afterPasswordPath(): Promise<"/portal" | "/mfa"> {
  if (await hasAuthenticator()) return "/mfa";
  return (await getPortalClient()) ? "/portal" : "/mfa";
}
