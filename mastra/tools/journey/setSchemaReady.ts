import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createAuthenticatedClient } from '../../lib/supabase';
import { extractTenantContext } from '../../lib/tenant-verification';

export const setSchemaReady = createTool({
  id: 'setSchemaReady',
  description: 'Marks a journey session schema as ready for preview generation. Updates the schema_ready flag in journey_sessions.',
  inputSchema: z.object({
    threadId: z.string().min(1).describe('The thread ID of the journey session'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async (inputData, context) => {
    // 1. Get access token
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken) {
      throw new Error('[setSchemaReady]: Missing authentication token');
    }

    // 2. Get tenant context
    const { tenantId } = extractTenantContext(context);

    // 3. Create authenticated client
    const supabase = createAuthenticatedClient(accessToken);

    // 4. Update journey_sessions (the actual table with schema_ready column)
    const { data, error } = await supabase
      .from('journey_sessions')
      .update({
        schema_ready: true,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('thread_id', inputData.threadId)
      .select('id, schema_ready')
      .single();

    if (error) {
      throw new Error(`[setSchemaReady]: Failed to update journey session: ${error.message}`);
    }

    if (!data) {
      throw new Error(`[setSchemaReady]: No journey session found for thread ${inputData.threadId} in tenant ${tenantId}`);
    }

    console.log(`[setSchemaReady]: Updated journey_sessions schema_ready=true for thread ${inputData.threadId}`);

    return {
      success: true,
      message: `Schema marked as ready for thread ${inputData.threadId}`,
    };
  },
});
