import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { glm47Model } from "./glm47";

/**
 * Model configuration for Getflowetic
 * Supports 4 models: GLM 4.7 (default/cheap), Gemini 3 Pro, Claude Sonnet 4.5, GPT 5.2
 */

export type ModelId = "glm-4.7" | "gemini-3-pro" | "claude-sonnet-4.5" | "gpt-5.2";

export interface ModelConfig {
  id: ModelId;
  displayName: string;
  provider: string;
  costTier: "cheap" | "medium" | "expensive";
  instance: any; // AI SDK model instance
}

/**
 * Available models for selection
 * Order matches UI dropdown order
 */
export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: "glm-4.7",
    displayName: "GLM 4.7",
    provider: "zai.chat",
    costTier: "cheap",
    instance: glm47Model(), // Use existing implementation
  },
  {
    id: "gemini-3-pro",
    displayName: "Gemini 3 Pro",
    provider: "google",
    costTier: "expensive",
    instance: google("gemini-3-pro-preview"),
  },
  {
    id: "claude-sonnet-4.5",
    displayName: "Claude Sonnet 4.5",
    provider: "anthropic",
    costTier: "expensive",
    instance: anthropic("claude-sonnet-4-5"),
  },
  {
    id: "gpt-5.2",
    displayName: "GPT 5.2",
    provider: "openai",
    costTier: "expensive",
    instance: openai("gpt-5.2"),
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
