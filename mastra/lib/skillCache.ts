/**
 * Module-level skill cache for Vercel serverless.
 *
 * Skills are cached in memory after first load. In Vercel serverless,
 * module-scope variables persist across warm invocations, so skills
 * only load from disk once per cold start.
 *
 * @see https://vercel.com/docs/functions/concepts (module variable persistence)
 */

import { workspace } from '../workspace';

// Module-level cache - persists across warm invocations
const skillCache = new Map<string, string>();

// Skills to preload on cold start (most commonly used)
const PRELOAD_SKILLS = ['ui-ux-pro-max', 'n8n', 'business-outcomes-advisor'];

/**
 * Get skill content with caching.
 * First call loads from workspace, subsequent calls return cached content.
 */
export function getCachedSkill(skillName: string): string {
  const cached = skillCache.get(skillName);
  if (cached !== undefined) {
    return cached;
  }

  // Not cached - load synchronously and cache
  try {
    const skill = workspace.skills?.getSync?.(skillName);
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
  }
}

/**
 * Async version for backward compatibility.
 * Still uses cache but supports async workspace API.
 */
export async function getCachedSkillAsync(skillName: string): Promise<string> {
  const cached = skillCache.get(skillName);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const skill = await workspace.skills?.get(skillName);
    const content = skill?.instructions || '';
    skillCache.set(skillName, content);

    if (content) {
      console.log(`[SkillCache] Loaded '${skillName}' (${content.length} chars) - now cached`);
    }

    return content;
  } catch (error) {
    console.error(`[SkillCache] Failed to load '${skillName}':`, error);
    skillCache.set(skillName, '');
    return '';
  }
}

/**
 * Preload commonly used skills on module initialization.
 * This runs once on cold start.
 */
export function preloadSkills(): void {
  console.log('[SkillCache] Preloading skills on cold start...');
  for (const skillName of PRELOAD_SKILLS) {
    getCachedSkillAsync(skillName).catch(() => {
      // Errors already logged in getCachedSkillAsync
    });
  }
}

/**
 * Clear cache (useful for testing or forced refresh).
 */
export function clearSkillCache(): void {
  skillCache.clear();
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

// Preload on module initialization (cold start)
preloadSkills();
