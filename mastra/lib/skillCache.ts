/**
 * Module-level skill cache for Vercel serverless.
 * 
 * Skills are cached in memory after first load. In Vercel serverless,
 * module-scope variables persist across warm invocations, so skills
 * only load from disk once per cold start.
 */

import { workspace } from '../workspace';

// Module-level cache - persists across warm invocations
const skillCache = new Map<string, string>();

// Track in-flight promises to prevent duplicate loads
const loadingPromises = new Map<string, Promise<string>>();

/**
 * Get skill content with caching (async only - Mastra has no sync API).
 * First call loads from workspace, subsequent calls return cached content.
 */
export async function getCachedSkill(skillName: string): Promise<string> {
  // Return from cache if available
  const cached = skillCache.get(skillName);
  if (cached !== undefined) {
    return cached;
  }

  // If already loading, wait for that promise (prevent duplicate loads)
  const existingPromise = loadingPromises.get(skillName);
  if (existingPromise) {
    return existingPromise;
  }

  // Start loading
  const loadPromise = (async () => {
    try {
      if (!workspace.skills) {
        console.warn(`[SkillCache] Workspace skills not configured`);
        skillCache.set(skillName, '');
        return '';
      }

      const skill = await workspace.skills.get(skillName);
      const content = skill?.instructions || '';
      skillCache.set(skillName, content);

      if (content) {
        console.log(`[SkillCache] Loaded '${skillName}' (${content.length} chars) - now cached`);
      } else {
        console.warn(`[SkillCache] Skill '${skillName}' not found or empty`);
      }

      return content;
    } catch (error) {
      console.error(`[SkillCache] Failed to load '${skillName}':`, error);
      skillCache.set(skillName, ''); // Cache empty to prevent repeated failures
      return '';
    } finally {
      loadingPromises.delete(skillName);
    }
  })();

  loadingPromises.set(skillName, loadPromise);
  return loadPromise;
}

/**
 * Alias for backward compatibility with loadSkillFromWorkspace.
 */
export const getCachedSkillAsync = getCachedSkill;

/**
 * Clear cache (useful for testing or forced refresh).
 */
export function clearSkillCache(): void {
  skillCache.clear();
  loadingPromises.clear();
  console.log('[SkillCache] Cache cleared');
}

/**
 * Get cache stats for debugging.
 */
export function getSkillCacheStats(): { size: number; keys: string[] } {
  return {
    size: skillCache.size,
    keys: Array.from(skillCache.keys()),
  };
}
