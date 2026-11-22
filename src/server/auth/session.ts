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

// The signed-in client account's own client record (RLS + MFA in the database), or null.
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

// Signed in with password + TOTP as a client account linked to a client record.
// Staff go to their dashboard; anyone else to /no-access. Call from every portal page,
// query, Route Handler and Server Action. The database enforces the same rules (RLS).
export const requireClient = cache(async () => {
  const claims = await getClaims();
  if (!claims) redirect("/");
  if (claims.aal !== "aal2") redirect("/mfa");

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
