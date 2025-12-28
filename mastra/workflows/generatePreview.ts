// COMPLETE FILE: mastra/workflows/generatePreview.ts
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
// Workflow State Schema
// ============================================================================
const GeneratePreviewState = z.object({
  schemaReady: z.boolean().default(false),
  mappingComplete: z.boolean().default(false),
  templateId: z.string().optional(),
});

// ============================================================================
// Step Definitions
// ============================================================================

// Step 1: Analyze Schema – pre-validation and schema summarization
const analyzeSchemaStep = createStep({
  id: 'analyzeSchema',
  // no explicit input; we will use runtimeContext/triggerData
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
  async execute({ mastra, runtimeContext, state, setState }) {
    const tenantId = runtimeContext?.get('tenantId');
    const sourceId = runtimeContext?.get('sourceId');
    const sampleSize = 100;
    if (!tenantId || !sourceId) {
      // Cannot analyze schema without connection
      throw new Error('CONNECTION_NOT_CONFIGURED');
    }
    const result = await mastra.tools.analyzeSchema.execute({
      tenantId,
      sourceId,
      sampleSize,
    });
    // Mark schemaReady flag in state
    setState({ ...state, schemaReady: true });
    return result;
  },
});

// Step 2: Select Template – choose template based on platform and schema
const selectTemplateStep = createStep({
  id: 'selectTemplate',
  inputSchema: analyzeSchemaStep.outputSchema,
  outputSchema: z.object({
    templateId: z.string(),
    confidence: z.number(),
    reason: z.string(),
  }),
  async execute({ mastra, runtimeContext, getStepResult, state, setState }) {
    const analyzeResult = getStepResult(analyzeSchemaStep);
    const platformType = runtimeContext?.get('platformType');
    if (!platformType || !analyzeResult) {
      throw new Error('TEMPLATE_NOT_FOUND');
    }
    const { eventTypes, fields } = analyzeResult;
    const result = await mastra.tools.selectTemplate.execute({
      platformType,
      eventTypes,
      fields,
    });
    // Save templateId in state
    setState({ ...state, templateId: result.templateId });
    return result;
  },
});

// Step 3: Generate Mapping – map source fields to template requirements
const generateMappingStep = createStep({
  id: 'generateMapping',
  inputSchema: selectTemplateStep.outputSchema,
  outputSchema: z.object({
    mappings: z.record(z.string()),
    missingFields: z.array(z.string()),
    confidence: z.number(),
  }),
  async execute({ mastra, runtimeContext, getStepResult, state, setState }) {
    const templateResult = getStepResult(selectTemplateStep);
    const analyzeResult = getStepResult(analyzeSchemaStep);
    const templateId = templateResult?.templateId;
    const platformType = runtimeContext?.get('platformType');
    const fields = analyzeResult?.fields;
    if (!templateId || !fields || !platformType) {
      throw new Error('MAPPING_INCOMPLETE_REQUIRED_FIELDS');
    }
    const result = await mastra.tools.generateMapping.execute({
      templateId,
      fields,
      platformType,
    });
    // If there are no missing fields, mark mappingComplete
    if (!result.missingFields || result.missingFields.length === 0) {
      setState({ ...state, mappingComplete: true });
    }
    return result;
  },
});

// Step 4: Check Mapping Completeness – HITL suspension point
const checkMappingCompletenessStep = createStep({
  id: 'checkMappingCompleteness',
  inputSchema: generateMappingStep.outputSchema,
  outputSchema: z.object({
    ok: z.boolean().default(true),
  }),
  // Schemas for suspension/resume data
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
    const missing = mappingResult?.missingFields || [];
    if (missing.length > 0) {
      // Suspend the workflow to allow human mapping
      await suspend({
        reason: 'Required fields missing - needs human input',
        missingFields: missing,
        message: 'Please map the missing fields and resume.',
      });
    }
    return { ok: true };
  },
});

// Step 5: Generate UI Spec – create dashboard spec from template and mapping
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
    const templateId = templateResult?.templateId;
    const mappings = mappingResult?.mappings || {};
    const platformType = runtimeContext?.get('platformType');
    if (!templateId || !platformType) {
      throw new Error('SPEC_GENERATION_FAILED');
    }
    const result = await mastra.tools.generateUISpec.execute({
      templateId,
      mappings,
      platformType,
    });
    return result;
  },
});

// Step 6: Validate Spec – hard gate on spec validity and score
const validateSpecStep = createStep({
  id: 'validateSpec',
  inputSchema: generateUISpecStep.outputSchema,
  outputSchema: z.object({
    valid: z.boolean(),
    errors: z.array(z.string()),
    score: z.number(),
  }),
  async execute({ mastra, getStepResult }) {
    const uiResult = getStepResult(generateUISpecStep);
    const spec_json = uiResult?.spec_json;
    const result = await mastra.tools.validateSpec.execute({
      spec_json,
    });
    // Hard gate: require valid spec and score ≥ 0.8
    if (!result.valid || result.score < 0.8) {
      throw new Error('SCORING_HARD_GATE_FAILED');
    }
    return result;
  },
});

// Step 7: Persist Preview Version – save spec and design tokens to Supabase
const persistPreviewVersionStep = createStep({
  id: 'persistPreviewVersion',
  inputSchema: validateSpecStep.outputSchema,
  outputSchema: z.object({
    interfaceId: z.string().uuid(),
    versionId: z.string().uuid(),
    previewUrl: z.string(),
  }),
  async execute({ mastra, runtimeContext, getInitData, getStepResult }) {
    const initData = getInitData() as GeneratePreviewInput;
    const { tenantId, userId, interfaceId } = initData;
    const platformType = runtimeContext?.get('platformType');
    const uiResult = getStepResult(generateUISpecStep);
    const spec_json = uiResult?.spec_json;
    const design_tokens = uiResult?.design_tokens;
    if (!tenantId || !userId || !interfaceId || !spec_json || !design_tokens || !platformType) {
      throw new Error('SPEC_GENERATION_FAILED');
    }
    const result = await mastra.tools.persistPreviewVersion.execute({
      tenantId,
      userId,
      interfaceId,
      spec_json,
      design_tokens,
      platformType,
    });
    return result;
  },
});

// Step 8: Finalize – return runId and preview identifiers
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
  stateSchema: GeneratePreviewState,
  // Enable input validation
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
