

import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { z } from "zod";
import { glm47Model } from "../lib/models/glm47";
import { getMastraStorage } from "../lib/storage";
import { getModelById } from "../lib/models/modelSelector";
import type { RequestContext } from "@mastra/core/request-context";
import type { PlatformType } from "../skills/loadSkill";
import { loadSkillMarkdown, loadNamedSkillMarkdown } from "../skills/loadSkill";
import { createFloweticMemory } from "../lib/memory";
import { platformMappingMaster } from "./platformMappingMaster";
import { dashboardBuilderAgent } from "./dashboardBuilderAgent";
import { designAdvisorAgent } from "./designAdvisorAgent";
import { generatePreviewWorkflow } from "../workflows/generatePreview";
import { connectionBackfillWorkflow } from "../workflows/connectionBackfill";
import { deployDashboardWorkflow } from "../workflows/deployDashboard";
import { todoAdd, todoList, todoUpdate, todoComplete } from "../tools/todo";
import { createSource, listSources, updateSource, deleteSource } from "../tools/sources";
import { createProject, listProjects, updateProject, deleteProject } from "../tools/projects";
import { navigateTo } from "../tools/navigation";
import {
  getStyleRecommendations,
  getChartRecommendations,
  getTypographyRecommendations,
  getUXGuidelines,
  getProductRecommendations,
} from "../tools/uiux";
import {
  getPhaseFromRequestContext,
  getPhaseInstructions,
  type FloweticPhase,
} from "./instructions/phase-instructions";

// NEW: Import Supatools
import {
  getEventStats,
  recommendOutcome,
  recommendStoryboard,
  validatePreviewReadiness,
} from "../tools/supatools";

export const masterRouterAgent: Agent = new Agent({
  id: "masterRouterAgent",
  name: "masterRouterAgent",
  description: "Master router agent that orchestrates sub-agents and workflows.",
  
  // NEW: Runtime-validated request context (Mastra 1.1.0 feature)
  requestContextSchema: z.object({
    // Identity (REQUIRED)
    tenantId: z.string().uuid(),
    userId: z.string().uuid(),
    userRole: z.enum(['admin', 'client', 'viewer']).optional(),
    
    // Thread context (REQUIRED)
    threadId: z.string(),
    resourceId: z.string(),
    journeyThreadId: z.string(),
    
    // Platform context (OPTIONAL)
    platformType: z.enum(['vapi', 'retell', 'n8n', 'make', 'mastra', 'crewai', 'pydantic_ai', 'other']).optional(),
    sourceId: z.string().uuid().optional(),
    entityId: z.string().optional(),
    externalId: z.string().optional(),
    displayName: z.string().optional(),
    
    // Journey state (OPTIONAL)
    phase: z.enum(['select_entity', 'recommend', 'align', 'style', 'build_preview', 'interactive_edit', 'deploy']).optional(),
    mode: z.enum(['fast_lane', 'deep_lane']).optional(),
    selectedOutcome: z.enum(['dashboard', 'product']).optional(),
    selectedStoryboard: z.string().optional(),
    selectedStyleBundleId: z.string().optional(),
    densityPreset: z.enum(['compact', 'comfortable', 'spacious']).optional(),
    paletteOverrideId: z.string().optional(),
    workflowName: z.string().optional(),
    
    // Model selection (OPTIONAL)
    selectedModel: z.string().optional(),
  }),
  instructions: async ({ requestContext }) => {
    // Type-safe access via requestContext.all (new in Mastra 1.1.0)
    const { tenantId, userId, platformType, phase, selectedOutcome, workflowName, selectedStoryboard, selectedStyleBundleId } = requestContext.all;
    
    
    // Fallback for values that might not be in schema
    const safePlatformType = platformType || "make" as PlatformType;
    const safeSelectedStyleBundle = selectedStyleBundleId || "";
    const contextHeader = [
      "# CURRENT REQUEST CONTEXT (authoritative)",
      userId ? `userId: ${userId}` : "userId: (missing)",
      tenantId ? `tenantId: ${tenantId}` : "tenantId: (missing)",
      phase ? `phase: ${phase}` : "phase: (missing)",
      workflowName ? `workflowName: ${workflowName}` : "workflowName: (missing)",
      selectedOutcome ? `selectedOutcome: ${selectedOutcome}` : "selectedOutcome: (missing)",
      "",
    ].join("\n");

    const platformSkill = await loadSkillMarkdown(safePlatformType as PlatformType);

    const businessSkill = phase === "recommend" || phase === "align"
      ? await loadNamedSkillMarkdown("business-outcomes-advisor")
      : null;

    const phaseInstructions = getPhaseInstructions(phase as FloweticPhase, {
      platformType: String(safePlatformType),
      workflowName: workflowName || undefined,
      selectedOutcome: selectedOutcome || undefined,
      selectedStoryboard: selectedStoryboard || undefined,
      selectedStyleBundle: safeSelectedStyleBundle || undefined,
    });

    const skillContent = [
      "# WHO YOU ARE",
      "You are a business consultant helping agencies turn AI workflows into client dashboards.",
      "You have deep expertise in B2B automation, SaaS monetization, and client retention strategies.",
      "",
      "# WHAT YOU DO",
      "You help users figure out whether to build a Dashboard (prove value) or Product (sell access) from their workflow.",
      "You ask clarifying questions, evaluate business opportunities, and make specific recommendations.",
      "",
      "# HOW YOU HELP",
      "- Answer user questions directly with specific examples",
      "- When asked for industries, list 3-5 concrete examples with reasoning",
      "- When challenged, defend your recommendation with workflow-specific logic",
      "- When asked 'what do you think', evaluate the business idea (market opportunity, risks, strengths)",
      "- Adapt to conversation flow - if user changes topic, acknowledge and redirect",
      "",
      "# WORKING MEMORY (Phase 3)",
      "You have access to <working_memory>, which persists across the conversation thread.",
      "Treat <working_memory> as the durable source of truth for:",
      "- Current phase",
      "- Selected outcome/storyboard/style bundle",
      "If <working_memory> conflicts with the user's latest message, ask one clarifying question.",
      "",
      "# CURRENT CONTEXT",
      workflowName ? `User's workflow: "${workflowName}"` : "No workflow selected yet",
      selectedOutcome ? `User selected outcome: ${selectedOutcome}` : "",
      selectedStoryboard ? `User selected storyboard: ${selectedStoryboard}` : "",
      selectedStyleBundle ? `User selected style bundle: ${selectedStyleBundle}` : "",
      "",
      "# CURRENT PHASE INSTRUCTIONS (Phase 2)",
      phaseInstructions,
      "",
      "# BUSINESS OUTCOMES ADVISOR SKILL",
      businessSkill?.content || "",
      "",
      "# PLATFORM KNOWLEDGE",
      platformSkill || "",
      "",
      "# TOOL USAGE GUIDELINES",
      "- When calling TODO tools, always ensure tenantId and threadId are passed from RequestContext",
      "- These values are automatically available via context.requestContext.get('tenantId') and context.requestContext.get('threadId')",
      "- The tools will fall back to these values if not explicitly provided in the tool call",
    ].filter(Boolean).join("\n");

    return [
      {
        role: "system" as const,
        content: `${contextHeader}\n${skillContent}`
      },
      {
        role: "system",
        content: `
          TODO USAGE RULES - FOR AGENT'S INTERNAL REASONING ONLY:
          
          Use todo tools to track high-level orchestration milestones and maintain your reasoning state.
          
          CREATE TODOS FOR:
          - "Plan dashboard journey" - When a new dashboard journey begins (session start)
          - "Deploy dashboard" - When entering Phase 6 (deployment phase)
          
          MARK TODOS COMPLETE:
          - Mark "Deploy dashboard" complete after deployment record is successfully created
          
          DO NOT CREATE TODOS FOR:
          - UI card selections (outcome selection, storyboard selection, style bundle selection)
          - Atomic tool calls or RAG queries
          - Workflow execution (connectionBackfill, generatePreview)
          - Phase state transitions alone
          
          REMEMBER: Todos are for YOUR internal reasoning and state persistence across operations, not for simple user choices.
          Todo list should only contain high-level milestones that represent actual multi-step work requiring state tracking.
        `,
      },
    ];
  },
  model: ({ requestContext }) => {
    // Get selected model from RequestContext using type-safe access (new in Mastra 1.1.0)
    const { selectedModel } = requestContext.all;
    
    // Import and use model selector
    const { getModelById } = require("../lib/models/modelSelector");
    return getModelById(selectedModel);
  },
  // REQUIRED: routing primitives for Agent.network()
  agents: {
    platformMappingMaster,
    dashboardBuilderAgent,
    designAdvisorAgent,
  },
  workflows: {
    generatePreviewWorkflow,
    connectionBackfillWorkflow,
    deployDashboardWorkflow,
  },
  memory: createFloweticMemory({
    lastMessages: 30,
  }),
  tools: {
    todoAdd,
    todoList,
    todoUpdate,
    todoComplete,
    // Sources CRUD
    createSource,
    listSources,
    updateSource,
    deleteSource,
    // Projects CRUD
    createProject,
    listProjects,
    updateProject,
    deleteProject,
    // Navigation
    navigateTo,
    // UI/UX Tools
    getStyleRecommendations,
    getChartRecommendations,
    getTypographyRecommendations,
    getUXGuidelines,
    getProductRecommendations,
    // NEW: Add Supatools
    getEventStats,
    recommendOutcome,
    recommendStoryboard,
    validatePreviewReadiness,
  },
});
