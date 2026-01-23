import fs from "node:fs/promises";
import path from "node:path";

export type PlatformType =
  | "vapi"
  | "retell"
  | "n8n"
  | "mastra"
  | "crewai"
  | "activepieces"
  | "make";

/**
 * Load skill markdown for a given platform type.
 * Skills are copied to .mastra/output/skills/ by copy-skills.mjs
 */
export async function loadSkill(platformType: PlatformType): Promise<string> {
  const safePlatform = platformType || "make";
  
  const skillPath = path.join(process.cwd(), ".mastra", "output", "skills", safePlatform, "Skill.md");

  try {
    return await fs.readFile(skillPath, "utf8");
  } catch {
    // Fallback to "make" skill
    const makePath = path.join(process.cwd(), ".mastra", "output", "skills", "make", "Skill.md");
    try {
      return await fs.readFile(makePath, "utf8");
    } catch {
      console.warn(`[loadSkill] Could not find skill for platform: ${safePlatform}`);
      return "";
    }
  }
}

/**
 * Load skill markdown by skill key (name).
 */
export async function loadNamedSkillMarkdown(skillKey: string): Promise<string> {
  const safeKey = String(skillKey || "").trim();
  if (!safeKey) return "";

  const skillPath = path.join(process.cwd(), ".mastra", "output", "skills", safeKey, "Skill.md");

  try {
    return await fs.readFile(skillPath, "utf8");
  } catch {
    console.warn(`[loadNamedSkillMarkdown] Could not find skill: ${safeKey}`);
    return "";
  }
}

// Backwards-compatible alias
export const loadSkillMarkdown = loadSkill;

