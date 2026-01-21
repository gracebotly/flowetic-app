import { createWorkflow, createStep, type ExecuteParams } from '@mastra/core/workflows';
import { z } from 'zod';
import { analyzeSchema } from '../tools/analyzeSchema';
import { selectTemplate } from '../tools/selectTemplate';
import { generateMapping } from '../tools/generateMapping';
import { generateUISpec } from '../tools/generateUISpec';
import { validateSpec } from '../tools/validateSpec';
import { persistPreviewVersion } from '../tools/persistPreviewVersion';
import { callTool } from '../lib/callTool';
// Platform type derived from selectTemplate tool schema
type SelectTemplatePlatformType = "vapi" | "retell" | "n8n" | "mastra" | "crewai" | "activepieces" | "make";

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

export type GeneratePreviewInput = {
  tenantId: string;
  userId: string;
  userRole: 'admin' | 'client' | 'viewer';
  interfaceId: string;
  instructions?: string;
};

export type GeneratePreviewOutput = {
  runId: string;
  previewVersionId: string;
  previewUrl: string;
};

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
  async execute(inputData: any, context: ExecuteParams) {
    // Get sourceId from context (set when connection was established)
    const sourceId = context.context?.get('sourceId') as string | undefined;
    
    // Get tenantId from workflow input
    const { tenantId } = inputData;
    
    const sampleSize = 100;
    
    if (!tenantId || !sourceId) {
      throw new Error('CONNECTION_NOT_CONFIGURED');
    }
    
    const result = await callTool(
      analyzeSchema,
      {
        tenantId,
        sourceId,
        sampleSize,
      },
      { context: context.context }
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
  async execute(inputData: any, { context, getStepResult }: ExecuteParams) {
    const analyzeResult = getStepResult(analyzeSchemaStep);
    
    if (!analyzeResult) {
      throw new Error('TEMPLATE_NOT_FOUND');
    }
    const platformType = (context?.get('platformType') || 'make') as SelectTemplatePlatformType;
    const result = await callTool(
      selectTemplate,
      {
        platformType,
        eventTypes: analyzeResult.eventTypes,
        fields: analyzeResult.fields,
      },
      { context }
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
  async execute(inputData: any, { context, getStepResult }: ExecuteParams) {
    const analyzeResult = getStepResult(analyzeSchemaStep);
    const templateResult = getStepResult(selectTemplateStep);
    if (!analyzeResult || !templateResult) {
      throw new Error('MAPPING_INCOMPLETE_REQUIRED_FIELDS');
    }
    const fields = analyzeResult.fields;
    const templateId = templateResult.templateId;
    const platformType = (context?.get('platformType') || 'make') as SelectTemplatePlatformType;
    const result = await callTool(
      generateMapping,
      {
        templateId,
        fields: analyzeResult.fields,
        platformType,
      },
      { context }
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
  async execute(inputData: any, { context, suspend }: ExecuteParams) {
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
  async execute(inputData: any, { context, getStepResult }: ExecuteParams) {
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
    const platformType = (context?.get('platformType') || 'make') as SelectTemplatePlatformType;
    
    const result = await callTool(
      generateUISpec,
      {
        templateId,
        mappings: mappingResult.mappings,
        platformType,
      },
      { context }
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
  async execute(inputData: any, { context, getStepResult }: ExecuteParams) {
    const specResult = getStepResult(generateUISpecStep);
    const spec_json = specResult?.spec_json || {};
    const result = await callTool(
      validateSpec,
      { spec_json },
      { context }
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
  async execute(inputData: any, { context, getStepResult, getInitData }: ExecuteParams) {
    const initData = getInitData() as GeneratePreviewInput;
    const specResult = getStepResult(generateUISpecStep);
    const spec_json = specResult?.spec_json || {};
    const design_tokens = specResult?.design_tokens || {};
    
    const tenantId = initData.tenantId;
    const userId = initData.userId;
    const interfaceId = initData.interfaceId;
    const platformType = (context?.get('platformType') || 'make') as SelectTemplatePlatformType;
    const result = await callTool(
      persistPreviewVersion,
      {
        tenantId,
        userId,
        interfaceId,
        spec_json,
        design_tokens,
        platformType,
      },
      { context }
    );
    return result;
  },
});

// Step 8: finalize
const finalizeStep = createStep({
  id: 'finalize',
  inputSchema: persistPreviewVersionStep.outputSchema,
  outputSchema: GeneratePreviewOutput,
  async execute(inputData: any, { context, runId }: ExecuteParams) {
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
