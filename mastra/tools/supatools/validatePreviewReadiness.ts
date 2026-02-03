


import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createAuthenticatedClient } from '../../lib/supabase';
import { extractTenantContext } from '../../lib/tenant-verification';

export const validatePreviewReadiness = createTool({
  id: 'validatePreviewReadiness',
  description: 'Validates if a preview interface is ready for deployment by checking all associated journey schemas',
  inputSchema: z.object({
    interfaceId: z.string().uuid().describe('The interface ID to validate'),
  }),
  outputSchema: z.object({
    ready: z.boolean(),
    interfaceId: z.string(),
    schemasCount: z.number(),
    readySchemasCount: z.number(),
  }),
  execute: async (inputData, context) => {
    // 1. Get access token
    const accessToken = context?.requestContext?.get('supabaseAccessToken');
    if (!accessToken) {
      throw new Error('[validatePreviewReadiness]: Missing authentication token');
    }

    // 2. Get tenant context
    const { tenantId } = extractTenantContext(context);

    // 3. Create authenticated client
    const supabase = createAuthenticatedClient(accessToken);

    // 4. Get interface with RLS enforcement
    const { data: interface_, error: interfaceError } = await supabase
      .from('interfaces')
      .select('id, journey_id')
      .eq('id', inputData.interfaceId)
      .eq('tenant_id', tenantId)
      .single();

    if (interfaceError || !interface_) {
      throw new Error(
        `Interface not found or access denied: ${interfaceError?.message || 'Not found'}`
      );
    }

    // 5. Check all schemas for this journey with RLS enforcement
    const { data: schemas, error: schemasError } = await supabase
      .from('journey_schemas')
      .select('id, ready')
      .eq('journey_id', interface_.journey_id)
      .eq('tenant_id', tenantId);

    if (schemasError) {
      throw new Error(`Failed to check schemas: ${schemasError.message}`);
    }

    const schemasCount = schemas?.length ?? 0;
    const readySchemasCount = schemas?.filter(s => s.ready).length ?? 0;
    const allReady = schemasCount > 0 && schemasCount === readySchemasCount;

    return {
      ready: allReady,
      interfaceId: inputData.interfaceId,
      schemasCount,
      readySchemasCount,
    };
  },
});


