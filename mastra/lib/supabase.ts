
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Creates an authenticated Supabase client for Mastra tools
 * Uses the user's access token to enforce RLS policies
 * 
 * @param accessToken - JWT access token from user session
 * @returns Authenticated Supabase client
 */
export function createAuthenticatedClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    );
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * @deprecated Use createAuthenticatedClient instead
 * This function creates an unauthenticated client that will fail RLS checks
 */
export function createClient() {
  throw new Error(
    'createClient() is deprecated. Use createAuthenticatedClient(accessToken) instead. ' +
    'Access token should be retrieved from context.requestContext.get("supabaseAccessToken")'
  );
}

