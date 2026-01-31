import { createClient } from './supabase';
import type { RequestContext } from '@mastra/core/request-context';

/**
 * Verify tenant membership before executing any Supatool
 * Returns user role if authorized, throws error if unauthorized
 */
export async function verifyTenantAccess(
  tenantId: string,
  userId: string
): Promise<{ role: string }> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .single();
    
  if (error || !data) {
    throw new Error('TENANT_ACCESS_DENIED: User is not authorized for this tenant');
  }
  
  return data;
}

/**
 * Extract tenant and user context from requestContext
 * Throws error if context is missing
 */
export function extractAuthContext(context: any): { tenantId: string; userId: string } {
  const requestContext = context?.requestContext || context;
  const tenantId = typeof requestContext?.get === 'function'
    ? requestContext.get('tenantId')
    : (requestContext as any)?.tenantId;
  const userId = typeof requestContext?.get === 'function'
    ? requestContext.get('userId')
    : (requestContext as any)?.userId;
    
  if (!tenantId || !userId) {
    throw new Error('AUTH_CONTEXT_MISSING: tenantId and userId are required in requestContext');
  }
  
  return { tenantId, userId };
}
