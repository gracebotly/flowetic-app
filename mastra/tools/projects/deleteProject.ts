








import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createAuthenticatedClient } from '../../lib/supabase';
import { extractTenantContext } from '../../lib/tenant-verification';

export const deleteProject = createTool({
  id: 'deleteProject',
  description: 'Deletes a project by ID. Only accessible by authenticated users within their tenant.',
  inputSchema: z.object({
    projectId: z.string().uuid().describe('The UUID of the project to delete'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    projectId: z.string(),
  }),
  execute: async (inputData, context) => {
    // 1. Get access token from context
    const accessToken = context?.requestContext?.get('supabaseAccessToken');
    if (!accessToken) {
      throw new Error(
        '[deleteProject]: Missing authentication token. ' +
        'Ensure the API route passes supabaseAccessToken in RequestContext.'
      );
    }

    // 2. Get tenant context
    const { tenantId } = extractTenantContext(context);

    // 3. Create authenticated client (RLS enforced automatically)
    const supabase = createAuthenticatedClient(accessToken);

    // 4. Delete with RLS enforcement
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', inputData.projectId)
      .eq('tenant_id', tenantId); // Extra safety beyond RLS

    if (error) {
      throw new Error(`Failed to delete project: ${error.message}`);
    }

    return { 
      success: true, 
      projectId: inputData.projectId 
    };
  },
});















