import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createAuthenticatedClient } from '../lib/supabase';
import { extractTenantContext } from '../lib/tenant-verification';
import { SourceContextSchema } from '../lib/REQUEST_CONTEXT_CONTRACT';

export const persistPreviewVersion = createTool({
  id: 'persistPreviewVersion',
  description: 'Saves dashboard spec as a new interface version in Supabase',
  requestContextSchema: SourceContextSchema,
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
      // Check for obvious invalid/placeholder values first
      const isPlaceholder =
        finalInterfaceId === 'MISSING' ||
        finalInterfaceId === '00000000-0000-0000-0000-000000000000' ||
        finalInterfaceId === 'undefined' ||
        finalInterfaceId === 'null';

      if (isPlaceholder) {
        console.warn(
          `[persistPreviewVersion] interfaceId is placeholder value "${finalInterfaceId}". Will create new interface.`
        );
        finalInterfaceId = undefined;
      } else {
        // Validate against interfaces table
        const { data: existing, error: lookupError } = await supabase
          .from('interfaces')
          .select('id, tenant_id')
          .eq('id', finalInterfaceId)
          .maybeSingle();

        if (lookupError) {
          console.error(`[persistPreviewVersion] Error looking up interface: ${lookupError.message}`);
          finalInterfaceId = undefined;
        } else if (!existing) {
          console.warn(
            `[persistPreviewVersion] interfaceId "${finalInterfaceId}" not found in interfaces table ` +
            `(may be project.id instead of interface.id). Creating new interface.`
          );
          finalInterfaceId = undefined;
        } else if (existing.tenant_id !== tenantId) {
          console.error(
            `[persistPreviewVersion] interfaceId "${finalInterfaceId}" belongs to different tenant. ` +
            `Expected: ${tenantId}, Got: ${existing.tenant_id}. Creating new interface.`
          );
          finalInterfaceId = undefined;
        } else {
          console.log(`[persistPreviewVersion] Using existing interface: ${finalInterfaceId}`);
        }
      }
    } else {
      console.log(`[persistPreviewVersion] No interfaceId provided, will create new interface.`);
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

    // Use RPC for deduplication - hash computed server-side to match generated column
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('upsert_interface_version', {
        p_interface_id: finalInterfaceId,
        p_spec_json: spec_json,
        p_design_tokens: design_tokens,
        p_created_by: userId,
      })
      .single<{ version_id: string; was_inserted: boolean }>();

    if (rpcError) {
      console.warn('[persistPreviewVersion] RPC failed:', rpcError.message);
    } else if (rpcResult) {
      const previewUrl = `/preview/${finalInterfaceId}/${rpcResult.version_id}`;
      console.log(`[persistPreviewVersion] ${rpcResult.was_inserted ? 'Created' : 'Found'} version: ${rpcResult.version_id}`);
      // BUG 5 FIX: Persist preview linkage + advance journey mode to interactive_edit.
      // Without this, autoAdvancePhase has no rule for build_preview → interactive_edit
      // and the session stays stuck in build_preview forever.
      const journeyThreadId = (context?.requestContext as any)?.get?.('journeyThreadId') as string | undefined;
      if (journeyThreadId && finalInterfaceId) {
        const { error: sessionUpdateErr } = await supabase
          .from('journey_sessions')
          .update({
            preview_interface_id: finalInterfaceId,
            preview_version_id: rpcResult.version_id,
            mode: 'interactive_edit',
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId)
          .eq('thread_id', journeyThreadId);
        if (sessionUpdateErr) {
          console.warn('[persistPreviewVersion] Failed to advance journey to interactive_edit:', sessionUpdateErr.message);
        } else {
          console.log('[persistPreviewVersion] ✅ Journey advanced to interactive_edit, preview linked:', {
            journeyThreadId,
            previewInterfaceId: finalInterfaceId,
            previewVersionId: rpcResult.version_id,
          });
        }
      }
      // BUG 6 FIX: Set active_version_id on the interface record.
      // Without this, interfaces.active_version_id stays null even though a valid
      // version exists. This blocks publish flow and any API checking active_version_id.
      if (finalInterfaceId && rpcResult.version_id) {
        const { error: ifaceUpdateErr } = await supabase
          .from('interfaces')
          .update({
            active_version_id: rpcResult.version_id,
            status: 'draft', // Keep as draft until explicit publish
          })
          .eq('id', finalInterfaceId)
          .eq('tenant_id', tenantId);
        if (ifaceUpdateErr) {
          console.warn('[persistPreviewVersion] Failed to set active_version_id:', ifaceUpdateErr.message);
        } else {
          console.log('[persistPreviewVersion] ✅ Set active_version_id on interface:', {
            interfaceId: finalInterfaceId,
            activeVersionId: rpcResult.version_id,
          });
        }
      }
      // NOTE: Event backfill removed — the auto_link_event_interface trigger
      // (migration 20260215130000) handles interface_id assignment at INSERT time.
      // Verified: 0/67 events have interface_id IS NULL (2025-02-20).
      // BUG 4 FIX: Link orphaned interface_schemas rows to this interface.
      // analyzeSchema backfills schema_summary but doesn't know the interfaceId yet.
      // Now that we have a definitive interfaceId, set it on any matching schema rows.
      const sourceId = (context?.requestContext as any)?.get?.('sourceId') as string | undefined;
      if (finalInterfaceId && sourceId) {
        const { error: schemaLinkErr, count: schemaLinkCount } = await supabase
          .from('interface_schemas')
          .update({
            interface_id: finalInterfaceId,
            updated_at: new Date().toISOString(),
          })
          .eq('source_id', sourceId)
          .eq('tenant_id', tenantId)
          .is('interface_id', null);
        if (schemaLinkErr) {
          console.warn('[persistPreviewVersion] Failed to link interface_schemas:', schemaLinkErr.message);
        } else if (schemaLinkCount && schemaLinkCount > 0) {
          console.log('[persistPreviewVersion] ✅ Linked interface_schemas to interface:', {
            interfaceId: finalInterfaceId,
            sourceId,
            rowsLinked: schemaLinkCount,
          });
        }
      }

      return {
        interfaceId: finalInterfaceId,
        versionId: rpcResult.version_id,
        previewUrl,
      };
    }

    // Fallback if RPC unavailable
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

    // BUG 5 FIX: Persist preview linkage + advance journey mode (fallback INSERT path).
    const journeyThreadIdFallback = (context?.requestContext as any)?.get?.('journeyThreadId') as string | undefined;
    if (journeyThreadIdFallback && finalInterfaceId) {
      const { error: sessionUpdateErr } = await supabase
        .from('journey_sessions')
        .update({
          preview_interface_id: finalInterfaceId,
          preview_version_id: version.id,
          mode: 'interactive_edit',
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('thread_id', journeyThreadIdFallback);
      if (sessionUpdateErr) {
        console.warn('[persistPreviewVersion] Failed to advance journey to interactive_edit (fallback):', sessionUpdateErr.message);
      } else {
        console.log('[persistPreviewVersion] ✅ Journey advanced to interactive_edit (fallback), preview linked:', {
          journeyThreadId: journeyThreadIdFallback,
          previewInterfaceId: finalInterfaceId,
          previewVersionId: version.id,
        });
      }
    }

    // BUG 6 FIX (fallback path): Set active_version_id on the interface record.
    if (finalInterfaceId && version?.id) {
      const { error: ifaceUpdateErr } = await supabase
        .from('interfaces')
        .update({
          active_version_id: version.id,
          status: 'draft',
        })
        .eq('id', finalInterfaceId)
        .eq('tenant_id', tenantId);
      if (ifaceUpdateErr) {
        console.warn('[persistPreviewVersion] Failed to set active_version_id (fallback):', ifaceUpdateErr.message);
      } else {
        console.log('[persistPreviewVersion] ✅ Set active_version_id on interface (fallback):', {
          interfaceId: finalInterfaceId,
          activeVersionId: version.id,
        });
      }
    }

    // NOTE: Event backfill removed — handled by auto_link_event_interface trigger.

    // BUG 4 FIX: Link orphaned interface_schemas rows to this interface.
    // analyzeSchema backfills schema_summary but doesn't know the interfaceId yet.
    // Now that we have a definitive interfaceId, set it on any matching schema rows.
    const sourceId = (context?.requestContext as any)?.get?.('sourceId') as string | undefined;
    if (finalInterfaceId && sourceId) {
      const { error: schemaLinkErr, count: schemaLinkCount } = await supabase
        .from('interface_schemas')
        .update({
          interface_id: finalInterfaceId,
          updated_at: new Date().toISOString(),
        })
        .eq('source_id', sourceId)
        .eq('tenant_id', tenantId)
        .is('interface_id', null);
      if (schemaLinkErr) {
        console.warn('[persistPreviewVersion] Failed to link interface_schemas:', schemaLinkErr.message);
      } else if (schemaLinkCount && schemaLinkCount > 0) {
        console.log('[persistPreviewVersion] ✅ Linked interface_schemas to interface:', {
          interfaceId: finalInterfaceId,
          sourceId,
          rowsLinked: schemaLinkCount,
        });
      }
    }

    return {
      interfaceId: finalInterfaceId,
      versionId: version.id,
      previewUrl,
    };
  },
});
