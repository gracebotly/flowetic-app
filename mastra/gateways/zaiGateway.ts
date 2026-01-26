import { MastraModelGateway } from "@mastra/core/llm";
import type { LanguageModelV2 } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !String(v).trim()) throw new Error(`Missing required env var: ${name}`);
  return String(v);
}

export class ZaiGateway extends MastraModelGateway {
  readonly gatewayId = "zai";
  readonly providerId = "zai";
  readonly models = ["glm-4.7"];

  async getModel(modelId: string): Promise<LanguageModelV2> {
    if (!this.models.includes(modelId)) {
      throw new Error(`Model ${modelId} not supported by ZAI gateway. Supported models: ${this.models.join(", ")}`);
    }

    const apiKey = (process.env.ZAI_API_KEY || "").trim() || requireEnv("ZAI_API_KEY");
    const baseURL = (process.env.ZAI_BASE_URL || "").trim() || "https://api.z.ai/api/paas/v4";

    const provider = createOpenAICompatible({
      name: "zai",
      apiKey,
      baseURL,
    });

    return provider(modelId);
  }
}