import { createWorkflow, createStep } from '@mastra/core/workflows';
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
// Step Definitions
// ============================================================================
const analyzeSchemaStep = createStep({
  id: 'analyzeSchema',
  inputSchema: z.object({}),
  outputSchema: z.object({
    fields: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        sample: z.any(),
        nullable: z.boolean(),
      }),
    ),
    eventTypes: z.array(z.string()),
    confidence: z.number(),
  }),
  async execute({ mastra, runtimeContext }) {
    const tenantId = runtimeContext?.get('tenantId');
    const sourceId = runtimeContext?.get('sourceId');
    const sampleSize = 100;
    if (!tenantId || !sourceId) {
      throw new Error('CONNECTION_NOT_CONFIGURED');
    }
    
    const result = await mastra.tools.analyzeSchema.execute({
      tenantId,
      sourceId,
      sampleSize,
    });
    return result;
  },
});

const selectTemplateStep = createStep({
  id: 'selectTemplate',
  inputSchema: analyzeSchemaStep.outputSchema,
  outputSchema: z.object({
    templateId: z.string(),
    confidence: z.number(),
    reason: z.string(),
  }),
  async execute({ mastra, runtimeContext, getStepResult }) {
    const analyzeResult = getStepResult(analyzeSchemaStep);
    const platformType = runtimeContext?.get('platformType') || 'unknown';
    
    if (!analyzeResult) {
      throw new Error('TEMPLATE_NOT_FOUND');
    }
    
    const result = await mastra.tools.selectTemplate.execute({ 
      platformType,
      eventTypes: analyzeResult.eventTypes,
      fields: analyzeResult.fields,
    });
    return result;
  },
});

const generateMappingStep = createStep({
  id: 'generateMapping',
  inputSchema: selectTemplateStep.outputSchema,
  outputSchema: z.object({
    mappings: z.record(z.string()),
    missingFields: z.array(z.string()),
    confidence: z.number(),
  }),
  async execute({ mastra, runtimeContext, getStepResult }) {
    const analyzeResult = getStepResult(analyzeSchemaStep);
    const templateResult = getStepResult(selectTemplateStep);
    
    const detectedSchema = analyzeResult?.fields || [];
    const templateId = templateResult?.templateId || 'default';
    const platformType = runtimeContext?.get('platformType') || 'unknown';
    
    const result = await mastra.tools.generateMapping.execute({
      detectedSchema,
      templateId,
      platformType,
    });
    return result;
  },
});

const checkMappingCompletenessStep = createStep({
  id: 'checkMappingCompleteness',
  inputSchema: generateMappingStep.outputSchema,
  outputSchema: z.object({
    shouldSuspend: z.boolean(),
    missingFields: z.array(z.string()).optional(),
    message: z.string().optional(),
    decision: z.string(),
  }),
  suspendSchema: z.object({
    reason: z.string(),
    missingFields: z.array(z.string()),
    message: z.string().optional(),
  }),
  resumeSchema: z.object({
    selectedFieldKey: z.string().optional(),
    confirmed: z.boolean().optional(),
  }),
  async execute({ getStepResult, suspend }) {
    const mappingResult = getStepResult(generateMappingStep);
    const missingFields = mappingResult?.missingFields || [];
    const hasRequiredMissing = missingFields.some((f: any) => f.required);
    
    if (hasRequiredMissing) {
      await suspend({
        reason: 'Required fields missing - needs human input',
        missingFields,
        message: 'Please map missing fields and resume.',
      });
    }
    
    return { 
      shouldSuspend: false,
      decision: 'complete',
    };
  },
});

const generateUISpecStep = createStep({
  id: 'generateUISpec',
  inputSchema: z.object({}),
  outputSchema: z.object({
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()),
  }),
  async execute({ mastra, runtimeContext, getStepResult }) {
    const templateResult = getStepResult(selectTemplateStep);
    const mappingResult = getStepResult(generateMappingStep);
    
    const templateId = templateResult?.templateId || 'default';
    const mapping = mappingResult?.mappings || {};
    const platformType = runtimeContext?.get('platformType') || 'unknown';
    
    const result = await mastra.tools.generateUISpec.execute({
      templateId,
      mapping,
      platformType,
    });
    return result;
  },
});

const validateSpecStep = createStep({
  id: 'validateSpec',
  inputSchema: generateUISpecStep.outputSchema,
  outputSchema: z.object({
    valid: z.boolean(),
    errors: z.array(z.string()),
    score: z.number(),
  }),
  async execute({ mastra, getStepResult }) {
    const specResult = getStepResult(generateUISpecStep);
    const spec_json = specResult?.spec_json || {};
    
    const result = await mastra.tools.validateSpec.execute({ spec_json });
    
    if (result.score < 0.8 || !result.valid) {
      throw new Error('SCORING_HARD_GATE_FAILED');
    }
    
    return result;
  },
});

const persistPreviewVersionStep = createStep({
  id: 'persistPreviewVersion',
  inputSchema: validateSpecStep.outputSchema,
  outputSchema: z.object({
    interfaceId: z.string().uuid(),
    versionId: z.string().uuid(),
    previewUrl: z.string(),
  }),
  async execute({ mastra, runtimeContext, getStepResult, getInitData }) {
    const specResult = getStepResult(generateUISpecStep);
    const initData = getInitData();
    
    const spec_json = specResult?.spec_json || {};
    const design_tokens = specResult?.design_tokens || {};
    
    const result = await mastra.tools.persistPreviewVersion.execute({
      tenantId: initData.tenantId,
      interfaceId: initData.interfaceId,
      userId: initData.userId,
      spec_json,
      design_tokens,
      platformType: runtimeContext?.get('platformType') || 'unknown',
    });
    
    return result;
  },
});

const finalizeStep = createStep({
  id: 'finalize',
  inputSchema: persistPreviewVersionStep.outputSchema,
  outputSchema: GeneratePreviewOutput,
  async execute({ getStepResult, runId }) {
    const persistResult = getStepResult(persistPreviewVersionStep);
    return {
      runId,
      previewVersionId: persistResult.versionId,
      previewUrl: persistResult.previewUrl,
    };
  },
});

// ============================================================================
// Workflow Definition
// ============================================================================
export const generatePreviewWorkflow = createWorkflow({
  id: 'generatePreview',
  inputSchema: GeneratePreviewInput,
  outputSchema: GeneratePreviewOutput,
  validateInputs: true,
})
  .then(analyzeSchemaStep)
  .then(selectTemplateStep)
  .then(generateMappingStep)
  .then(checkMappingCompletenessStep)
  .then(generateUISpecStep)
  .then(validateSpecStep)
  .then(persistPreviewVersionStep)
  .then(finalizeStep)
  .commit();
