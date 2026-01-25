import fs from "node:fs/promises";
import path from "node:path";

export type PlatformType =
  | "vapi"
  | "retell"
  | "n8n"
  | "mastra"
  | "crewai"
  | "activepieces"
  | "make"
  | "ui-ux-pro-max";

/**
 * Load skill markdown for a given platform type.
 * Skills are now located in .agent/skills/ (unified skill system)
 */
export async function loadSkill(platformType: PlatformType): Promise<string> {
  const safePlatform = platformType || "make";
  
  const skillPath = path.join(process.cwd(), ".agent", "skills", safePlatform, "SKILL.md");

  try {
    return await fs.readFile(skillPath, "utf8");
  } catch {
    // Fallback to "make" skill
    const makePath = path.join(process.cwd(), ".agent", "skills", "make", "SKILL.md");
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

  const skillPath = path.join(process.cwd(), ".agent", "skills", safeKey, "SKILL.md");

  try {
    return await fs.readFile(skillPath, "utf8");
  } catch {
    console.warn(`[loadNamedSkillMarkdown] Could not find skill: ${safeKey}`);
    return "";
  }
}

// Backwards-compatible alias
export const loadSkillMarkdown = loadSkill;

