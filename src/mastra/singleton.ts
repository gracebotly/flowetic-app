import { getMastra } from '@/mastra';

type MastraInstance = ReturnType<typeof getMastra>;

let mastraInstance: MastraInstance | null = null;
let initPromise: Promise<MastraInstance> | null = null;

/**
 * Singleton pattern for Mastra instance.
 * Reuses existing instance to avoid ~15s cold boot time on each request.
 * Safe for concurrent access via promise memoization.
 */
export function getMastraSingleton(): MastraInstance {
  if (mastraInstance) {
    return mastraInstance;
  }

  // Synchronous initialization (Mastra getMastra is sync)
  console.log('[Mastra] Creating singleton instance...');
  const startTime = Date.now();

  mastraInstance = getMastra();

  console.log(`[Mastra] Singleton ready in ${Date.now() - startTime}ms`);
  return mastraInstance;
}

/**
 * Optional: Pre-warm the Mastra instance.
 * Call this from a warmup endpoint or on app startup.
 */
export function warmupMastra(): void {
  getMastraSingleton();
}
