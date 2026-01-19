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

async function readFirstExisting(pathsToTry: string[]): Promise<string> {
  for (const p of pathsToTry) {
    try {
      return await fs.readFile(p, "utf8");
    } catch {
      // continue
    }
  }
  throw new Error(
    `Skill markdown not found. Tried:\n${pathsToTry.map((p) => `- ${p}`).join("\n")}`,
  );
}

export async function loadSkill(platformType: PlatformType): Promise<string> {
  const safePlatform: PlatformType = (platformType || "make") as PlatformType;

  const cwd = process.cwd();

  // When you run: mastra dev --dir ./mastra
  // Mastra copies ./mastra/public -> .mastra/output during build/dev.
  // But the bundle we observed is still using process.cwd() resolution,
  // so we make both locations work.
  const mastraPublicSkill = path.join(cwd, "mastra", "public", "skills", safePlatform, "Skill.md");
  const legacySkill = path.join(cwd, "skills", safePlatform, "Skill.md");

  const mastraPublicFallback = path.join(cwd, "mastra", "public", "skills", "make", "Skill.md");
  const legacyFallback = path.join(cwd, "skills", "make", "Skill.md");

  return readFirstExisting([
    mastraPublicSkill,
    legacySkill,
    mastraPublicFallback,
    legacyFallback,
  ]);
}

export async function loadNamedSkillMarkdown(skillKey: string): Promise<string> {
  const safeKey = String(skillKey || "").trim();
  if (!safeKey) return "";

  const cwd = process.cwd();

  const mastraPublicPrimary = path.join(cwd, "mastra", "public", "skills", safeKey, "SKILL.md");
  const mastraPublicSecondary = path.join(cwd, "mastra", "public", "skills", safeKey, "Skill.md");

  const legacyPrimary = path.join(cwd, "skills", safeKey, "SKILL.md");
  const legacySecondary = path.join(cwd, "skills", safeKey, "Skill.md");

  try {
    return await readFirstExisting([
      mastraPublicPrimary,
      mastraPublicSecondary,
      legacyPrimary,
      legacySecondary,
    ]);
  } catch {
    return "";
  }
}

export const loadSkillMarkdown = loadSkill;

