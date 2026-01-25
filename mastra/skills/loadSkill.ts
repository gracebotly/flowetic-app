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
  baseDirectory: string;
  relativeDirectory: string;
};

export type LoadedSkill = {
  content: string;
  metadata: SkillMetadata;
};

function parseYamlFrontmatter(md: string): { attributes: Record<string, string>; body: string } {
  const trimmed = md.startsWith('\uFEFF') ? md.slice(1) : md;

  if (!trimmed.startsWith('---\n') && !trimmed.startsWith('---\r\n')) {
    return { attributes: {}, body: md };
  }

  const lines = trimmed.split(/\r?\n/);
  if (lines[0] !== '---') return { attributes: {}, body: md };

  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) return { attributes: {}, body: md };

  const fmLines = lines.slice(1, endIdx);
  const body = lines.slice(endIdx + 1).join('\n');

  const attributes: Record<string, string> = {};
  for (const line of fmLines) {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1]!;
    let val = m[2] ?? '';
    val = val.trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    attributes[key] = val;
  }

  return { attributes, body };
}

/**
 * Load skill markdown for a given platform type.
 * Skills are now located in .agent/skills/ (unified skill system)
 */
export async function loadSkill(platformType: PlatformType): Promise<LoadedSkill> {
  const safePlatform = platformType || "make";
  const relativeDirectory = path.join(".agent", "skills", safePlatform);
  const baseDirectory = path.join(process.cwd(), relativeDirectory);
  const skillPath = path.join(baseDirectory, "SKILL.md");

  try {
    const content = await fs.readFile(skillPath, "utf8");
    const { attributes } = parseYamlFrontmatter(content);

    return {
      content,
      metadata: {
        name: attributes.name,
        description: attributes.description,
        baseDirectory,
        relativeDirectory,
      },
    };
  } catch {
    const makeRelativeDirectory = path.join(".agent", "skills", "make");
    const makeBaseDirectory = path.join(process.cwd(), makeRelativeDirectory);
    const makePath = path.join(makeBaseDirectory, "SKILL.md");

    try {
      const content = await fs.readFile(makePath, "utf8");
      const { attributes } = parseYamlFrontmatter(content);

      return {
        content,
        metadata: {
          name: attributes.name,
          description: attributes.description,
          baseDirectory: makeBaseDirectory,
          relativeDirectory: makeRelativeDirectory,
        },
      };
    } catch {
      console.warn(`[loadSkill] Could not find skill for platform: ${safePlatform}`);
      return {
        content: "",
        metadata: {
          baseDirectory,
          relativeDirectory,
        },
      };
    }
  }
}

/**
 * Load skill markdown by skill key (name).
 */
export async function loadNamedSkillMarkdown(skillKey: string): Promise<LoadedSkill> {
  const safeKey = String(skillKey || "").trim();
  if (!safeKey) {
    return {
      content: "",
      metadata: {
        baseDirectory: path.join(process.cwd(), ".agent", "skills"),
        relativeDirectory: path.join(".agent", "skills"),
      },
    };
  }

  const relativeDirectory = path.join(".agent", "skills", safeKey);
  const baseDirectory = path.join(process.cwd(), relativeDirectory);
  const skillPath = path.join(baseDirectory, "SKILL.md");

  try {
    const content = await fs.readFile(skillPath, "utf8");
    const { attributes } = parseYamlFrontmatter(content);

    return {
      content,
      metadata: {
        name: attributes.name,
        description: attributes.description,
        baseDirectory,
        relativeDirectory,
      },
    };
  } catch {
    console.warn(`[loadNamedSkillMarkdown] Could not find skill: ${safeKey}`);
    return {
      content: "",
      metadata: {
        baseDirectory,
        relativeDirectory,
      },
    };
  }
}

// Backwards-compatible alias
export async function loadSkillMarkdown(platformType: PlatformType): Promise<string> {
  const res = await loadSkill(platformType);
  return res.content;
}

