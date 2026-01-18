import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client for Mastra CLI context
 * No Next.js dependencies - uses basic auth with anon key
 */
export function createClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
