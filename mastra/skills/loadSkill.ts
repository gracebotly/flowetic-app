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

export type SkillMetadata = {
  name?: string;
  description?: string;
  baseDirectory?: string;
};

export type LoadSkillResult = {
  content: string;
  metadata?: SkillMetadata;
};

/**
 * Load skill markdown for a given platform type.
 * Skills are now located in .agent/skills/ (unified skill system)
 */
export async function loadSkill(platformType: PlatformType): Promise<LoadSkillResult> {
  const safePlatform = platformType || "make";
  const skillBaseDir = path.join(process.cwd(), ".agent", "skills", safePlatform);
  
  try {
    const skillPath = path.join(skillBaseDir, "SKILL.md");
    const content = await fs.readFile(skillPath, "utf8");
    
    // Parse YAML frontmatter
    const frontmatter = parseFrontmatter(content);
    const metadata: SkillMetadata = {
      name: frontmatter.name,
      description: frontmatter.description,
      baseDirectory: skillBaseDir,
    };
    
    return { content, metadata };
  } catch {
    // Fallback to "make" skill
    const makeBaseDir = path.join(process.cwd(), ".agent", "skills", "make");
    const makePath = path.join(makeBaseDir, "SKILL.md");
    try {
      const content = await fs.readFile(makePath, "utf8");
      const frontmatter = parseFrontmatter(content);
      const metadata: SkillMetadata = {
        name: frontmatter.name,
        description: frontmatter.description,
        baseDirectory: makeBaseDir,
      };
      return { content, metadata };
    } catch {
      console.warn(`[loadSkill] Could not find skill for platform: ${safePlatform}`);
      return { content: "", metadata: undefined };
    }
  }
}

/**
 * Load skill markdown by skill key (name).
 */
export async function loadNamedSkillMarkdown(skillKey: string): Promise<LoadSkillResult> {
  const safeKey = String(skillKey || "").trim();
  if (!safeKey) return { content: "", metadata: undefined };

  const skillBaseDir = path.join(process.cwd(), ".agent", "skills", safeKey);

  try {
    const skillPath = path.join(skillBaseDir, "SKILL.md");
    const content = await fs.readFile(skillPath, "utf8");
    
    // Parse YAML frontmatter
    const frontmatter = parseFrontmatter(content);
    const metadata: SkillMetadata = {
      name: frontmatter.name,
      description: frontmatter.description,
      baseDirectory: skillBaseDir,
    };
    
    return { content, metadata };
  } catch {
    console.warn(`[loadNamedSkillMarkdown] Could not find skill: ${safeKey}`);
    return { content: "", metadata: undefined };
  }
}

// Backwards-compatible alias
export const loadSkillMarkdown = loadSkill;

function parseFrontmatter(content: string): { name?: string; description?: string } {
  const lines = content.split('\n');
  const frontmatterEnd = lines.indexOf('---', 1); // Find second ---
  
  if (frontmatterEnd === -1 || lines[0] !== '---') {
    return {}; // No frontmatter found
  }
  
  const frontmatterText = lines.slice(1, frontmatterEnd).join('\n');
  const metadata: any = {};
  
  for (const line of frontmatterText.split('\n')) {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (match) {
      const key = match[1];
      let value = match[2]?.trim();
      
      // Remove quotes if present
      if (value?.startsWith('"') && value?.endsWith('"')) {
        value = value.slice(1, -1);
      }
      
      metadata[key] = value;
    }
  }
  
  return metadata;
}

