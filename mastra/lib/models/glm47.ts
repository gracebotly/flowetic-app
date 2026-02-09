

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !String(v).trim()) throw new Error(`Missing required env var: ${name}`);
  return String(v);
}

export function glm47Model() {
  // Route through OpenRouter for multi-provider redundancy
  // Direct Z.ai API has known connectivity issues from Vercel serverless
  // (UND_ERR_CONNECT_TIMEOUT due to undocumented concurrency limit + latency)
  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim() || requireEnv("OPENROUTER_API_KEY");
  const baseURL = "https://openrouter.ai/api/v1";

  const provider = createOpenAICompatible({
    name: "openrouter",
    apiKey,
    baseURL,
  });

  return provider("z-ai/glm-4.7");
}

