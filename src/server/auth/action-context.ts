import "server-only";

import type { Permission } from "@/server/auth/permissions";
import { ForbiddenError, requireRole } from "@/server/auth/session";

type Ctx = Awaited<ReturnType<typeof requireRole>>;

// Authorizes a Server Action. Redirects (signed out / no MFA) propagate as usual;
// a missing permission becomes a normal error result instead of a crash.
export async function authorizeAction(
  permission: Permission,
): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  try {
    return { ok: true, ctx: await requireRole(permission) };
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return { ok: false, error: "You don't have permission to do that." };
    }
    throw e;
  }
}
