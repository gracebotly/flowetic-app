import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from "@supabase/ssr";

export async function createClient() {
  // Check if we're in Next.js server context (has cookies available)
  const isNextJsServer = typeof process !== 'undefined' && process.env.NEXT_RUNTIME;
  
  if (isNextJsServer) {
    // Next.js server context - use cookies
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
