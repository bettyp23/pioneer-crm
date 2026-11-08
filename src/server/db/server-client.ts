import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/env";
import { APP_BASE_PATH, scopedAuthCookie } from "@/lib/mount";
import type { Database } from "@/server/db/database.types";

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// Cookie-bound client acting as the signed-in user: RLS applies to every query.
// Create one per request; never share across requests.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: { path: APP_BASE_PATH },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              const cookie = scopedAuthCookie(name, value, options);
              cookieStore.set(cookie.name, cookie.value, cookie.options);
            }
          } catch {
            // Server Components cannot set cookies. src/proxy.ts refreshes the session
            // on every request, so this is safe to ignore there.
          }
        },
      },
    },
  );
}
