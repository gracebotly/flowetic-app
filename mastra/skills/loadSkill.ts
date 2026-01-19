


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
  
  // Try bundled path first (when running in Mastra Studio)
  const bundledPath = path.join(process.cwd(), ".mastra", "output", "skills", safePlatform, "Skill.md");
  // Fallback to source path (when running in Next.js)
  const sourcePath = path.join(process.cwd(), "mastra", "skills", safePlatform, "Skill.md");

  try {
    return await fs.readFile(bundledPath, "utf8");
  } catch {
    try {
      return await fs.readFile(sourcePath, "utf8");
    } catch {
      // Final fallback to "make" platform
      const fallbackBundled = path.join(process.cwd(), ".mastra", "output", "skills", "make", "Skill.md");
      const fallbackSource = path.join(process.cwd(), "mastra", "skills", "make", "Skill.md");
      try {
        return await fs.readFile(fallbackBundled, "utf8");
      } catch {
        return await fs.readFile(fallbackSource, "utf8");
      }
    }
  }
}

export async function loadNamedSkillMarkdown(skillKey: string): Promise<string> {
  const safeKey = String(skillKey || "").trim();
  if (!safeKey) return "";

  // Try bundled paths first (when running in Mastra Studio)
  const bundledPrimary = path.join(process.cwd(), ".mastra", "output", "skills", safeKey, "SKILL.md");
  const bundledSecondary = path.join(process.cwd(), ".mastra", "output", "skills", safeKey, "Skill.md");
  
  // Fallback to source paths (when running in Next.js)
  const sourcePrimary = path.join(process.cwd(), "mastra", "skills", safeKey, "SKILL.md");
  const sourceSecondary = path.join(process.cwd(), "mastra", "skills", safeKey, "Skill.md");

  try {
    return await fs.readFile(bundledPrimary, "utf8");
  } catch {
    try {
      return await fs.readFile(bundledSecondary, "utf8");
    } catch {
      try {
        return await fs.readFile(sourcePrimary, "utf8");
      } catch {
        try {
          return await fs.readFile(sourceSecondary, "utf8");
        } catch {
          return "";
        }
      }
    }
  }
}

// Backwards-compatible alias (older agents/tools may still import this name)
export const loadSkillMarkdown = loadSkill;

