import { getMastra } from './index';

type MastraInstance = ReturnType<typeof getMastra>;

let mastraInstance: MastraInstance | null = null;

/**
 * Singleton pattern for Mastra instance.
 * Reuses existing instance to avoid ~15s cold boot time on each request.
 */
export function getMastraSingleton(): MastraInstance {
  if (mastraInstance) {
    return mastraInstance;
  }

  console.log('[Mastra] Creating singleton instance...');
  const startTime = Date.now();

  mastraInstance = getMastra();

  console.log(`[Mastra] Singleton ready in ${Date.now() - startTime}ms`);
  return mastraInstance;
}

/**
 * Optional: Pre-warm the Mastra instance.
 */
export function warmupMastra(): void {
  getMastraSingleton();
}
