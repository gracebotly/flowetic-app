import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Extract the authenticated user's ID from Supabase auth.
 * Returns null if not authenticated. Used by logActivity callers.
 */
export async function getUserId(
  supabase: SupabaseClient
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
