import { Workflow } from '@mastra/core/workflows';
import { z } from 'zod';

// ============================================================================
// Input/Output Schemas (KEEP EXISTING)
// ============================================================================

export const GeneratePreviewInput = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  userRole: z.enum(['admin', 'client', 'viewer']),
  interfaceId: z.string().uuid(),
  instructions: z.string().optional(),
});

export const GeneratePreviewOutput = z.object({
  runId: z.string().uuid(),
  previewVersionId: z.string().uuid(),
  previewUrl: z.string(),
});

export type GeneratePreviewInput = z.infer<typeof GeneratePreviewInput>;
export type GeneratePreviewOutput = z.infer<typeof GeneratePreviewOutput>;

// ============================================================================
// Workflow Definition (ADD THIS)
// ============================================================================

export const generatePreviewWorkflow = new Workflow({
  name: 'generatePreview',
  triggerSchema: GeneratePreviewInput,
})
  // Step 1: Analyze Schema
  .step('analyzeSchema', {
    execute: async ({ context, mastra }) => {
      const triggerData = context.machineContext?.triggerData;
      const result = await mastra.tools.analyzeSchema.execute({
        tenantId: triggerData?.tenantId,
        interfaceId: triggerData?.interfaceId,
      });
      return result;
    },
  })
  
  // Step 2: Select Template
  .step('selectTemplate', {
    execute: async ({ context, mastra }) => {
      const analyzeResult = context.getStepPayload('analyzeSchema');
      const platformType = analyzeResult?.platformType || 'unknown';
      
      const result = await mastra.tools.selectTemplate.execute({ platformType });
      return result;
    },
  })
  
  // Step 3: Generate Mapping
  .step('generateMapping', {
    execute: async ({ context, mastra }) => {
      const analyzeResult = context.getStepPayload('analyzeSchema');
      const templateResult = context.getStepPayload('selectTemplate');
      
      const detectedSchema = analyzeResult?.schema || {};
      const templateId = templateResult?.templateId || 'default';
      
      const result = await mastra.tools.generateMapping.execute({
        detectedSchema,
        templateId,
      });
      return result;
    },
  })
  
  // Step 4: Check Mapping Completeness (HITL suspension point)
  .step('checkMappingCompleteness', {
    execute: async ({ context }) => {
      const mappingResult = context.getStepPayload('generateMapping');
      const missingFields = mappingResult?.missingFields || [];
      const hasRequiredMissing = missingFields.some((f: any) => f.required);
      
      if (hasRequiredMissing) {
        return {
          shouldSuspend: true,
          missingFields,
          message: 'Required fields missing - needs human input',
          decision: 'continue_partial', // MVP: continue with partial
        };
      }
      
      return { 
        shouldSuspend: false,
        decision: 'complete',
      };
    },
  })
  
  // Step 5: Generate UI Spec
  .step('generateUISpec', {
    execute: async ({ context, mastra }) => {
      const templateResult = context.getStepPayload('selectTemplate');
      const mappingResult = context.getStepPayload('generateMapping');
      const triggerData = context.machineContext?.triggerData;
      
      const templateId = templateResult?.templateId || 'default';
      const mapping = mappingResult?.mappings || {};
      const instructions = triggerData?.instructions;
      
      const result = await mastra.tools.generateUISpec.execute({
        templateId,
        mapping,
        instructions,
      });
      return result;
    },
  })
  
  // Step 6: Validate Spec (Hard gate)
  .step('validateSpec', {
    execute: async ({ context, mastra }) => {
      const specResult = context.getStepPayload('generateUISpec');
      const spec = specResult?.spec || {};
      
      const result = await mastra.tools.validateSpec.execute({ spec });
      
      // Hard gate: score >= 0.8 required
      if (result.score < 0.8 || !result.valid) {
        const errorMsg = `Spec validation failed (score: ${result.score}): ${result.errors.join(', ')}`;
        throw new Error(errorMsg);
      }
      
      return result;
    },
  })
  
  // Step 7: Persist Preview Version
  .step('persistPreviewVersion', {
    execute: async ({ context, mastra }) => {
      const specResult = context.getStepPayload('generateUISpec');
      const triggerData = context.machineContext?.triggerData;
      
      const spec = specResult?.spec || {};
      
      const result = await mastra.tools.persistPreviewVersion.execute({
        tenantId: triggerData?.tenantId,
        interfaceId: triggerData?.interfaceId,
        userId: triggerData?.userId,
        spec,
      });
      
      return result;
    },
  })
  .commit();
