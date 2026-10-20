// Secret-key (service role) client. BYPASSES RLS.
// Import allowlisted to scripts/** only (enforced by ESLint; docs/architecture.md §3).
// Deliberately no `import "server-only"`: it is used from plain Node scripts.
import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

export function createSupabaseAdminClient(url: string, secretKey: string) {
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY is required for admin operations");
  }
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
