import type { SupabaseClient } from '@supabase/supabase-js';

interface TenantContext {
  tenantId: string;
  userId: string;
}

/**
 * Extracts tenant context from RequestContext
 * Throws error if context is missing
 */
export function extractTenantContext(context: any): TenantContext {
  const tenantId = context?.requestContext?.get('tenantId');
  const userId = context?.requestContext?.get('userId');

  if (!tenantId || !userId) {
    throw new Error(
      'Missing tenant context. Ensure tenantId and userId are set in RequestContext. ' +
      'This usually means the API route did not pass authentication context to the tool.'
    );
  }

  return { tenantId, userId };
}

/**
 * Verifies that the authenticated user has access to the specified tenant
 * Optional extra security check beyond RLS
 */
export async function verifyTenantAccess(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string
): Promise<void> {
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .eq('id', tenantId)
    .single();

  if (error || !data) {
    throw new Error(
      `TENANT_ACCESS_DENIED: User ${userId} cannot access tenant ${tenantId}. ` +
      `Error: ${error?.message || 'Tenant not found'}`
    );
  }
}
