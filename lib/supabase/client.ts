import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Service role client — bypasses RLS, uses supabase-js directly (no cookie handling needed)
export function createServiceClient(url: string, key: string) {
  return createSupabaseClient(url, key);
}
