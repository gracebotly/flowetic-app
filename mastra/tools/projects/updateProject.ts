




import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const updateProject = createTool({
  id: 'projects.update',
  description: 'Update a project (name, status, description, public_enabled). For creating or deleting projects, use the API routes.',
  inputSchema: z.object({
    tenantId: z.string().uuid().describe('Tenant ID for authorization'),
    projectId: z.string().uuid().describe('Project ID to update'),
    name: z.string().optional().describe('New name for the project'),
    status: z.enum(['draft', 'live']).optional().describe('New status for the project (draft or live)'),
    description: z.string().nullable().optional().describe('New description for the project'),
    publicEnabled: z.boolean().optional().describe('Whether the project is publicly accessible'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
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
    const { tenantId, projectId, name, status, description, publicEnabled } = context;

    // Build update object with only provided fields
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (status !== undefined) updates.status = status;
    if (description !== undefined) updates.description = description;
    if (publicEnabled !== undefined) updates.public_enabled = publicEnabled;

    if (Object.keys(updates).length === 0) {
      throw new Error('No fields to update provided');
    }

    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .eq('tenant_id', tenantId)
      .select('id, name, type, status, description, public_enabled, created_at, updated_at')
      .single();

    if (error) {
      throw new Error(`Failed to update project: ${error.message}`);
    }

    if (!data) {
      throw new Error('Project not found or access denied');
    }

    return {
      success: true,
      message: 'Project updated successfully',
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




