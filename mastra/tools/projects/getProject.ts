



import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const getProject = createTool({
  id: 'projects.get',
  description: 'Get a specific project by ID',
  inputSchema: z.object({
    tenantId: z.string().uuid().describe('Tenant ID for authorization'),
    projectId: z.string().uuid().describe('Project ID to retrieve'),
  }),
  outputSchema: z.object({
    project: z.object({
      id: z.string().uuid(),
      name: z.string(),
      type: z.string(),
      status: z.string(),
      description: z.string().nullable(),
      publicEnabled: z.boolean(),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  }),
  execute: async ({ context }) => {
    const supabase = await createClient();
    const { tenantId, projectId } = context;

    const { data, error } = await supabase
      .from('projects')
      .select('id, name, type, status, description, public_enabled, created_at, updated_at')
      .eq('id', projectId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      throw new Error(`Failed to get project: ${error.message}`);
    }

    if (!data) {
      throw new Error('Project not found or access denied');
    }

    return {
      project: {
        id: data.id,
        name: data.name,
        type: data.type,
        status: data.status,
        description: data.description,
        publicEnabled: data.public_enabled,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    };
  },
});



