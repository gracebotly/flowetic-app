
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const listSources = createTool({
  id: 'sources.list',
  description: 'List all connected platforms (sources) for the current tenant',
  inputSchema: z.object({
    tenantId: z.string().uuid().describe('Tenant ID to filter sources'),
  }),
  outputSchema: z.object({
    sources: z.array(z.object({
      id: z.string().uuid(),
      type: z.string(),
      name: z.string(),
      method: z.string(),
      status: z.string(),
      createdAt: z.string(),
    })),
  }),
  execute: async ({ context }) => {
    const supabase = await createClient();
    const { tenantId } = context;

    const { data, error } = await supabase
      .from('sources')
      .select('id, type, name, method, status, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list sources: ${error.message}`);
    }

    return {
      sources: (data || []).map((s) => ({
        id: s.id,
        type: s.type,
        name: s.name,
        method: s.method,
        status: s.status || 'active',
        createdAt: s.created_at,
      })),
    };
  },
});
