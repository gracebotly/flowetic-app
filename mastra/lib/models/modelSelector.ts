import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { glm47Model } from "./glm47";

let didLogModel = false;

/**
 * Model configuration for Getflowetic
 * Uses AI SDK v5 provider factories for compatibility with Mastra v1.0.4
 * 
 * CRITICAL: Models are now LAZY (factory functions), not EAGER (pre-built instances)
 */
export type ModelId = "glm-4.7" | "gemini-3-pro-preview" | "claude-sonnet-4-5" | "gpt-5.2";

export interface ModelConfig {
  id: ModelId;
  displayName: string;
  provider: string;
  costTier: "cheap" | "medium" | "expensive";
  factory: () => any; // Factory function that returns model instance
}

/**
 * Available models for selection
 * Each model uses a factory function for lazy instantiation
 */
export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: "glm-4.7",
    displayName: "GLM 4.7",
    provider: "zai.chat",
    costTier: "cheap",
    factory: () => glm47Model(), // ✅ Lazy: called per-request
  },
  {
    id: "gemini-3-pro-preview",
    displayName: "Gemini 3 Pro",
    provider: "google",
    costTier: "expensive",
    factory: () => {
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!apiKey) {
        console.warn("[ModelSelector] GOOGLE_GENERATIVE_AI_API_KEY not set, Gemini will fail");
      }
      const google = createGoogleGenerativeAI({ apiKey });
      return google("gemini-3-pro-preview");
    },
  },
  {
    id: "claude-sonnet-4-5",
    displayName: "Claude Sonnet 4.5",
    provider: "anthropic",
    costTier: "expensive",
    factory: () => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.warn("[ModelSelector] ANTHROPIC_API_KEY not set, Claude will fail");
      }
      const provider = createAnthropic({ apiKey });
      return provider("claude-sonnet-4-5");
    },
  },
  {
    id: "gpt-5.2",
    displayName: "GPT 5.2",
    provider: "openai",
    costTier: "expensive",
    factory: () => {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.warn("[ModelSelector] OPENAI_API_KEY not set, GPT-5.2 will fail");
      }
      const provider = createOpenAI({ apiKey });
      return provider("gpt-5.2");
    },
  },
];

/**
 * Default model (cheap for testing)
 */
export const DEFAULT_MODEL_ID: ModelId = "glm-4.7";

/**
 * Get model instance by ID (lazy instantiation)
 * 
 * This is called PER-REQUEST by agents via RequestContext,
 * ensuring the selected model is used dynamically.
 */
export function getModelById(modelId: ModelId | string | undefined): any {
  const normalized = String(modelId || DEFAULT_MODEL_ID).trim() as ModelId;

  const config = AVAILABLE_MODELS.find(m => m.id === normalized);

  if (!config) {
    console.warn(`[ModelSelector] Unknown model ID "${normalized}", falling back to default`);
    const defaultConfig = AVAILABLE_MODELS[0]; // GLM 4.7
    return defaultConfig.factory(); // ✅ Call factory
  }

  if (!didLogModel && process.env.NODE_ENV !== "production") {
    didLogModel = true;
    console.log(`[ModelSelector] Using model: ${config.displayName} (${config.id})`);
  }
  return config.factory(); // ✅ Call factory function to create fresh instance
}

/**
 * Get model display name by ID
 */
export function getModelDisplayName(modelId: ModelId | string | undefined): string {
  const normalized = String(modelId || DEFAULT_MODEL_ID).trim() as ModelId;

  const config = AVAILABLE_MODELS.find(m => m.id === normalized);

  return config?.displayName || "GLM 4.7";
}
