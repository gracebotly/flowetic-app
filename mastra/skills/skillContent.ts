

import makeSkill from "../public/skills/make/Skill.md?raw";
import activepiecesSkill from "../public/skills/activepieces/Skill.md?raw";
import n8nSkill from "../public/skills/n8n/Skill.md?raw";
import retellSkill from "../public/skills/retell/Skill.md?raw";
import todoSkill from "../public/skills/todo/Skill.md?raw";
import vapiSkill from "../public/skills/vapi/Skill.md?raw";

export type PlatformType =
  | "vapi"
  | "retell"
  | "n8n"
  | "mastra"
  | "crewai"
  | "activepieces"
  | "make";

const platformSkillMap: Record<string, string> = {
  make: makeSkill,
  activepieces: activepiecesSkill,
  n8n: n8nSkill,
  retell: retellSkill,
  todo: todoSkill,
  vapi: vapiSkill,
};

export function getPlatformSkillMarkdown(platformType: PlatformType): string {
  const key = (platformType || "make") as PlatformType;
  return platformSkillMap[key] || platformSkillMap.make || "";
}

export function getNamedSkillMarkdown(skillKey: string): string {
  const safeKey = String(skillKey || "").trim();
  if (!safeKey) return "";
  return platformSkillMap[safeKey] || "";
}

