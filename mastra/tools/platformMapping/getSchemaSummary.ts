
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const getSchemaSummary = createTool({
  id: 'getSchemaSummary',
  description: 'Summarize event schema and field types from samples',
  inputSchema: z.object({
    samples: z.array(z.any()).describe('Event samples to analyze'),
    includeStatistics: z.boolean().default(true).describe('Include field statistics'),
  }),
  outputSchema: z.object({
    fields: z.array(z.object({
      name: z.string(),
      type: z.string(),
      path: z.string(),
      nullable: z.boolean(),
      sampleValue: z.any(),
      frequency: z.number(),
    })),
    eventTypes: z.array(z.string()),
    totalEvents: z.number(),
    schemaComplexity: z.enum(['simple', 'moderate', 'complex']),
    confidence: z.number(),
  }),
  execute: async ({ context }) => {
    const { samples, includeStatistics } = context;

    try {
      if (!samples || samples.length === 0) {
        throw new Error('No samples provided for schema analysis');
      }

      // Extract all unique field paths and types
      const fieldMap = new Map<string, any>();
      const eventTypes = new Set<string>();

      samples.forEach((sample: any) => {
        if (sample.type) {
          eventTypes.add(String(sample.type));
        }
        extractFieldsFromObject(sample.data || sample, '', fieldMap);
      });

      // Convert map to array and calculate statistics
      const fields = Array.from(fieldMap.entries()).map(([path, info]) => ({
        name: path.split('.').pop() || path,
        type: String(info.type),
        path,
        nullable: Boolean(info.nullable),
        sampleValue: info.sampleValue,
        frequency: (info.count / samples.length) * 100,
      }));

      // Determine schema complexity
      const fieldsCount = fields.length;
      let complexity: 'simple' | 'moderate' | 'complex';
      if (fieldsCount <= 10) {
        complexity = 'simple';
      } else if (fieldsCount <= 25) {
        complexity = 'moderate';
      } else {
        complexity = 'complex';
      }

      return {
        fields,
        eventTypes: Array.from(eventTypes),
        totalEvents: samples.length,
        schemaComplexity: complexity,
        confidence: Math.min(0.95, samples.length / 100),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to summarize schema: ${message}`);
    }
  },
});

function extractFieldsFromObject(obj: any, prefix: string, fieldMap: Map<string, any>) {
  if (obj === null || typeof obj !== 'object') {
    return;
  }

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      const type = typeof value;

      if (!fieldMap.has(fieldPath)) {
        fieldMap.set(fieldPath, {
          type: type === 'object' && Array.isArray(value) ? 'array' : type,
          count: 0,
          sampleValue: value,
          nullable: value === null || value === undefined,
        });
      }

      const fieldInfo = fieldMap.get(fieldPath);
      fieldInfo.count++;

      if (type === 'object' && !Array.isArray(value) && value !== null) {
        extractFieldsFromObject(value, fieldPath, fieldMap);
      }
    }
  }
}





