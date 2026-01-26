

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !String(v).trim()) throw new Error(`Missing required env var: ${name}`);
  return String(v);
}

export function glm47Model() {
  const apiKey = (process.env.ZAI_API_KEY || "").trim() || requireEnv("ZAI_API_KEY");
  const baseURL = (process.env.ZAI_BASE_URL || "").trim() || "https://api.z.ai/api/paas/v4";

  const provider = createOpenAICompatible({
    name: "zai",
    apiKey,
    baseURL,
  });

  return provider("glm-4.7");
}

