import { createTool } from '@mastra/core/tools';
import { extractTenantContext, verifyTenantAccess } from '../lib/tenant-verification';

export function createSupaTool<TOut>(config: {
  id: string;
  description: string;
  inputSchema: any;
  outputSchema?: any;
  execute: (input: any, supabase: any, context: any) => Promise<TOut>;
}) {
  return createTool({
    id: config.id,
    description: config.description,
    inputSchema: config.inputSchema,
    outputSchema: config.outputSchema,
    execute: async (inputData, context) => {
      // Get access token with type assertion
      const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
      if (!accessToken || typeof accessToken !== 'string') {
        throw new Error(`[${config.id}]: Missing authentication token`);
      }

      // Get tenant context
      const { tenantId } = extractTenantContext(context);

      // Create authenticated client
      const { createAuthenticatedClient } = await import('../lib/supabase');
      const supabase = createAuthenticatedClient(accessToken);

      // Execute the tool's logic
      return await config.execute(inputData, supabase, context);
    },
  });
}
