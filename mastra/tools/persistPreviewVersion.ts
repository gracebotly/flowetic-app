import { createTool } from '@mastra/core';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const persistPreviewVersion = createTool({
  id: 'persist-preview-version',
  description: 'Saves dashboard spec as a new interface version in Supabase',
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    userId: z.string().uuid(),
    interfaceId: z.string().uuid().optional(),
    spec: z.record(z.any()),
  }),
  outputSchema: z.object({
    interfaceId: z.string().uuid(),
    versionId: z.string().uuid(),
    previewUrl: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { tenantId, userId, interfaceId, spec } = inputData;
    
    const supabase = createClient();
    
    // Create or get interface
    let finalInterfaceId = interfaceId;
    
    if (!finalInterfaceId) {
      const { data: newInterface, error: interfaceError } = await supabase
        .from('interfaces')
        .insert({
          tenant_id: tenantId,
          name: 'Dashboard',
          status: 'draft',
          component_pack: 'default',
        })
        .select('id')
        .single();
      
      if (interfaceError) {
        throw new Error(`Failed to create interface: ${interfaceError.message}`);
      }
      
      finalInterfaceId = newInterface.id;
    }
    
    // Create interface version
    const { data: version, error: versionError } = await supabase
      .from('interface_versions')
      .insert({
        interface_id: finalInterfaceId,
        spec_json: spec,
        created_by: userId,
      })
      .select('id')
      .single();
    
    if (versionError) {
      throw new Error(`Failed to create version: ${versionError.message}`);
    }
    
    const previewUrl = `/preview/${finalInterfaceId}/${version.id}`;
    
    return {
      interfaceId: finalInterfaceId,
      versionId: version.id,
      previewUrl,
    };
  },
});
