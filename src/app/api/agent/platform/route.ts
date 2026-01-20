import {
  analyzeSchema,
  selectTemplate,
  generateMapping,
  generateUISpec,
  validateSpec,
  persistPreviewVersion,
} from '@/mastra/tools';
import { NextRequest } from 'next/server';
import { RequestContext } from '@mastra/core/request-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/platform
 *
 * This API endpoint orchestrates the platform mapping process using Mastra tools.
 * It runs server‑side (no UI components) and returns a JSON response with the preview URL.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenantId,
      userId,
      sourceId,
      platformType,
      interfaceId,
      instructions,
    } = body;

    // Validate required fields
    if (!tenantId || !userId || !sourceId || !platformType) {
      return new Response(
        JSON.stringify({
          type: 'error',
          code: 'MISSING_REQUIRED_FIELDS',
          message:
            'tenantId, userId, sourceId, and platformType are required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Create runtime context with necessary values
    const requestContext = new RequestContext();
    requestContext.set('sourceId', sourceId);
    requestContext.set('platformType', platformType);

    // Step 1: analyze schema
    const analyzeResult = await analyzeSchema.execute({
      inputData: { tenantId, sourceId, sampleSize: 100 },
      requestContext,
    });

    // Step 2: select template
    const selectResult = await selectTemplate.execute({
      inputData: {
        platformType,
        eventTypes: analyzeResult.eventTypes,
        fields: analyzeResult.fields,
      },
      requestContext,
    });

    // Step 3: generate mapping
    const mappingResult = await generateMapping.execute({
      inputData: {
        templateId: selectResult.templateId,
        fields: analyzeResult.fields,
        platformType,
      },
      requestContext,
    });

    // Step 4: generate UI spec
    const uiSpecResult = await generateUISpec.execute({
      inputData: {
        templateId: selectResult.templateId,
        mappings: mappingResult.mappings,
        platformType,
      },
      requestContext,
    });

    // Step 5: validate spec
    const validationResult = await validateSpec.execute({
      inputData: { spec_json: uiSpecResult.spec_json },
      requestContext,
    });
    if (!validationResult.valid || validationResult.score < 0.8) {
      return new Response(
        JSON.stringify({
          type: 'error',
          code: 'SCORING_HARD_GATE_FAILED',
          message: 'Spec validation failed; please verify your data.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Step 6: persist preview version
    const finalInterfaceId =
      interfaceId || `preview-${Date.now().toString()}`;
    const persistResult = await persistPreviewVersion.execute({
      inputData: {
        tenantId,
        userId,
        interfaceId: finalInterfaceId,
        spec_json: uiSpecResult.spec_json,
        design_tokens: uiSpecResult.design_tokens,
        platformType,
      },
      requestContext,
    });

    return new Response(
      JSON.stringify({
        type: 'workflow_complete',
        workflow: 'generate-preview',
        result: {
          previewUrl: persistResult.previewUrl,
          interfaceId: persistResult.interfaceId,
          versionId: persistResult.versionId,
        },
        message: `✅ Dashboard preview generated! You can view it at ${persistResult.previewUrl}`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    console.error('Platform API error', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        type: 'error',
        code: 'UNKNOWN_ERROR',
        message: message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}