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
      // ✅ RETURN instead of throw — prevents hallucination crash chain (mastra#9815)
      return {
        success: false,
        message: '[setSchemaReady]: Missing authentication token',
      };
    }

    // 2. Get tenant context
    let tenantId: string;
    try {
      const ctx = extractTenantContext(context);
      tenantId = ctx.tenantId;
    } catch (err: any) {
      return {
        success: false,
        message: `[setSchemaReady]: ${err.message}`,
      };
    }

    // 3. Create authenticated client
    const supabase = createAuthenticatedClient(accessToken);

    const updatePayload = {
      schema_ready: true,
      updated_at: new Date().toISOString(),
    };

    // 4. Update journey_sessions
    // IMPORTANT: advancePhase queries by .eq('id', journeyThreadId)
    // but this tool receives threadId which may be the thread_id column OR the id column.
    // Try thread_id first, then fall back to id to handle both cases.

    // Attempt 1: match by thread_id column
    const res1 = await supabase
      .from('journey_sessions')
      .update(updatePayload)
      .eq('tenant_id', tenantId)
      .eq('thread_id', inputData.threadId)
      .select('id, schema_ready')
      .maybeSingle();

    if (res1.data) {
      console.log(`[setSchemaReady]: Updated journey_sessions schema_ready=true via thread_id for thread ${inputData.threadId}`);
      return {
        success: true,
        message: `Schema marked as ready for thread ${inputData.threadId}`,
      };
    }

    // Attempt 2: match by id column (journeyThreadId is sometimes the session UUID)
    const res2 = await supabase
      .from('journey_sessions')
      .update(updatePayload)
      .eq('tenant_id', tenantId)
      .eq('id', inputData.threadId)
      .select('id, schema_ready')
      .maybeSingle();

    if (res2.data) {
      console.log(`[setSchemaReady]: Updated journey_sessions schema_ready=true via id for ${inputData.threadId}`);
      return {
        success: true,
        message: `Schema marked as ready for session ${inputData.threadId}`,
      };
    }

    // Both attempts failed
    const errorMsg = res2.error?.message || res1.error?.message || 'No matching row found';
    console.error(`[setSchemaReady]: Failed to update. thread_id and id both missed. Error: ${errorMsg}`);

    // ✅ RETURN instead of throw
    return {
      success: false,
      message: `Could not find journey session for "${inputData.threadId}" in tenant ${tenantId}. ${errorMsg}`,
    };
  },
});
