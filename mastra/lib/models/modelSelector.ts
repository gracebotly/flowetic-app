import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { glm47Model } from "./glm47";

/**
 * Model configuration for Getflowetic
 * Uses AI SDK v5 provider factories for compatibility with Mastra v1.0.4
 */

export type ModelId = "glm-4.7" | "gemini-3-pro" | "claude-sonnet-4.5" | "gpt-5.2";

export interface ModelConfig {
  id: ModelId;
  displayName: string;
  provider: string;
  costTier: "cheap" | "medium" | "expensive";
  instance: any; // AI SDK v5 LanguageModel instance
}

// Initialize provider factories with API keys
function getOpenAIProvider() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[ModelSelector] OPENAI_API_KEY not set, GPT-5.2 will fail");
  }
  return createOpenAI({ apiKey });
}

function getAnthropicProvider() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[ModelSelector] ANTHROPIC_API_KEY not set, Claude will fail");
  }
  return createAnthropic({ apiKey });
}

function getGoogleProvider() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn("[ModelSelector] GOOGLE_API_KEY not set, Gemini will fail");
  }
  return createGoogle({ apiKey });
}

/**
 * Available models for selection
 * All use AI SDK v5 provider factories
 */
export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: "glm-4.7",
    displayName: "GLM 4.7",
    provider: "zai.chat",
    costTier: "cheap",
    instance: glm47Model(), // Already v5-compatible via createOpenAICompatible
  },
  {
    id: "gemini-3-pro",
    displayName: "Gemini 3 Pro",
    provider: "google",
    costTier: "expensive",
    instance: getGoogleProvider()("gemini-3-pro-preview"), // v5 model
  },
  {
    id: "claude-sonnet-4.5",
    displayName: "Claude Sonnet 4.5",
    provider: "anthropic",
    costTier: "expensive",
    instance: getAnthropicProvider()("claude-sonnet-4-5"), // v5 model
  },
  {
    id: "gpt-5.2",
    displayName: "GPT 5.2",
    provider: "openai",
    costTier: "expensive",
    instance: getOpenAIProvider()("gpt-5.2"), // v5 model
  },
];

/**
 * Default model (cheap for testing)
 */
export const DEFAULT_MODEL_ID: ModelId = "glm-4.7";

/**
 * Get model instance by ID
 */
export function getModelById(modelId: ModelId | string | undefined): any {
  const normalized = String(modelId || DEFAULT_MODEL_ID).trim() as ModelId;
  
  const config = AVAILABLE_MODELS.find(m => m.id === normalized);
  
  if (!config) {
    console.warn(`[ModelSelector] Unknown model ID "${normalized}", falling back to default`);
    return AVAILABLE_MODELS[0].instance; // GLM 4.7
  }
  
  return config.instance;
}

/**
 * Get model display name by ID
 */
export function getModelDisplayName(modelId: ModelId | string | undefined): string {
  const normalized = String(modelId || DEFAULT_MODEL_ID).trim() as ModelId;
  const config = AVAILABLE_MODELS.find(m => m.id === normalized);
  return config?.displayName || "GLM 4.7";
}
