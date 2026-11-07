import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";
import { APP_BASE_PATH } from "@/lib/mount";
import type { Database } from "@/server/db/database.types";

// Browser client: publishable key only. Used for auth flows (sign-in, MFA) in client
// components; every data read is still subject to RLS.
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { cookieOptions: { path: APP_BASE_PATH } },
  );
}
