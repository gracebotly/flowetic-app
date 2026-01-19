import type { PlatformType } from "./skillContent";
import { getPlatformSkillMarkdown, getNamedSkillMarkdown } from "./skillContent";

export type { PlatformType };

export async function loadSkill(platformType: PlatformType): Promise<string> {
  return getPlatformSkillMarkdown(platformType);
}

export async function loadNamedSkillMarkdown(skillKey: string): Promise<string> {
  return getNamedSkillMarkdown(skillKey);
}

export const loadSkillMarkdown = loadSkill;

