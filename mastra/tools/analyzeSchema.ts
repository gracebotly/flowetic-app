import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const analyzeSchema = createTool({
  id: 'analyze-schema',
  description: 'Analyzes event schema from a data source to detect field types and patterns',
  inputSchema: z.object({
    tenantId: z.string().uuid(),
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
    const { tenantId, sourceId, sampleSize } = inputData;
    
    const supabase = await createClient();
    
    // Fetch sample events
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false })
      .limit(sampleSize);
    
    if (error || !events || events.length === 0) {
      throw new Error('NO_EVENTS_AVAILABLE');
    }
    
    // Analyze schema from events
    const fieldMap = new Map<string, { type: string; samples: any[]; nullCount: number }>();
    const eventTypes = new Set<string>();
    
    events.forEach(event => {
      eventTypes.add(event.type);
      
      // Analyze event fields
      const fields = event.labels || {};
      Object.entries(fields).forEach(([key, value]) => {
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
      
      // Also check standard fields
      if (event.value !== null) {
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
      type: data.type as any,
      sample: data.samples[0],
      nullable: data.nullCount > 0,
    }));
    
    const confidence = events.length >= 10 ? 0.9 : 0.6;
    
    return {
      fields,
      eventTypes: Array.from(eventTypes),
      confidence,
    };
  },
});
