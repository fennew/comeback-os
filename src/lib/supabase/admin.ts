import { createClient } from "@supabase/supabase-js";

// Service-role client for server-side operations (Inngest jobs, admin tasks)
// WARNING: This bypasses RLS - use only in trusted server contexts
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
