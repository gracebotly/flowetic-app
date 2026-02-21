
import { Agent } from "@mastra/core/agent";
import { getModelById } from "../lib/models/modelSelector";
import type { RequestContext } from "@mastra/core/request-context";
import { z } from "zod";
import { createFloweticMemory } from "../lib/memory";
import { TokenLimiterProcessor } from "@mastra/core/processors";

// Supatool
import { recommendStyleKeywords } from "../tools/supatools";

// UI/UX tools (native Mastra tools with BM25 search)
import {
  getStyleRecommendations,
  getChartRecommendations,
  getTypographyRecommendations,
  getUXGuidelines,
  getProductRecommendations,
  getColorRecommendations,
  getIconRecommendations,
  getLandingPagePatterns,
  getWebInterfaceGuidelines,
  getReactPerformanceGuidelines,
  getUIReasoningPatterns,
} from "../tools/uiux";

export const designAdvisorAgent: Agent = new Agent({
  id: "designAdvisorAgent",
  name: "designAdvisorAgent",
  description:
    "Design Advisor Agent: UI/UX guidance powered by BM25 search over design databases. " +
    "Generates style recommendations, typography pairings, chart suggestions, and UX guidelines.",
  instructions: async ({ requestContext }: { requestContext: RequestContext }) => {
    const mode = (requestContext.get("mode") as string | undefined) ?? "edit";
    const phase = (requestContext.get("phase") as string | undefined) ?? "editing";
    const platformType = (requestContext.get("platformType") as string | undefined) ?? "make";

    return [
      {
        role: "system",
        content: `You are the Design Advisor Agent for GetFlowetic.

## YOUR ROLE
You provide expert UI/UX guidance for dashboard design. You have access to a comprehensive design database with 67+ styles, 57+ typography pairings, 25+ chart types, and 98+ UX guidelines.

## MANDATORY TOOL USAGE (CRITICAL)

⚠️ You MUST call design tools BEFORE providing ANY recommendations.
⚠️ NEVER generate style, color, typography, or chart advice from memory.
⚠️ ALWAYS base recommendations on actual tool query results.

### REQUIRED WORKFLOW:
1. For style questions → Call getStyleRecommendations FIRST
2. For typography questions → Call getTypographyRecommendations FIRST
3. For chart/visualization questions → Call getChartRecommendations FIRST
4. For UX best practices → Call getUXGuidelines FIRST
5. For industry-specific patterns → Call getProductRecommendations FIRST

### VALIDATION:
- Your response is INVALID if you haven't called at least ONE design tool
- Reference specific values from tool results: style names, hex codes, font names
- Do NOT invent design values - use ONLY what tools return

## TOOL DESCRIPTIONS

### getStyleRecommendations
Search 67+ UI styles. Query with: product type, industry, mood keywords.
Examples: "fintech dashboard minimal", "healthcare monitoring dark", "startup saas bold"

### getTypographyRecommendations
Search 57+ font pairings. Query with: style, mood, use case.
Examples: "professional corporate", "modern tech", "friendly approachable"

### getChartRecommendations
Search 25+ chart types. Query with: data pattern, visualization goal.
Examples: "time series trend", "comparison categories", "part-to-whole"

### getProductRecommendations
Search industry-specific patterns. Query with: product/industry type.
Examples: "crm dashboard", "voice ai analytics", "workflow automation"

### getUXGuidelines
Search 98+ UX best practices. Query with: category, platform.
Examples: "mobile navigation", "form validation", "accessibility"

## RESPONSE FORMAT
After calling tools, synthesize results into clear recommendations:
- Reference specific style names, hex codes, font names from results
- Explain WHY the recommendation fits the user's context
- Keep recommendations concise and actionable

## CRITICAL RULES
- Never ask for tenantId, sourceId, interfaceId, or any UUID
- Never mention internal identifiers or tool names to users
- Never invent design values - always use tool results
- If tools return empty, say "I couldn't find specific matches" and suggest broadening the query`,
      },
      {
        role: "system",
        content: `Current context: Mode=${mode}, Phase=${phase}, Platform=${platformType}`,
      },
    ];
  },
  model: ({ requestContext }: { requestContext: RequestContext }) => {
    const selectedModelId = requestContext.get("selectedModel") as string | undefined;
    return getModelById(selectedModelId);
  },
  memory: createFloweticMemory({
    lastMessages: 10,
    workingMemory: {
      enabled: true,
      schema: z.object({
        styleDirection: z.string().optional().describe("Design style direction (e.g., premium, minimal, bold)"),
        audience: z.string().optional().describe("Target audience for the design (e.g., law firm, healthcare, startup)"),
        density: z.string().optional().describe("Layout density preference"),
        palette: z.string().optional().describe("Color palette preferences"),
        typographyNotes: z.string().optional().describe("Typography and font preferences"),
      }),
    },
  }),
  tools: {
    // Supatool
    recommendStyleKeywords,
    // UI/UX tools (BM25 search over design database)
    getStyleRecommendations,
    getChartRecommendations,
    getTypographyRecommendations,
    getUXGuidelines,
    getProductRecommendations,
    getColorRecommendations,
    getIconRecommendations,
    getLandingPagePatterns,
    getWebInterfaceGuidelines,
    getReactPerformanceGuidelines,
    getUIReasoningPatterns,
  },
  inputProcessors: [
    new TokenLimiterProcessor({ limit: 10000 }),
  ],
});
