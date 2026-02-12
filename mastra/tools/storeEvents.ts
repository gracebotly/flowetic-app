import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from "../lib/supabase";
import { extractTenantContext } from "../lib/tenant-verification";

export const storeEvents = createTool({
  id: "storeEvents",
  description:
    "Bulk insert normalized events into Supabase events table. Uses RPC for proper deduplication with partial unique index.",
  inputSchema: z.object({
    events: z.array(z.record(z.any())),
    sourceId: z.string().min(1),
  }),
  outputSchema: z.object({
    stored: z.number().int(),
    skipped: z.number().int(),
    errors: z.array(z.string()),
    status: z.enum(["success", "partial", "failed"]).optional(),
  }),
  execute: async (inputData, context) => {
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      // Return graceful failure instead of throwing
      console.error('[storeEvents]: Missing authentication');
      return { 
        stored: 0, 
        skipped: inputData.events?.length || 0, 
        errors: ['Missing authentication'],
        status: 'failed' as const,
      };
    }
    
    const { tenantId } = extractTenantContext(context);
    const supabase = createAuthenticatedClient(accessToken);
    const rows = inputData.events ?? [];

    if (!rows.length) {
      return { stored: 0, skipped: 0, errors: [], status: 'success' as const };
    }

    // Ensure all rows have tenant_id set
    const enrichedRows = rows.map((r: Record<string, unknown>) => ({
      ...r,
      tenant_id: r.tenant_id || tenantId,
    }));

    try {
      // Use RPC for proper upsert with partial unique index support
      // Pass as JSONB directly - don't stringify, Supabase client handles conversion
      const { data, error } = await supabase.rpc('upsert_events', {
        p_events: enrichedRows,
      });

      if (error) {
        // Check if RPC doesn't exist yet (migration not applied)
        if (error.message?.includes('function') && error.message?.includes('does not exist')) {
          console.warn('[storeEvents] upsert_events RPC not found, falling back to plain insert');
          return await fallbackInsert(supabase, enrichedRows);
        }
        
        console.error('[storeEvents] RPC error:', error.code, error.message);
        // Return graceful failure with data preserved
        return {
          stored: 0,
          skipped: rows.length,
          errors: [error.message],
          status: 'failed' as const,
        };
      }

      const results = data as Array<{ id: string; is_new: boolean }> | null;
      const stored = results?.filter(r => r.is_new).length ?? 0;
      const updated = results?.filter(r => !r.is_new).length ?? 0;
      const skipped = rows.length - (stored + updated);

      console.log(`[storeEvents] Stored ${stored} new, updated ${updated}, skipped ${skipped}`);

      return { 
        stored: stored + updated, 
        skipped, 
        errors: [],
        status: 'success' as const,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[storeEvents] Unexpected error:', errorMessage);
      
      // NEVER throw - return graceful failure so workflow can continue
      return {
        stored: 0,
        skipped: rows.length,
        errors: [errorMessage],
        status: 'failed' as const,
      };
    }
  },
});

// Fallback for when RPC doesn't exist yet
async function fallbackInsert(
  supabase: ReturnType<typeof createAuthenticatedClient>,
  rows: Record<string, unknown>[]
): Promise<{ stored: number; skipped: number; errors: string[]; status: 'success' | 'partial' | 'failed' }> {
  try {
    // Strip platform_event_id to avoid constraint issues
    const cleanRows = rows.map((r) => {
      const { platform_event_id, ...rest } = r;
      return rest;
    });

    const { data, error } = await supabase
      .from("events")
      .insert(cleanRows)
      .select("id");

    if (error) {
      console.error('[storeEvents:fallback] Insert error:', error.message);
      return {
        stored: 0,
        skipped: rows.length,
        errors: [error.message],
        status: 'failed' as const,
      };
    }

    const stored = data?.length ?? 0;
    console.log(`[storeEvents:fallback] Inserted ${stored} events`);
    
    return {
      stored,
      skipped: rows.length - stored,
      errors: [],
      status: 'success' as const,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      stored: 0,
      skipped: rows.length,
      errors: [errorMessage],
      status: 'failed' as const,
    };
  }
}
