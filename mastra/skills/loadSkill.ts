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
 * Searches multiple possible locations for skill files:
 * 1. Production: .mastra/output/public/skills/{platform}/Skill.md (where Mastra copies public/ during build)
 * 2. Dev: mastra/public/skills/{platform}/Skill.md (source location)
 * Falls back to "make" skill if platform-specific skill not found.
 */
export async function loadSkill(platformType: PlatformType): Promise<string> {
  const safePlatform = platformType || "make";
  
  // Possible paths in priority order
  const possiblePaths = [
    // Production/Studio path (Mastra copies public/ to output/public/)
    path.join(process.cwd(), "public", "skills", safePlatform, "Skill.md"),
    
    // Dev path (running from project root with mastra dev)
    path.join(process.cwd(), "mastra", "public", "skills", safePlatform, "Skill.md"),
    
    // Fallback to "make" skill in production
    path.join(process.cwd(), "public", "skills", "make", "Skill.md"),
    
    // Fallback to "make" skill in dev
    path.join(process.cwd(), "mastra", "public", "skills", "make", "Skill.md"),
  ];

  for (const skillPath of possiblePaths) {
    try {
      const content = await fs.readFile(skillPath, "utf8");
      return content;
    } catch {
      // Path doesn't exist, try next one
      continue;
    }
  }

  // If all paths fail, log warning and return empty string
  console.warn(`[loadSkill] Could not find skill for platform: ${safePlatform}`);
  return "";
}

/**
 * Load skill markdown by skill key (name).
 * Used for loading skills by name rather than platform type.
 */
export async function loadNamedSkillMarkdown(skillKey: string): Promise<string> {
  const safeKey = String(skillKey || "").trim();
  if (!safeKey) return "";

  const possiblePaths = [
    // Production/Studio path
    path.join(process.cwd(), "public", "skills", safeKey, "Skill.md"),
    
    // Dev path
    path.join(process.cwd(), "mastra", "public", "skills", safeKey, "Skill.md"),
  ];

  for (const skillPath of possiblePaths) {
    try {
      const content = await fs.readFile(skillPath, "utf8");
      return content;
    } catch {
      continue;
    }
  }

  console.warn(`[loadNamedSkillMarkdown] Could not find skill: ${safeKey}`);
  return "";
}

// Backwards-compatible alias
export const loadSkillMarkdown = loadSkill;

