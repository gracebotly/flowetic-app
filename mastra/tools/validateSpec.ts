import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const UISpecSchema = z.object({
  version: z.string(),
  templateId: z.string(),
  platformType: z.string(),
  layout: z.object({
    type: z.string(),
    columns: z.number(),
    gap: z.number(),
  }),
  components: z.array(z.object({
    id: z.string(),
    type: z.string(),
    props: z.record(z.any()),
    layout: z.object({
      col: z.number(),
      row: z.number(),
      w: z.number(),
      h: z.number(),
    }),
  })),
});

export const validateSpec = createTool({
  id: 'validate-spec',
  description: 'Validates dashboard UI specification against schema',
  inputSchema: z.object({
    spec_json: z.record(z.any()),
  }),
  outputSchema: z.object({
    valid: z.boolean(),
    errors: z.array(z.string()),
    score: z.number().min(0).max(1),
  }),
  execute: async ({ context }) => {
    const { spec_json } = context;
    
    try {
      // Validate against schema
      UISpecSchema.parse(spec_json);
      
      // Additional validation rules
      const errors: string[] = [];
      
      // Check if has at least one component
      if (!spec_json.components || spec_json.components.length === 0) {
        errors.push('Spec must have at least one component');
      }
      
      // Check for duplicate component IDs
      const ids = new Set();
      spec_json.components?.forEach((comp: any) => {
        if (ids.has(comp.id)) {
          errors.push(`Duplicate component ID: ${comp.id}`);
        }
        ids.add(comp.id);
      });
      
      // Check layout constraints
      spec_json.components?.forEach((comp: any) => {
        if (comp.layout.col + comp.layout.w > spec_json.layout.columns) {
          errors.push(`Component ${comp.id} exceeds grid width`);
        }
      });
      
      const valid = errors.length === 0;
      const score = valid ? 1.0 : Math.max(0, 1 - (errors.length * 0.1));
      
      return {
        valid,
        errors,
        score,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        valid: false,
        errors: [message],
        score: 0,
      };
    }
  },
});
