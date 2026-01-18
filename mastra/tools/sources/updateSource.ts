


import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const updateSource = createTool({
  id: 'sources.update',
  description: 'Update a source (platform connection) - name or status only. For credential changes, use the API routes.',
  inputSchema: z.object({
    tenantId: z.string().uuid().describe('Tenant ID for authorization'),
    sourceId: z.string().uuid().describe('Source ID to update'),
    name: z.string().optional().describe('New name for the source'),
    status: z.enum(['active', 'inactive', 'error']).optional().describe('New status for the source'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    source: z.object({
      id: z.string().uuid(),
      type: z.string(),
      name: z.string(),
      method: z.string(),
      status: z.string(),
      createdAt: z.string(),
    }),
  }),
  execute: async ({ context }) => {
    const supabase = await createClient();
    const { tenantId, sourceId, name, status } = context;

    // Build update object with only provided fields
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) {
      throw new Error('No fields to update provided');
    }

    const { data, error } = await supabase
      .from('sources')
      .update(updates)
      .eq('id', sourceId)
      .eq('tenant_id', tenantId)
      .select('id, type, name, method, status, created_at')
      .single();

    if (error) {
      throw new Error(`Failed to update source: ${error.message}`);
    }

    if (!data) {
      throw new Error('Source not found or access denied');
    }

    return {
      success: true,
      message: 'Source updated successfully',
      source: {
        id: data.id,
        type: data.type,
        name: data.name,
        method: data.method,
        status: data.status || 'active',
        createdAt: data.created_at,
      },
    };
  },
});


