

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const listProjects = createTool({
  id: 'projects.list',
  description: 'List all projects for the current tenant with optional filters',
  inputSchema: z.object({
    tenantId: z.string().uuid().describe('Tenant ID to filter projects'),
    status: z.enum(['draft', 'live']).optional().describe('Filter by project status (draft or live)'),
    type: z.enum(['analytics', 'tool', 'form']).optional().describe('Filter by project type (analytics, tool, or form)'),
  }),
  outputSchema: z.object({
    projects: z.array(z.object({
      id: z.string().uuid(),
      name: z.string(),
      type: z.string(),
      status: z.string(),
      description: z.string().nullable(),
      publicEnabled: z.boolean(),
      createdAt: z.string(),
      updatedAt: z.string(),
    })),
  }),
  execute: async ({ context }) => {
    const supabase = await createClient();
    const { tenantId, status, type } = context;

    let query = supabase
      .from('projects')
      .select('id, name, type, status, description, public_enabled, created_at, updated_at')
      .eq('tenant_id', tenantId);

    // Apply optional filters
    if (status) {
      query = query.eq('status', status);
    }
    if (type) {
      query = query.eq('type', type);
    }

    // Order by updated_at desc (most recent first)
    query = query.order('updated_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list projects: ${error.message}`);
    }

    return {
      projects: (data || []).map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        status: p.status,
        description: p.description,
        publicEnabled: p.public_enabled,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })),
    };
  },
});

