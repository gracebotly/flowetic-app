import { NextRequest, NextResponse } from 'next/server';
import { RuntimeContext } from '@mastra/core/runtime-context';
import {
  analyzeSchema,
  selectTemplate,
  generateMapping,
  generateUISpec,
  validateSpec,
  persistPreviewVersion,
} from '@/mastra/tools';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, sourceId } = body;

    if (!tenantId || !sourceId) {
      return NextResponse.json(
        { error: 'Missing tenantId or sourceId' },
        { status: 400 }
      );
    }

    // Create a properly typed RuntimeContext instance
    // According to Mastra docs, this must be an instance of RuntimeContext class
    const runtimeContext = new RuntimeContext();
    
    // You can optionally set values if needed:
    // runtimeContext.set('tenantId', tenantId);
    // runtimeContext.set('sourceId', sourceId);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Helper to send SSE messages
          const sendEvent = (event: string, data: any) => {
            const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(message));
          };

          // Step 1: analyze schema
          sendEvent('progress', { step: 'analyze', status: 'running' });
          const analyzeResult = await analyzeSchema.execute({
            context: { tenantId, sourceId, sampleSize: 100 },
            runtimeContext,
          });

          // Step 2: select template
          sendEvent('progress', { step: 'select', status: 'running' });
          const selectResult = await selectTemplate.execute({
            context: { schema: analyzeResult },
            runtimeContext,
          });

          // Step 3: generate mapping
          sendEvent('progress', { step: 'mapping', status: 'running' });
          const mappingResult = await generateMapping.execute({
            context: { schema: analyzeResult, templateId: selectResult.templateId },
            runtimeContext,
          });

          // Step 4: generate UI spec
          sendEvent('progress', { step: 'generate', status: 'running' });
          const specResult = await generateUISpec.execute({
            context: {
              tenantId,
              sourceId,
              templateId: selectResult.templateId,
              mapping: mappingResult,
            },
            runtimeContext,
          });

          // Step 5: validate spec
          sendEvent('progress', { step: 'validate', status: 'running' });
          const validationResult = await validateSpec.execute({
            context: { spec: specResult },
            runtimeContext,
          });

          if (!validationResult.valid) {
            sendEvent('error', {
              message: 'Validation failed',
              errors: validationResult.errors,
            });
            controller.close();
            return;
          }

          // Step 6: persist preview version
          sendEvent('progress', { step: 'persist', status: 'running' });
          const persistResult = await persistPreviewVersion.execute({
            context: {
              tenantId,
              sourceId,
              spec: specResult,
            },
            runtimeContext,
          });

          // Success!
          sendEvent('complete', {
            previewId: persistResult.previewId,
            versionId: persistResult.versionId,
          });

          controller.close();
        } catch (error) {
          const message = `event: error\ndata: ${JSON.stringify({
            message: error instanceof Error ? error.message : 'Unknown error',
          })}\n\n`;
          controller.enqueue(encoder.encode(message));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in platform route:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
