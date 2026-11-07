import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { absolutePublicUrl } from "@/lib/mount";
import { can, isRole, type Permission, type Role } from "@/server/auth/permissions";
import { createSupabaseServerClient } from "@/server/db/server-client";

// Page renders redirect with an absolute same-host URL. A path-only RSC
// redirect is prefixed by vinext's client on top of the basePath.
export async function redirectToAppPath(appPath: string): Promise<never> {
  const headerList = await headers();
  const host = (headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "")
    .split(",")[0]
    ?.trim();
  const proto = (headerList.get("x-forwarded-proto") ?? "http").split(",")[0]?.trim() ?? "http";
  redirect(absolutePublicUrl(appPath, host ?? "", proto) ?? appPath);
}

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
  if (!claims) return redirectToAppPath("/");
  if (claims.aal !== "aal2") return redirectToAppPath("/mfa");

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
    return redirectToAppPath("/no-access");
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
