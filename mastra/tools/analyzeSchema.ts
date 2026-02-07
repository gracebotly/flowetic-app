// mastra/tools/analyzeSchema.ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createAuthenticatedClient } from '../lib/supabase';
import { extractTenantContext } from '../lib/tenant-verification';
import { getExpectedFieldsForPlatform } from '../normalizers';

export const analyzeSchema = createTool({
  id: 'analyze-schema',
  description: 'Analyzes event schema from a data source to detect field types and patterns. Inspects both labels and state columns.',
  inputSchema: z.object({
    sourceId: z.string().uuid(),
    sampleSize: z.number().default(100),
  }),
  outputSchema: z.object({
    fields: z.array(z.object({
      name: z.string(),
      type: z.enum(['string', 'number', 'boolean', 'date', 'object', 'array']),
      sample: z.any(),
      nullable: z.boolean(),
    })),
    eventTypes: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  }),
  execute: async (inputData, context) => {
    const { sourceId, sampleSize } = inputData;

    // Get access token and tenant context
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[analyzeSchema]: Missing authentication token');
    }
    const { tenantId } = extractTenantContext(context);
    const supabase = createAuthenticatedClient(accessToken);

    // Fetch sample events
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false })
      .limit(sampleSize ?? 50);

    if (error || !events || events.length === 0) {
      throw new Error('NO_EVENTS_AVAILABLE');
    }

    // Analyze schema from events
    const fieldMap = new Map<string, { type: string; samples: unknown[]; nullCount: number }>();
    const eventTypes = new Set<string>();

    // Detect platform from first event's state or labels
    let detectedPlatform: string | undefined;

    events.forEach(event => {
      eventTypes.add(event.type);

      // ── 1. Analyze labels fields (existing behavior) ──
      const labels = event.labels || {};
      if (typeof labels === 'object' && labels !== null) {
        Object.entries(labels).forEach(([key, value]) => {
          if (!fieldMap.has(key)) {
            fieldMap.set(key, { type: typeof value, samples: [], nullCount: 0 });
          }
          const field = fieldMap.get(key)!;
          if (value === null) {
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
            fieldMap.set(key, { type: typeof value, samples: [], nullCount: 0 });
          }
          const field = fieldMap.get(key)!;
          if (value === null || value === undefined || value === '') {
            field.nullCount++;
          } else {
            field.samples.push(value);
          }
        });
      }

      // ── 3. Standard columns (existing behavior) ──
      if (event.value !== null && event.value !== undefined) {
        if (!fieldMap.has('value')) {
          fieldMap.set('value', { type: 'number', samples: [], nullCount: 0 });
        }
        fieldMap.get('value')!.samples.push(event.value);
      }

      if (event.text) {
        if (!fieldMap.has('text')) {
          fieldMap.set('text', { type: 'string', samples: [], nullCount: 0 });
        }
        fieldMap.get('text')!.samples.push(event.text);
      }
    });

    // Convert to output format
    const fields = Array.from(fieldMap.entries()).map(([name, data]) => ({
      name,
      type: data.type as 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array',
      sample: data.samples[0],
      nullable: data.nullCount > 0,
    }));

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

    return {
      fields,
      eventTypes: Array.from(eventTypes),
      confidence,
    };
  },
});
