

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const getSource = createTool({
  id: 'sources.get',
  description: 'Get a specific source (platform connection) by ID',
  inputSchema: z.object({
    tenantId: z.string().uuid().describe('Tenant ID for authorization'),
    sourceId: z.string().uuid().describe('Source ID to retrieve'),
  }),
  outputSchema: z.object({
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
    const { tenantId, sourceId } = context;

    const { data, error } = await supabase
      .from('sources')
      .select('id, type, name, method, status, created_at')
      .eq('id', sourceId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      throw new Error(`Failed to get source: ${error.message}`);
    }

    if (!data) {
      throw new Error('Source not found or access denied');
    }

    return {
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

