




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

export async function loadSkill(platformType: PlatformType): Promise<string> {
  const safePlatform: PlatformType = platformType || "make";
  const skillPath = path.join(process.cwd(), "skills", safePlatform, "Skill.md");

  try {
    return await fs.readFile(skillPath, "utf8");
  } catch {
    const fallbackPath = path.join(process.cwd(), "skills", "make", "Skill.md");
    return await fs.readFile(fallbackPath, "utf8");
  }
}

export async function loadNamedSkillMarkdown(skillKey: string): Promise<string> {
  const safeKey = String(skillKey || "").trim();
  if (!safeKey) return "";

  // Prefer the new advisor skill file naming convention (uppercase SKILL.md)
  const primary = path.join(process.cwd(), "skills", safeKey, "SKILL.md");
  const secondary = path.join(process.cwd(), "skills", safeKey, "Skill.md");

  try {
    return await fs.readFile(primary, "utf8");
  } catch {
    try {
      return await fs.readFile(secondary, "utf8");
    } catch {
      return "";
    }
  }
}

// Backwards-compatible alias (older agents/tools may still import this name)
export const loadSkillMarkdown = loadSkill;




