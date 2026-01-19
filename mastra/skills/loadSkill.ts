import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type PlatformType =
  | "vapi"
  | "retell"
  | "n8n"
  | "mastra"
  | "crewai"
  | "activepieces"
  | "make";

function getRepoRootFromThisFile(): string {
  // mastra/skills/loadSkill.ts  -> repo root is ../../
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, "..", "..");
}

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

  const repoRoot = getRepoRootFromThisFile();

  // 1) Preferred, build-compatible location (Mastra build copies src/mastra/public -> .mastra/output)
  const publicSkillPath = path.join(
    repoRoot,
    "src",
    "mastra",
    "public",
    "skills",
    safePlatform,
    "Skill.md",
  );

  // 2) Back-compat: existing repo-root skills folder (useful in dev / local runs)
  const legacySkillPath = path.join(repoRoot, "skills", safePlatform, "Skill.md");

  // 3) Fallback to make
  const publicFallback = path.join(
    repoRoot,
    "src",
    "mastra",
    "public",
    "skills",
    "make",
    "Skill.md",
  );
  const legacyFallback = path.join(repoRoot, "skills", "make", "Skill.md");

  return readFirstExisting([
    publicSkillPath,
    legacySkillPath,
    publicFallback,
    legacyFallback,
  ]);
}

export async function loadNamedSkillMarkdown(skillKey: string): Promise<string> {
  const safeKey = String(skillKey || "").trim();
  if (!safeKey) return "";

  const repoRoot = getRepoRootFromThisFile();

  // Prefer Mastra-public folder first
  const publicPrimary = path.join(
    repoRoot,
    "src",
    "mastra",
    "public",
    "skills",
    safeKey,
    "SKILL.md",
  );
  const publicSecondary = path.join(
    repoRoot,
    "src",
    "mastra",
    "public",
    "skills",
    safeKey,
    "Skill.md",
  );

  // Back-compat
  const legacyPrimary = path.join(repoRoot, "skills", safeKey, "SKILL.md");
  const legacySecondary = path.join(repoRoot, "skills", safeKey, "Skill.md");

  try {
    return await readFirstExisting([
      publicPrimary,
      publicSecondary,
      legacyPrimary,
      legacySecondary,
    ]);
  } catch {
    return "";
  }
}

// Backwards-compatible alias (older agents/tools may still import this name)
export const loadSkillMarkdown = loadSkill;

