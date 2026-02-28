// mastra/tools/analyzeSchema.ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createAuthenticatedClient } from '../lib/supabase';
import { extractTenantContext } from '../lib/tenant-verification';
import { getExpectedFieldsForPlatform } from '../normalizers';
import { AuthenticatedContextSchema } from '../lib/REQUEST_CONTEXT_CONTRACT';
import { detectFieldGroups } from '../lib/layout/fieldGroupDetector';

export const analyzeSchema = createTool({
  id: 'analyzeSchema',
  description: 'Analyzes event schema from a data source to detect field types and patterns. Inspects both labels and state columns.',
  requestContextSchema: AuthenticatedContextSchema,
  inputSchema: z.object({
    sourceId: z.string().uuid().optional(),
    workflowName: z.string().optional().describe(
      'Filter events to a specific workflow name. Used when a source contains executions from multiple workflows.'
    ),
    sampleSize: z.number().default(100),
  }),
  outputSchema: z.object({
    fields: z.array(z.object({
      name: z.string(),
      type: z.enum(['string', 'number', 'boolean', 'date', 'object', 'array']),
      sample: z.any(),
      nullable: z.boolean(),
      uniqueValues: z.number(),
      totalRows: z.number(),
      avgLength: z.number().optional(),
    })),
    fieldGroupMeta: z.array(z.object({
      prefix: z.string(),
      fieldCount: z.number(),
      avgNullRate: z.number(),
      correlatedStatus: z.string().optional(),
      fields: z.array(z.string()),
    })).optional().describe('Field groups detected from dot-notation prefixes'),
    eventTypes: z.array(z.string()),
    totalEvents: z.number(),
    confidence: z.number().min(0).max(1),
  }),
  execute: async (inputData, context) => {
    const { sourceId, workflowName, sampleSize } = inputData;

    // Get access token and tenant context
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[analyzeSchema]: Missing authentication token');
    }
    const { tenantId } = extractTenantContext(context);
    const supabase = createAuthenticatedClient(accessToken);

    // Fetch sample events
    let query = supabase
      .from('events')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(sampleSize ?? 50);

    if (sourceId) query = query.eq('source_id', sourceId);

    // ✅ FIX: Scope to workflow when provided — prevents cross-workflow data contamination
    // Events may store workflow_name as display name while workflow_id stores external id.
    // Match both workflow_name and workflow_id for robust scoping.
    const selectedWorkflowName = workflowName || ((context.requestContext as any)?.get('selectedWorkflowName') as string | undefined);
    if (selectedWorkflowName) {
      query = query.or(
        `state->>workflow_name.eq.${selectedWorkflowName},state->>workflow_id.eq.${selectedWorkflowName}`
      );
      console.log(`[analyzeSchema] Scoping to workflow (dual-match): "${selectedWorkflowName}"`);
    }

    const { data: events, error } = await query;

    if (error || !events || events.length === 0) {
      throw new Error('NO_EVENTS_AVAILABLE');
    }

    // Analyze schema from events
    const fieldMap = new Map<string, { type: string; samples: unknown[]; nullCount: number; totalRows: number; arrayItemType?: string }>();
    const eventTypes = new Set<string>();

    // Detect platform from first event's state or labels
    let detectedPlatform: string | undefined;

    events.forEach((event, eventCount) => {
      eventTypes.add(event.type);

      // ── 1. Analyze labels fields (existing behavior) ──
      const labels = event.labels || {};
      if (typeof labels === 'object' && labels !== null) {
        Object.entries(labels).forEach(([key, value]) => {
          if (!fieldMap.has(key)) {
            fieldMap.set(key, { type: typeof value, samples: [], nullCount: 0, totalRows: 0 });
          }
          const field = fieldMap.get(key)!;
          field.totalRows++;
          if (value === null || value === undefined || value === '') {
            field.nullCount++;
          } else {
            field.samples.push(value);
          }
        });
      }

      // ── 2. Analyze state fields (NEW — where normalizers put structured data) ──
      const state = event.state;
      if (state && typeof state === 'object' && !Array.isArray(state)) {
        // Detect platform for expectedFields lookup
        if (!detectedPlatform && typeof (state as Record<string, unknown>).platform === 'string') {
          detectedPlatform = (state as Record<string, unknown>).platform as string;
        }

        Object.entries(state as Record<string, unknown>).forEach(([key, value]) => {
          // Use unprefixed key names so generateMapping finds "workflow_id" not "state.workflow_id"
          if (!fieldMap.has(key)) {
            fieldMap.set(key, { type: typeof value, samples: [], nullCount: 0, totalRows: 0 });
          }
          const field = fieldMap.get(key)!;
          field.totalRows++;
          if (value === null || value === undefined || value === '') {
            field.nullCount++;
          } else {
            field.samples.push(value);
          }

          // Flatten one level of nested objects (e.g., state.body.user_name, state.research.summary)
          // This exposes webhook input fields and structured output data as individual mappable fields
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.entries(value as Record<string, unknown>).forEach(([nestedKey, nestedValue]) => {
              const flatKey = `${key}.${nestedKey}`;
              if (!fieldMap.has(flatKey)) {
                fieldMap.set(flatKey, { type: typeof nestedValue, samples: [], nullCount: 0, totalRows: 0 });
              }
              const nestedField = fieldMap.get(flatKey)!;
              nestedField.totalRows++;
              if (nestedValue === null || nestedValue === undefined || nestedValue === '') {
                nestedField.nullCount++;
              } else {
                nestedField.samples.push(nestedValue);
              }
            });
          }


          // Handle array fields
          if (Array.isArray(value) && value.length > 0) {
            const flatKey = `${key}`;
            if (!fieldMap.has(flatKey)) {
              fieldMap.set(flatKey, { type: 'array', samples: [], nullCount: 0, totalRows: 0 });
            }
            const entry = fieldMap.get(flatKey)!;
            // Store first item type for downstream classification
            const firstItem = value[0];
            if (!entry.arrayItemType) {
              entry.arrayItemType = typeof firstItem === 'object' ? 'object' : typeof firstItem;
            }
            if (entry.samples.length < 5) {
              entry.samples.push(value);
            }
          }
        });
      }

      // Debug: Log which state fields were extracted
      if (state && typeof state === 'object') {
        const stateKeys = Object.keys(state as Record<string, unknown>);
        if (stateKeys.length > 0 && eventCount < 3) { // Only log first 3 events
          console.log(`[analyzeSchema] Extracted ${stateKeys.length} fields from state JSONB:`, stateKeys.slice(0, 10));
        }
      }

      // ── 3. Standard columns (existing behavior) ──
      if (event.value !== null && event.value !== undefined) {
        if (!fieldMap.has('value')) {
          fieldMap.set('value', { type: 'number', samples: [], nullCount: 0, totalRows: 0 });
        }
        const valueField = fieldMap.get('value')!;
        valueField.totalRows++;
        valueField.samples.push(event.value);
      }

      if (event.text) {
        if (!fieldMap.has('text')) {
          fieldMap.set('text', { type: 'string', samples: [], nullCount: 0, totalRows: 0 });
        }
        const textField = fieldMap.get('text')!;
        textField.totalRows++;
        textField.samples.push(event.text);
      }
    });

    // Convert to output format with cardinality metadata for skill-driven mapping
    const totalRows = events.length;
    const fields = Array.from(fieldMap.entries()).map(([name, data]) => {
      const uniqueSet = new Set(data.samples.map((s: unknown) => String(s)));
      const avgLength = data.type === 'string' && data.samples.length > 0
        ? data.samples.reduce((sum: number, s: unknown) => sum + String(s).length, 0) / data.samples.length
        : undefined;
      return {
        name,
        type: data.type as 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array',
        sample: data.samples[0],
        nullable: data.nullCount > 0,
        uniqueValues: uniqueSet.size,
        totalRows: data.totalRows || totalRows,
        ...(avgLength !== undefined ? { avgLength } : {}),
      };
    });

    // ── Confidence scoring ──
    // Base confidence from sample size
    let confidence = events.length >= 10 ? 0.9 : 0.6;

    // Boost confidence if expected platform fields are present
    if (detectedPlatform) {
      const expectedFields = getExpectedFieldsForPlatform(detectedPlatform);
      const foundFieldNames = new Set(fields.map(f => f.name));
      const matchedCount = expectedFields.filter(f => foundFieldNames.has(f)).length;
      const matchRatio = expectedFields.length > 0 ? matchedCount / expectedFields.length : 0;

      // If most expected fields are present, boost confidence
      if (matchRatio >= 0.8) {
        confidence = Math.min(1.0, confidence + 0.05);
      } else if (matchRatio < 0.5) {
        // If fewer than half the expected fields are present, reduce confidence
        confidence = Math.max(0.3, confidence - 0.2);
      }
    }

    // Compute field groups from the analyzed fields
    const fieldInputsForGrouping = Array.from(fieldMap.entries()).map(([name, info]) => ({
      name,
      nullCount: info.nullCount ?? 0,
      totalRows: info.totalRows ?? events.length,
    }));

    const fieldGroups = detectFieldGroups(fieldInputsForGrouping, events as Array<Record<string, unknown>>);

    const fieldGroupMeta = fieldGroups.map(g => ({
      prefix: g.prefix,
      fieldCount: g.fields.length,
      avgNullRate: g.avgNullRate,
      correlatedStatus: g.correlatedStatus,
      fields: g.fields,
    }));

    const result = {
      fields,
      fieldGroupMeta,
      eventTypes: Array.from(eventTypes),
      totalEvents: events.length,
      confidence,
    };

    // ── Backfill interface_schemas with analysis results ──────────────────
    // The interface_schemas table often has empty event_types, fields, and
    // sample_events because data ingested via webhook/API bypasses the
    // backfill workflow. Write the analysis results back so the spec
    // generator and preview page have data context.
    try {
      const { data: schemaRow } = await supabase
        .from('interface_schemas')
        .select('id')
        .eq('source_id', sourceId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (schemaRow?.id) {
        const sampleEvents = events.slice(0, 5).map((evt: Record<string, unknown>) => ({
          id: evt.id,
          type: evt.type,
          name: evt.name,
          status: evt.status,
          timestamp: evt.timestamp || evt.created_at,
        }));

        // BUG 4 FIX: Also set interface_id if available from context
        // (covers re-generation on existing dashboards where interface already exists)
        const contextInterfaceId = (context?.requestContext as any)?.get?.('interfaceId') as string | undefined;

        const { error: updateErr } = await supabase
          .from('interface_schemas')
          .update({
            ...(contextInterfaceId ? { interface_id: contextInterfaceId } : {}),
            event_types: result.eventTypes,
            schema_summary: {
              fields: result.fields,
              eventTypes: result.eventTypes,
              eventCounts: { total: events.length },
              totalEvents: result.totalEvents,
              confidence: result.confidence,
            },
            sample_events: sampleEvents,
            updated_at: new Date().toISOString(),
          })
          .eq('id', schemaRow.id)
          .eq('tenant_id', tenantId);

        if (updateErr) {
          console.warn('[analyzeSchema] Failed to backfill interface_schemas:', updateErr.message);
        } else {
          console.log('[analyzeSchema] ✅ Backfilled interface_schemas:', {
            schemaId: schemaRow.id,
            eventTypes: result.eventTypes.length,
            fields: result.fields.length,
            sampleEvents: sampleEvents.length,
          });
        }
      }
    } catch (backfillErr) {
      // Non-fatal: analysis results are still returned to the workflow
      console.warn('[analyzeSchema] Non-fatal backfill error:', backfillErr);
    }

    return result;
  },
});
