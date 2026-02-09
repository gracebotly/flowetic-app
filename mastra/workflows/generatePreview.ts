import { createWorkflow, createStep } from '@mastra/core/workflows';
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
  async execute({ inputData, requestContext, getStepResult, getInitData, suspend, runId }) {
    // Phase gate REMOVED — the agent enforces the journey flow via instructions.
    // No need to block here; the agent won't call this workflow until selections are complete.

    // Get sourceId from context (set when connection was established)
    const sourceId = requestContext.get('sourceId');
    
    // Extract specific properties from inputData (NOT the whole object)
    const { tenantId, userId, interfaceId, userRole, instructions } = inputData;
    
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
        platformType: requestContext.get('platformType') || 'make',
      },
      { requestContext }
    );
    
    return result;
  },
});

// Step 2: selectTemplate
const selectTemplateStep = createStep({
  id: 'selectTemplate',
  inputSchema: z.object({
    fields: z.array(z.object({
      name: z.string(),
      type: z.string(),
      nullable: z.boolean(),
      sample: z.any().optional(),
    })),
    eventTypes: z.array(z.string()),
    confidence: z.number(),
  }),
  outputSchema: z.object({
    templateId: z.string(),
    confidence: z.number(),
    reason: z.string(),
  }),
  async execute({ inputData, requestContext, getStepResult, getInitData, suspend, runId }) {
    const platformType = (requestContext.get("platformType") || 'make') as SelectTemplatePlatformType;
    
    const result = await callTool(selectTemplate, 
      {
        platformType,
        eventTypes: inputData.eventTypes,
        fields: inputData.fields,
      },
      { requestContext }
    );
    return result;
  },
});

// Step 3: generateMapping
const generateMappingStep = createStep({
  id: 'generateMapping',
  inputSchema: z.object({
    templateId: z.string(),
    confidence: z.number(),
    reason: z.string(),
  }),
  outputSchema: z.object({
    mappings: z.record(z.string()),
    missingFields: z.array(z.string()),
    confidence: z.number(),
  }),
  async execute({ inputData, requestContext, getStepResult, getInitData, suspend, runId }) {
    const analyzeResult = getStepResult(analyzeSchemaStep);
    const templateId = inputData.templateId;
    const platformType = (requestContext.get("platformType") || 'make') as SelectTemplatePlatformType;
    
    if (!analyzeResult) {
      throw new Error('MAPPING_INCOMPLETE_REQUIRED_FIELDS');
    }
    
    const result = await callTool(generateMapping, 
      {
        templateId,
        fields: analyzeResult.fields,
        platformType,
      },
      { requestContext }
    );
    return result;
  },
});

// Step 4: Check Mapping Completeness (HITL)
const checkMappingCompletenessStep = createStep({
  id: 'checkMappingCompleteness',
  inputSchema: z.object({
    mappings: z.record(z.string()),
    missingFields: z.array(z.string()),
    confidence: z.number(),
  }),
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
  async execute({ inputData, requestContext, getStepResult, getInitData, suspend, runId }) {
    const missingFields = inputData.missingFields || [];
    const confidence = inputData.confidence || 0;

    // Only suspend if ZERO fields could be mapped (total failure).
    // Partial mappings (confidence > 0) can proceed with best-effort rendering.
    if (confidence === 0 && missingFields.length > 0) {
      await suspend({
        reason: 'No fields could be mapped automatically',
        missingFields,
        message: 'None of the required fields could be matched to your data. Please provide field mappings manually.',
      });
    }

    // Log partial mappings but don't block
    if (missingFields.length > 0) {
      console.warn(
        `[checkMappingCompleteness] Proceeding with partial mapping. Missing: ${missingFields.join(', ')}. Confidence: ${confidence}`
      );
    }

    return {
      shouldSuspend: false,
      missingFields: missingFields.length > 0 ? missingFields : undefined,
      message: missingFields.length > 0
        ? `Proceeding with partial mapping (${missingFields.length} field(s) unmapped)`
        : undefined,
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
  async execute({ inputData, requestContext, getStepResult, getInitData, suspend, runId }) {
    const { shouldSuspend, missingFields, message, decision } = inputData;
    
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
    const platformType = (requestContext.get("platformType") || 'make') as SelectTemplatePlatformType;
    const selectedStyleBundleId = (requestContext.get("selectedStyleBundleId") || 'professional-clean') as string;

    const result = await callTool(generateUISpec,
      {
        templateId,
        mappings: mappings,
        platformType,
        selectedStyleBundleId,
      },
      { requestContext }
    );
    
    return result;
  },
});

// Step 6: Validate Spec
const validateSpecStep = createStep({
  id: 'validateSpec',
  inputSchema: z.object({
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()),
  }),
  outputSchema: z.object({
    valid: z.boolean(),
    errors: z.array(z.string()),
    score: z.number(),
  }),
  async execute({ inputData, requestContext, getStepResult, getInitData, suspend, runId }) {
    const spec_json = inputData.spec_json;
    
    const result = await callTool(validateSpec, 
      { spec_json },
      { requestContext }
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
  inputSchema: z.object({
    valid: z.boolean(),
    errors: z.array(z.string()),
    score: z.number(),
  }),
  outputSchema: z.object({
    interfaceId: z.string().uuid(),
    versionId: z.string().uuid(),
    previewUrl: z.string(),
  }),
  async execute({ inputData, requestContext, getStepResult, getInitData, suspend, runId }) {
    const initData = getInitData() as GeneratePreviewInput;
    const specResult = getStepResult(generateUISpecStep);
    const spec_json = specResult?.spec_json || {};
    const design_tokens = specResult?.design_tokens || {};
    
    const tenantId = initData.tenantId;
    const userId = initData.userId;
    const interfaceId = initData.interfaceId;
    const platformType = (requestContext.get("platformType") || 'make') as SelectTemplatePlatformType;

    // Ensure requestContext has tenantId/userId for extractTenantContext()
    // The workflow may not propagate these automatically
    if (!requestContext.get('tenantId')) {
      requestContext.set('tenantId', tenantId);
    }
    if (!requestContext.get('userId')) {
      requestContext.set('userId', userId);
    }

    // Only pass fields matching persistPreviewVersion.inputSchema
    // tenantId/userId are read from requestContext by extractTenantContext()
    const result = await callTool(persistPreviewVersion,
      {
        interfaceId,
        spec_json,
        design_tokens,
        platformType,
      },
      { requestContext }
    );
    return result;
  },
});

// Step 8: finalize
const finalizeStep = createStep({
  id: 'finalize',
  inputSchema: z.object({
    interfaceId: z.string().uuid(),
    versionId: z.string().uuid(),
    previewUrl: z.string(),
  }),
  outputSchema: GeneratePreviewOutput,
  async execute({ inputData, requestContext, getStepResult, getInitData, suspend, runId }) {
    const persistResult = inputData;
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
