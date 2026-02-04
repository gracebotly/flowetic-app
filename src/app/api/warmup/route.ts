import { getMastraSingleton } from '@/mastra/singleton';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Warmup endpoint to pre-initialize Mastra singleton.
 * Can be called by Vercel cron or external monitoring.
 *
 * Usage: GET /api/warmup
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // Initialize Mastra singleton
    const mastra = getMastraSingleton();

    // Verify it's working by getting an agent
    const agent = mastra.getAgent('masterRouterAgent');

    const duration = Date.now() - startTime;

    return NextResponse.json({
      ok: true,
      warmed: true,
      duration: `${duration}ms`,
      agentReady: !!agent,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message,
      duration: `${Date.now() - startTime}ms`,
    }, { status: 500 });
  }
}
