
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

/**
 * Standalone Supabase client for Mastra tools
 * Works in both Studio and Next.js contexts
 * CRITICAL: Uses server client with cookies for authentication to support RLS policies
 */
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    );
  }

  // Check if we're in Next.js server context (has cookies available)
  const isNextJsServer = typeof process !== 'undefined' && process.env.NEXT_RUNTIME;

  if (isNextJsServer) {
    // Next.js server context - use cookies for authenticated session
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();

    return createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Server Component context - ignore
            }
          },
        },
      }
    );
  }

  // CLI/Node.js context - simple client without cookies
  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}

