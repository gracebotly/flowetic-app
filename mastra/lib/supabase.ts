
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Standalone Supabase client for Mastra tools
 * Works in both Studio and Next.js contexts
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    );
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}

