
import { createTool } from '@mastra/core/tools';
import type { RequestContext } from '@mastra/core/request-context';
import { extractAuthContext, verifyTenantAccess } from '../lib/tenant-verification';

/**
 * Base class for Supatools with automatic tenant verification
 * Reduces boilerplate and ensures consistent security
 */
export function createSupaTool<TIn, TOut>(config: {
  id: string;
  description: string;
  inputSchema: any;
  outputSchema: any;
  execute: (input: TIn, context: any) => Promise<TOut>;
}) {
  return createTool({
    ...config,
    execute: async (inputData: any, context: any) => {
      try {
        // Extract and verify auth context
        const { tenantId, userId } = extractAuthContext(context);
        await verifyTenantAccess(tenantId, userId);
        
        // Execute tool logic with verified context
        return await config.execute(inputData, context);
      } catch (error: any) {
        // Re-throw with context for debugging
        if (error.message.startsWith('TENANT_ACCESS_DENIED') || 
            error.message.startsWith('AUTH_CONTEXT_MISSING')) {
          throw error;
        }
        throw new Error(`Supatool execution failed in ${config.id}: ${error.message}`);
      }
    },
  });
}
