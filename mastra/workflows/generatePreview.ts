import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { analyzeSchema } from '../tools/analyzeSchema';
import { selectTemplate } from '../tools/selectTemplate';
import { generateMapping } from '../tools/generateMapping';
import { generateUISpec } from '../tools/generateUISpec';
import { validateSpec } from '../tools/validateSpec';
import { persistPreviewVersion } from '../tools/persistPreviewVersion';

// Platform type derived from selectTemplate tool schema
type SelectTemplatePlatformType = z.infer<typeof selectTemplate.inputSchema>['platformType'];

// Input/Output schemas
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
// Step 1: Analyze Schema
const analyzeSchemaStep = createStep({
  id: 'analyzeSchema',
  inputSchema: z.object({
    tenantId: z.string(),
    userId: z.string(),
    userRole: z.enum(['admin', 'client', 'viewer']),
    interfaceId: z.string(),
    instructions: z.string().optional(),
  }),
  outputSchema: z.object({
    fields: z.array(z.object({
      name: z.string(),
      type: z.string(),
      sample: z.any(),
      nullable: z.boolean(),
    })),
    eventTypes: z.array(z.string()),
    confidence: z.number(),
  }),
  async execute(inputData, context) {
    // Get sourceId from runtimeContext (set when connection was established)
    const sourceId = context?.requestContext?.get('sourceId') as string | undefined;
    
    // Get tenantId from workflow input
    const { tenantId } = inputData;
    
    const sampleSize = 100;
    
    if (!tenantId || !sourceId) {
      throw new Error('CONNECTION_NOT_CONFIGURED');
    }
    
    const result = await analyzeSchema.execute(
      { requestContext: context?.requestContext },
      {
        tenantId,
        sourceId,
        sampleSize,
      }
    );
    
    return result;
  },
});

// Step 2: selectTemplate
const selectTemplateStep = createStep({
  id: 'selectTemplate',
  inputSchema: analyzeSchemaStep.outputSchema,
  outputSchema: z.object({
    templateId: z.string(),
    confidence: z.number(),
    reason: z.string(),
  }),
  async execute({ inputData, context, getStepResult }) {
    const analyzeResult = getStepResult(analyzeSchemaStep);
    
    if (!analyzeResult) {
      throw new Error('TEMPLATE_NOT_FOUND');
    }
    const platformType = (runtimeContext?.get('platformType') || 'make') as SelectTemplatePlatformType;
    const result = await selectTemplate.execute(
      { requestContext: context?.requestContext },
      {
        platformType,
        eventTypes: analyzeResult.eventTypes,
        fields: analyzeResult.fields,
      }
    );
    return result;
  },
});

// Step 3: generateMapping
const generateMappingStep = createStep({
  id: 'generateMapping',
  inputSchema: selectTemplateStep.outputSchema,
  outputSchema: z.object({
    mappings: z.record(z.string()),
    missingFields: z.array(z.string()),
    confidence: z.number(),
  }),
  async execute({ inputData, context, getStepResult }) {
    const analyzeResult = getStepResult(analyzeSchemaStep);
    const templateResult = getStepResult(selectTemplateStep);
    if (!analyzeResult || !templateResult) {
      throw new Error('MAPPING_INCOMPLETE_REQUIRED_FIELDS');
    }
    const fields = analyzeResult.fields;
    const templateId = templateResult.templateId;
    const platformType = (runtimeContext?.get('platformType') || 'make') as SelectTemplatePlatformType;
    const result = await generateMapping.execute(
      { requestContext: context?.requestContext },
      {
        templateId,
        fields: analyzeResult.fields,
        platformType,
      }
    );
    return result;
  },
});

// Step 4: Check Mapping Completeness (HITL)
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
  async execute({ inputData, context, suspend }) {
    const mappingResult = getStepResult(generateMappingStep);
    const missingFields = mappingResult?.missingFields || [];
    // If any required fields are missing, pause for human input
    if (missingFields.length > 0) {
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

// Step 5: generateUISpec
const generateUISpecStep = createStep({
  id: 'generateUISpec',
  inputSchema: z.object({
    shouldSuspend: z.boolean(),
    missingFields: z.array(z.string()).optional(),
    message: z.string().optional(),
    decision: z.string(),
  }),
  outputSchema: z.object({
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()),
  }),
  async execute({ inputData, context, getStepResult }) {
    // inputData contains output from checkMappingCompletenessStep
    const { shouldSuspend, missingFields, message, decision } = inputData;
    
    // If the previous step decided we should suspend, handle it
    if (shouldSuspend && missingFields && missingFields.length > 0) {
      throw new Error(`INCOMPLETE_MAPPING: ${message || 'Missing required fields'}`);
    }
    
    const templateResult = getStepResult(selectTemplateStep);
    const mappingResult = getStepResult(generateMappingStep);
    
    if (!templateResult || !mappingResult) {
      throw new Error('SPEC_GENERATION_FAILED');
    }
    
    const templateId = templateResult.templateId;
    const mappings = mappingResult.mappings;
    const platformType = (runtimeContext?.get('platformType') || 'make') as SelectTemplatePlatformType;
    
    const result = await generateUISpec.execute(
      { requestContext: context?.requestContext },
      {
        templateId,
        mappings: mappingResult.mappings,
        platformType,
      }
    );
    
    return result;
  },
});

// Step 6: Validate Spec
const validateSpecStep = createStep({
  id: 'validateSpec',
  inputSchema: generateUISpecStep.outputSchema,
  outputSchema: z.object({
    valid: z.boolean(),
    errors: z.array(z.string()),
    score: z.number(),
  }),
  async execute(inputData, context) {
    const specResult = getStepResult(generateUISpecStep);
    const spec_json = specResult?.spec_json || {};
    const result = await validateSpec.execute(
      { requestContext: context?.requestContext },
      { spec_json }
    );
    if (!result.valid || result.score < 0.8) {
      throw new Error('SCORING_HARD_GATE_FAILED');
    }
    return result;
  },
});

// Step 7: persistPreviewVersion
const persistPreviewVersionStep = createStep({
  id: 'persistPreviewVersion',
  inputSchema: validateSpecStep.outputSchema,
  outputSchema: z.object({
    interfaceId: z.string().uuid(),
    versionId: z.string().uuid(),
    previewUrl: z.string(),
  }),
  async execute({ inputData, context, getStepResult, getInitData }) {
    const initData = getInitData() as GeneratePreviewInput;
    const specResult = getStepResult(generateUISpecStep);
    const spec_json = specResult?.spec_json || {};
    const design_tokens = specResult?.design_tokens || {};
    
    const tenantId = initData.tenantId;
    const userId = initData.userId;
    const interfaceId = initData.interfaceId;
    const platformType = (runtimeContext?.get('platformType') || 'make') as SelectTemplatePlatformType;
    const result = await persistPreviewVersion.execute(
      { requestContext: context?.requestContext },
      {
        tenantId,
        userId,
        interfaceId,
        spec_json,
        design_tokens,
        platformType,
      }
    );
    return result;
  },
});

// Step 8: finalize
const finalizeStep = createStep({
  id: 'finalize',
  inputSchema: persistPreviewVersionStep.outputSchema,
  outputSchema: GeneratePreviewOutput,
  async execute({ inputData, context, runId }) {
    const persistResult = getStepResult(persistPreviewVersionStep);
    return {
      runId,
      previewVersionId: persistResult.versionId,
      previewUrl: persistResult.previewUrl,
    };
  },
});

// Workflow definition
export const generatePreviewWorkflow = createWorkflow({
  id: 'generatePreview',
  inputSchema: GeneratePreviewInput,
  outputSchema: GeneratePreviewOutput,
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
