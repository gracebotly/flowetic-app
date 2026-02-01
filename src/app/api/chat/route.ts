
import { handleChatStream } from '@mastra/ai-sdk';
import { createUIMessageStreamResponse } from 'ai';
import { RequestContext } from '@mastra/core/request-context';
import { getMastra } from '@/mastra';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const params = await req.json();

    const requestContext = new RequestContext();
    const data = (params as any)?.data ?? {};
    for (const [key, value] of Object.entries(data)) {
      requestContext.set(key, value as any);
    }

    const enhancedParams = {
      ...params,
      requestContext,
    };

    const mastra = getMastra();

    // Helpful debug: confirm context keys present
    if (process.env.DEBUG_CHAT_ROUTE === 'true') {
      console.log('[api/chat] agentId=masterRouterAgent');
      console.log('[api/chat] data keys:', Object.keys(data));
      console.log('[api/chat] messages length:', Array.isArray((params as any)?.messages) ? (params as any).messages.length : 'missing');
    }

    const stream = await handleChatStream({
      mastra,
      agentId: 'masterRouterAgent',
      params: enhancedParams,
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error('[api/chat] error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process chat request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

