import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createAuthenticatedClient } from '../lib/supabase';
import { extractTenantContext } from '../lib/tenant-verification';

export const persistPreviewVersion = createTool({
  id: 'persist-preview-version',
  description: 'Saves dashboard spec as a new interface version in Supabase',
  inputSchema: z.object({
    interfaceId: z.string().uuid().optional(),
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()),
    platformType: z.string(),
  }),
  outputSchema: z.object({
    interfaceId: z.string().uuid(),
    versionId: z.string().uuid(),
    previewUrl: z.string(),
  }),
  execute: async (inputData, context) => {
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[persistPreviewVersion]: Missing authentication');
    }
    const { tenantId, userId } = extractTenantContext(context);
    const supabase = createAuthenticatedClient(accessToken);

    const { interfaceId, spec_json, design_tokens, platformType } = inputData;

    // Resolve or create interface
    let finalInterfaceId: string | undefined = interfaceId;

    // CRITICAL: Validate that interfaceId exists in the interfaces table
    // The agent sometimes passes a project.id which is NOT a valid interface_id
    if (finalInterfaceId) {
      const { data: existing, error: lookupError } = await supabase
        .from('interfaces')
        .select('id')
        .eq('id', finalInterfaceId)
        .maybeSingle();

      if (lookupError || !existing) {
        console.warn(
          `[persistPreviewVersion] interfaceId "${finalInterfaceId}" not found in interfaces table. Creating new interface.`
        );
        finalInterfaceId = undefined; // Force creation of new interface
      }
    }

    if (!finalInterfaceId) {
      const { data: newInterface, error: interfaceError } = await supabase
        .from('interfaces')
        .insert({
          tenant_id: tenantId,
          name: `${platformType} Dashboard`,
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
    // NOTE: created_by may fail FK if user not in public.users table
    // First try with userId, if FK fails, retry without created_by
    let version: { id: string } | null = null;
    let versionError: any = null;

    // Attempt 1: With created_by
    const { data: v1, error: e1 } = await supabase
      .from('interface_versions')
      .insert({
        interface_id: finalInterfaceId,
        spec_json,
        design_tokens,
        created_by: userId,
      })
      .select('id')
      .single();

    if (e1) {
      // Check if it's a FK constraint error on created_by
      const isFkError = e1.message?.includes('created_by_fkey') ||
                        e1.message?.includes('foreign key constraint');

      if (isFkError) {
        console.warn(`[persistPreviewVersion] FK error on created_by, retrying without it. userId: ${userId}`);

        // Attempt 2: Without created_by (let it be NULL)
        const { data: v2, error: e2 } = await supabase
          .from('interface_versions')
          .insert({
            interface_id: finalInterfaceId,
            spec_json,
            design_tokens,
            // created_by omitted - will be NULL
          })
          .select('id')
          .single();

        version = v2;
        versionError = e2;
      } else {
        versionError = e1;
      }
    } else {
      version = v1;
    }

    if (versionError) {
      throw new Error(`Failed to create version: ${versionError.message}`);
    }

    if (!version) {
      throw new Error('Failed to create interface version: version data is null');
    }

    if (!finalInterfaceId) {
      throw new Error('Failed to create or retrieve interface ID');
    }

    const previewUrl = `/preview/${finalInterfaceId}/${version.id}`;

    return {
      interfaceId: finalInterfaceId,
      versionId: version.id,
      previewUrl,
    };
  },
});
