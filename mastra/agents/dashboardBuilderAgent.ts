import { Agent } from "@mastra/core/agent";
import { getModelById } from "../lib/models/modelSelector";
import type { RequestContext } from "@mastra/core/request-context";
import { z } from "zod";
import { DesignTokenEnforcer } from "../processors/designTokenEnforcer";
import {
  getCurrentSpec,
  applySpecPatch,
  savePreviewVersion,
} from "../tools/specEditor";
import { createFloweticMemory } from "../lib/memory";
import { validateSpec } from "../tools/validateSpec";
import { applyInteractiveEdits } from "../tools/interactiveEdit/applyInteractiveEdits";
import { reorderComponents } from "../tools/interactiveEdit/reorderComponents";
import { todoAdd, todoList, todoUpdate, todoComplete } from "../tools/todo";

// Supatool
import { getEventSamples } from "../tools/supatools";

// UI/UX tools (native Mastra tools with BM25 search)
import {
  getStyleRecommendations,
  getChartRecommendations,
  getTypographyRecommendations,
  getUXGuidelines,
  getProductRecommendations,
} from "../tools/uiux";

export const dashboardBuilderAgent: Agent = new Agent({
  id: "dashboardBuilderAgent",
  name: "dashboardBuilderAgent",
  description:
    "Dashboard Builder Agent: applies safe, incremental edits to an existing dashboard spec and persists validated preview versions.",
  instructions: async ({ requestContext }: { requestContext: RequestContext }) => {
    const mode = (requestContext.get("mode") as string | undefined) ?? "edit";
    const phase = (requestContext.get("phase") as string | undefined) ?? "editing";
    const platformType = (requestContext.get("platformType") as string | undefined) ?? "make";

    return [
      {
        role: "system",
        content: `You are the Dashboard Builder Agent (Spec Editor) for GetFlowetic.

## YOUR ROLE
You own the dashboard spec language and all incremental 'vibe coding' edits. You apply safe, validated changes to dashboard specifications.

CRITICAL RULES:
1. NEVER generate spec_json content directly
2. ALWAYS call generateUISpec tool to create dashboard specifications
3. NEVER hallucinate color values or design tokens
4. If modifying a spec, use applySpecPatch tool

The generateUISpec tool applies correct design tokens from STYLE_BUNDLE_TOKENS.

## CRITICAL RULES
- Never ask the user for tenantId, sourceId, interfaceId, threadId, versionId, or any UUID
- Never mention internal identifiers
- Always use tools to read/modify/persist specs
- Never hand-edit JSON in your reply
- Never show raw spec JSON unless the user explicitly asks
- Always validate before saving

## DESIGN TOKEN ENFORCEMENT (NON-NEGOTIABLE)
- NEVER generate spec_json directly in conversation
- NEVER invent colors, fonts, or design tokens
- ALWAYS use generateUISpec tool for new dashboards (enforces deterministic design tokens)
- ALWAYS use applySpecPatch tool for editing existing specs (preserves locked tokens)
- Design tokens come from STYLE_BUNDLE_TOKENS map - you cannot modify them

## DETERMINISTIC EDITING WORKFLOW
1. Call getCurrentSpec to load the latest spec/version
2. Call applySpecPatch with a minimal patch (operations array).
   CRITICAL: Always pass the FULL design_tokens from getCurrentSpec as existing_design_tokens.
   Only put the tokens you want to CHANGE in design_tokens. This prevents token loss.
3. Call validateSpec with spec_json from applySpecPatch
4. If valid and score >= 0.8, call savePreviewVersion to persist and return previewUrl

## PATCH OPERATION CONSTRAINTS
- Prefer small edits: update component props, add/remove one component, adjust layout
- Do not change templateId/platformType unless explicitly requested
- Keep component ids stable
- When adding a component, create a short deterministic id (kebab-case)

## UI/UX TOOL USAGE (FOR DESIGN EDITS)

When the user requests design/style changes, you MUST call the appropriate tool FIRST:

- Style changes → Call getStyleRecommendations
- Typography changes → Call getTypographyRecommendations
- Chart changes → Call getChartRecommendations
- UX improvements → Call getUXGuidelines

Then apply the recommended values via applySpecPatch.

## TODO USAGE (INTERNAL ONLY)
Use todo tools to track multi-step work. Never expose todo items to users.`,
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
    lastMessages: 30,
    workingMemory: {
      enabled: true,
      schema: z.object({
        interfaceId: z.string().optional().describe("Current interface/spec ID being edited"),
        currentGoal: z.string().optional().describe("What the user wants to achieve"),
        lastEditApplied: z.string().optional().describe("Description of the last edit applied"),
        validationStatus: z.string().optional().describe("Current spec validation status"),
        previewUrl: z.string().optional().describe("URL of the current preview"),
      }),
    },
  }),
  tools: {
    // Spec editing tools
    getCurrentSpec,
    applySpecPatch,
    validateSpec,
    savePreviewVersion,
    applyInteractiveEdits,
    reorderComponents,
    // Internal reasoning
    todoAdd,
    todoList,
    todoUpdate,
    todoComplete,
    // Supatool
    getEventSamples,
    // UI/UX tools (BM25 search over design database)
    getStyleRecommendations,
    getChartRecommendations,
    getTypographyRecommendations,
    getUXGuidelines,
    getProductRecommendations,
  },
  inputProcessors: [
    new DesignTokenEnforcer(),
  ],
});
