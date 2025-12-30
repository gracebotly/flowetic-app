




import fs from "node:fs/promises";
import path from "node:path";

export type PlatformType =
  | "vapi"
  | "retell"
  | "n8n"
  | "mastra"
  | "crewai"
  | "pydantic_ai"
  | "other";

export async function loadSkill(platformType: PlatformType): Promise<string> {
  const safePlatform: PlatformType = platformType || "other";
  const skillPath = path.join(process.cwd(), "skills", safePlatform, "Skill.md");

  try {
    return await fs.readFile(skillPath, "utf8");
  } catch {
    const fallbackPath = path.join(process.cwd(), "skills", "other", "Skill.md");
    return await fs.readFile(fallbackPath, "utf8");
  }
}




