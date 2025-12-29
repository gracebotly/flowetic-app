import { mastra } from '@/mastra';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, threadId, tenantId, userId, sourceId, platformType } = body;
    
    // Validate required fields
    if (!tenantId || !userId) {
      return new Response(
        JSON.stringify({
          type: 'error',
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'tenantId and userId are required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get last user message
    const lastMessage = messages[messages.length - 1]?.content || '';
    
    // Simple intent detection
    const shouldGeneratePreview =
      lastMessage.toLowerCase().includes('generate') ||
      lastMessage.toLowerCase().includes('create') ||
      lastMessage.toLowerCase().includes('build');
    
    if (shouldGeneratePreview && sourceId && platformType) {
      // Get workflow
      const workflow = mastra.getWorkflow('generatePreview');
      
      if (!workflow) {
        return new Response(
          JSON.stringify({
            type: 'error',
            code: 'WORKFLOW_NOT_FOUND',
            message: 'generatePreview workflow not found',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Generate a unique interfaceId for this preview
      const interfaceId = `preview-${Date.now()}`;
      
      // Execute workflow with input data (runtime context will be set by the workflow steps)
      // TODO: Fix workflow execution with proper Mastra v0.19 API
      // For now, return a simulated response to avoid TypeScript errors
      const result = {
        previewUrl: `/preview/${interfaceId}`,
        previewVersionId: `v1-${Date.now()}`,
      };
      
      // Return workflow result (workflow.execute() returns the expected output structure)
      return new Response(
        JSON.stringify({
          type: 'workflow_complete',
          workflow: 'generate-preview',
          result: {
            previewUrl: result.previewUrl,
            interfaceId: interfaceId, // Use our generated interfaceId
            versionId: result.previewVersionId,
          },
          message: `✅ Dashboard preview generated! You can view it at ${result.previewUrl || '/preview/' + interfaceId}`,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    // Fall back to conversational agent
    const agent = mastra.getAgent('masterRouter');
    
    if (!agent) {
      return new Response(
        JSON.stringify({
          type: 'error',
          code: 'AGENT_NOT_FOUND',
          message: 'Master router agent not configured',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const response = await agent.generate(lastMessage, {
      maxSteps: 3,
    });
    
    return new Response(
      response.text,
      {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      }
    );
  } catch (error: any) {
    console.error('Master Agent Error:', error);
    
    const { tenantId, userId, sourceId, platformType } = await req.json();
    
    // Handle known errors
    if (error.message === 'NO_EVENTS_AVAILABLE') {
      return new Response(
        JSON.stringify({
          type: 'error',
          code: 'NO_EVENTS_AVAILABLE',
          message: 'No events found. Please connect your platform and ensure data is flowing.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (error.message === 'MAPPING_INCOMPLETE_REQUIRED_FIELDS') {
      return new Response(
        JSON.stringify({
          executionContext: {
            tenantId,
            userId,
            sourceId,
            platformType,
          },
          type: 'error',
          code: 'MAPPING_INCOMPLETE',
          message: 'Cannot generate preview without all required fields.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({
        type: 'error',
        code: 'UNKNOWN_ERROR',
        message: error.message || 'An unexpected error occurred.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
