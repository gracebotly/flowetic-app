




import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createAuthenticatedClient } from '../../lib/supabase';
import { extractTenantContext, verifyTenantAccess } from '../../lib/tenant-verification';

export const setSchemaReady = createTool({
  id: 'setSchemaReady',
  description: 'Marks a journey schema as ready for use',
  inputSchema: z.object({
    journeyId: z.string().uuid().describe('The journey schema ID to mark as ready'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    journey: z.object({
      id: z.string(),
      ready: z.boolean(),
      updated_at: z.string(),
    }),
  }),
  execute: async (inputData, context) => {
    // 1. Get access token
    const accessToken = context?.requestContext?.get('supabaseAccessToken');
    if (!accessToken) {
      throw new Error('[setSchemaReady]: Missing authentication token');
    }

    // 2. Get tenant context
    const { tenantId, userId } = extractTenantContext(context);

    // 3. Create authenticated client
    const supabase = createAuthenticatedClient(accessToken);

    // 4. Optional: Verify tenant access (extra security layer)
    await verifyTenantAccess(supabase, tenantId, userId);

    // 5. Update with RLS enforcement
    const { data, error } = await supabase
      .from('journey_schemas')
      .update({ 
        ready: true, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', inputData.journeyId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update schema: ${error.message}`);
    }

    return { 
      success: true, 
      journey: data 
    };
  },
});




