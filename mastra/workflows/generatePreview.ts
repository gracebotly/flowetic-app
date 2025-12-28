import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { analyzeSchema } from '../tools/analyzeSchema';
import { selectTemplate } from '../tools/selectTemplate';
import { generateMapping } from '../tools/generateMapping';
import { generateUISpec } from '../tools/generateUISpec';
import { validateSpec } from '../tools/validateSpec';
import { persistPreviewVersion } from '../tools/persistPreviewVersion';

// Input and output schemas remain unchanged
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

// Step 1: Analyze Schema
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
  async execute({ runtimeContext }) {
    const tenantId = runtimeContext?.get('tenantId');
    const sourceId = runtimeContext?.get('sourceId');
    const sampleSize = 100;
    if (!tenantId || !sourceId) {
      throw new Error('CONNECTION_NOT_CONFIGURED');
    }
    const result = await analyzeSchema.execute({
      context: { tenantId, sourceId, sampleSize },
      runtimeContext,
    });
    return result;
  },
});

// Step 2: Select Template
const selectTemplateStep = createStep({
  id: 'selectTemplate',
  inputSchema: analyzeSchemaStep.outputSchema,
  outputSchema: z.object({
    templateId: z.string(),
    confidence: z.number(),
    reason: z.string(),
  }),
  async execute({ runtimeContext, getStepResult }) {
    const analyzeResult = getStepResult(analyzeSchemaStep);
    const platformType = runtimeContext?.get('platformType');
    if (!analyzeResult || !platformType) {
      throw new Error('TEMPLATE_NOT_FOUND');
    }
    const { eventTypes, fields } = analyzeResult;
    const result = await selectTemplate.execute({
      context: { platformType, eventTypes, fields },
      runtimeContext,
    });
    return result;
  },
});

// Step 3: Generate Mapping
const generateMappingStep = createStep({
  id: 'generateMapping',
  inputSchema: selectTemplateStep.outputSchema,
  outputSchema: z.object({
    mappings: z.record(z.string()),
    missingFields: z.array(z.string()),
    confidence: z.number(),
  }),
  async execute({ runtimeContext, getStepResult }) {
    const analyzeResult = getStepResult(analyzeSchemaStep);
    const templateResult = getStepResult(selectTemplateStep);
    if (!analyzeResult || !templateResult) {
      throw new Error('MAPPING_INCOMPLETE_REQUIRED_FIELDS');
    }
    const fields = analyzeResult.fields;
    const templateId = templateResult.templateId;
    const platformType = runtimeContext?.get('platformType');
    if (!platformType) {
      throw new Error('MAPPING_INCOMPLETE_REQUIRED_FIELDS');
    }
    const result = await generateMapping.execute({
      context: { templateId, fields, platformType },
      runtimeContext,
    });
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
  async execute({ getStepResult, suspend }) {
    const mappingResult = getStepResult(generateMappingStep);
    const missingFields = mappingResult?.missingFields || [];
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

// Step 5: Generate UI Spec
const generateUISpecStep = createStep({
  id: 'generateUISpec',
  inputSchema: z.object({}),
  outputSchema: z.object({
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()),
  }),
  async execute({ runtimeContext, getStepResult }) {
    const templateResult = getStepResult(selectTemplateStep);
    const mappingResult = getStepResult(generateMappingStep);
    if (!templateResult || !mappingResult) {
      throw new Error('SPEC_GENERATION_FAILED');
    }
    const templateId = templateResult.templateId;
    const mappings = mappingResult.mappings;
    const platformType = runtimeContext?.get('platformType');
    if (!platformType) {
      throw new Error('SPEC_GENERATION_FAILED');
    }
    const result = await generateUISpec.execute({
      context: { templateId, mappings, platformType },
      runtimeContext,
    });
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
  async execute({ getStepResult }) {
    const specResult = getStepResult(generateUISpecStep);
    const spec_json = specResult?.spec_json || {};
    const result = await validateSpec.execute({
      context: { spec_json },
    });
    if (result.score < 0.8 || !result.valid) {
      throw new Error('SCORING_HARD_GATE_FAILED');
    }
    return result;
  },
});

// Step 7: Persist Preview Version
const persistPreviewVersionStep = createStep({
  id: 'persist-preview-version',
  inputSchema: validateSpecStep.outputSchema,
  outputSchema: z.object({
    interfaceId: z.string().uuid(),
    versionId: z.string().uuid(),
    previewUrl: z.string(),
  }),
  async execute({ runtimeContext, getStepResult, getInitData }) {
    const specResult = getStepResult(generateUISpecStep);
    const initData = getInitData() as GeneratePreviewInput;
    const { tenantId, userId, interfaceId } = initData;
    const spec_json = specResult?.spec_json || {};
    const design_tokens = specResult?.design_tokens || {};
    const platformType = runtimeContext?.get('platformType');
    const result = await persistPreviewVersion.execute({
      context: {
        tenantId,
        userId,
        interfaceId,
        spec_json,
        design_tokens,
        platformType,
      },
      runtimeContext,
    });
    return result;
  },
});

// Step 8: Finalize
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

// Workflow definition
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
