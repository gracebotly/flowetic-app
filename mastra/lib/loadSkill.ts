import { workspace } from '../workspace';

/**
 * Load a skill's instructions from the workspace.
 * Returns empty string if skill not found (graceful degradation).
 *
 * @param skillName - The skill folder name (e.g., 'n8n', 'ui-ux-pro-max', 'business-outcomes-advisor')
 * @returns The skill's SKILL.md content, or empty string if not found
 */
export async function loadSkillFromWorkspace(skillName: string): Promise<string> {
  try {
    if (!workspace.skills) {
      console.warn(`[loadSkill] Workspace skills not configured`);
      return "";
    }

    const skill = await workspace.skills.get(skillName);

    if (!skill?.instructions) {
      console.warn(`[loadSkill] Skill '${skillName}' not found or has no instructions`);
      return "";
    }

    console.log(`[loadSkill] Loaded '${skillName}' skill (${skill.instructions.length} chars)`);
    return skill.instructions;
  } catch (error) {
    console.error(`[loadSkill] Failed to load '${skillName}' skill:`, error);
    return "";
  }
}
