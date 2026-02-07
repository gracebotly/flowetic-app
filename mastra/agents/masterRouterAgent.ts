

import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { z } from "zod";
import { glm47Model } from "../lib/models/glm47";
import { getMastraStorage } from "../lib/storage";
import { getModelById } from "../lib/models/modelSelector";
import type { RequestContext } from "@mastra/core/request-context";
import { createFloweticMemory } from "../lib/memory";
import { workspace } from '../workspace';  // ← ADD THIS IMPORT
import { loadSkillFromWorkspace } from '../lib/loadSkill';
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
import { getOutcomes } from "../tools/outcomes";
import { getStyleBundles } from "../tools/design";
import {
  getPhaseFromRequestContext,
  getPhaseInstructions,
  type FloweticPhase,
} from "./instructions/phase-instructions";

// NEW: Import Supatools
import {
  getEventStats,
  recommendOutcome,
  // recommendStoryboard, // REMOVED: storyboard/align phase eliminated
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
    userEmail: z.string().optional(),
    supabaseAccessToken: z.string().optional(),

    // Thread context (REQUIRED)
    threadId: z.string(),
    resourceId: z.string(),
    journeyThreadId: z.string(),

    // Platform context (OPTIONAL)
    platformType: z.enum(['vapi', 'retell', 'n8n', 'make', 'mastra', 'crewai', 'pydantic_ai', 'activepieces', 'other']).optional(),
    sourceId: z.string().uuid().optional(),
    entityId: z.string().optional(),
    externalId: z.string().optional(),
    displayName: z.string().optional(),
    entityKind: z.string().optional(),
    skillMD: z.string().optional(),

    // Journey state (OPTIONAL)
    phase: z.enum(['select_entity', 'recommend', 'style', 'build_preview', 'interactive_edit', 'deploy']).optional(),
    selectedOutcome: z.enum(['dashboard', 'product']).optional().nullable(),
    // selectedStoryboard removed — storyboard/align phase eliminated
    selectedStyleBundleId: z.string().optional().nullable(),
    densityPreset: z.enum(['compact', 'comfortable', 'spacious']).optional(),
    paletteOverrideId: z.string().optional().nullable(),
    workflowName: z.string().optional(),

    // Model selection (OPTIONAL)
    selectedModel: z.string().optional(),
  }),
  instructions: async ({ requestContext }) => {
    // Type-safe access via requestContext.all (new in Mastra 1.1.0)
    const { tenantId, userId, platformType, phase, selectedOutcome, workflowName, selectedStyleBundleId } = requestContext.all;
    
    
    // Fallback for values that might not be in schema
    const safePlatformType = platformType || "make";
    const safeSelectedStyleBundle = selectedStyleBundleId || "";
    const contextHeader = [
      "# CURRENT REQUEST CONTEXT (authoritative)",
      userId ? `userId: ${userId}` : "userId: (missing)",
      tenantId ? `tenantId: ${tenantId}` : "tenantId: (missing)",
      phase ? `phase: ${phase}` : "phase: (missing)",
      workflowName ? `🎯 WORKFLOW: "${workflowName}" (ALWAYS reference this in responses)` : "workflowName: (missing)",
      selectedOutcome ? `selectedOutcome: ${selectedOutcome}` : "selectedOutcome: (missing)",
      "",
      workflowName ? `\n⚠️ CRITICAL: You are helping build a dashboard for the "${workflowName}" workflow. Always acknowledge this workflow by name when responding.\n` : "",
    ].join("\n");

    // =========================================================================
    // SKILL LOADING - Load Platform Skill + Business Outcomes Advisor
    // =========================================================================
    const platformSkillContent = await loadSkillFromWorkspace(safePlatformType);

    // Load business outcomes advisor for recommend phase
    const businessPhases = ["outcome", "recommend", "select_entity"];
    const shouldLoadBusinessSkill = businessPhases.includes(phase || "select_entity");
    const businessSkillContent = shouldLoadBusinessSkill
      ? await loadSkillFromWorkspace("business-outcomes-advisor")
      : "";

    const phaseInstructions = getPhaseInstructions(phase as FloweticPhase, {
      platformType: String(safePlatformType),
      workflowName: workflowName || undefined,
      selectedOutcome: selectedOutcome || undefined,
      selectedStyleBundle: safeSelectedStyleBundle || undefined,
    });

    const skillContent = [
      "## AUTONOMOUS AGENT BEHAVIOR RULES",
      "",
      "You are a consultative dashboard generation assistant. Your job is to autonomously complete tasks and explain what you did - never ask permission.",
      "",
      "### CRITICAL EXECUTION PRINCIPLES:",
      "1. NEVER ask 'Would you like me to...' - complete tasks, then explain what you did",
      "2. NEVER ask 'Should I proceed with...' - make reasonable assumptions and proceed",
      "3. NEVER expose internal implementation details (phases, tool names, validation states)",
      "4. ALWAYS call validatePreviewReadiness BEFORE attempting preview generation",
      "5. ALWAYS explain problems clearly when blockers exist",
      "6. ALWAYS offer specific, actionable solutions when stuck",
      "",
      "### DATA READINESS PROTOCOL:",
      "",
      "When checking if enough data exists to build a preview:",
      "1. Call validatePreviewReadiness to assess current event data.",
      "2. If events are insufficient (<2), AUTOMATICALLY run connectionBackfillWorkflow to pull execution history from the connected platform. Do NOT ask the user first.",
      "3. After backfill completes, call validatePreviewReadiness AGAIN to re-check.",
      "4. If data is STILL insufficient after backfill, explain the situation with specific numbers from the validation result.",
      "5. Offer concrete next steps based on what you found.",
      "",
      "CRITICAL: NEVER skip step 2. NEVER tell the user there's insufficient data without first attempting backfill.",
      "CRITICAL: NEVER recite a pre-written response. Describe the actual situation based on tool results.",
      "",
      "### GENERAL TOOL USAGE PRINCIPLE:",
      "",
      "You have tools and workflows available. When you encounter a problem, CHECK if you have a tool that can resolve it before reporting it to the user.",
      "- Missing data? → Try backfill workflows first.",
      "- Schema not ready? → Check if sync is in progress.",
      "- Validation fails? → Read the specific failure reasons and address each one.",
      "",
      "Your job is to SOLVE problems autonomously, not to REPORT problems to the user.",
      "",
      "### WHAT TO NEVER SAY (Anti-Patterns):",
      "❌ 'Phase X validation failed'",
      "❌ 'Moving to Phase Y'",
      "❌ 'Would you like me to proceed?'",
      "❌ 'Insufficient events (0 < 10)'",
      "❌ 'No journey session found'",
      "❌ Any internal tool names or validation states",
      "",
      "### EXECUTION FLOW:",
      "1. Understand user request",
      "2. Call validatePreviewReadiness to check data availability",
      "3. IF validation passes → proceed with preview generation",
      "4. IF validation fails → explain problem clearly + offer solutions",
      "5. Complete entire task before responding",
      "6. Present results with clear reasoning",
      "",
      "### YOUR TOOLS:",
      "- validatePreviewReadiness: Check if enough data exists before preview",
      "- connectionBackfillWorkflow: Fetch historical workflow execution data",
      "- generatePreviewWorkflow: Create dashboard preview (only if validation passes)",
      "",
      "Remember: You're a consultant, not a form-filler. Complete tasks autonomously and explain your reasoning.",
      "",
      "# WHO YOU ARE",
      "You are a business consultant helping agencies turn AI workflows into client dashboards.",
      "You have deep expertise in B2B automation, SaaS monetization, and client retention strategies.",
      "",
      "# WHAT YOU DO",
      "You help users figure out whether to build a Dashboard (prove value) or Product (sell access) from their workflow.",
      "You make specific recommendations and execute on them autonomously.",
      "",
      "# HOW YOU HELP",
      "- Answer user questions directly with specific examples",
      "- When asked for industries, list 3-5 concrete examples with reasoning",
      "- When challenged, defend your recommendation with workflow-specific logic",
      "- When asked 'what do you think', evaluate the business idea (market opportunity, risks, strengths)",
      "- Adapt to conversation flow - if user changes topic, acknowledge and redirect",
      "",
      "# INFORMATION SECURITY (CRITICAL)",
      "- NEVER say 'I can see you have X platforms connected' or reveal internal source/connection counts.",
      "- NEVER mention agent names like 'platformMappingMaster', 'dashboardBuilderAgent', etc.",
      "- NEVER say 'handing off to [Agent]' - instead say 'Generating your preview...' or similar.",
      "- ONLY reference the specific workflow the user selected, not all available data.",
      "- Keep all internal architecture, tool names, and system details invisible to the user.",
      "",
      "# ERROR HANDLING (CRITICAL)",
      "- When workflows or tools fail, NEVER show raw error messages to users.",
      "- NEVER mention database errors, constraint violations, or technical stack traces.",
      "- NEVER say 'duplicate key', 'unique constraint', 'workflow snapshot', or similar technical terms.",
      "- Instead say: 'I ran into a technical issue. Let me try a different approach.' or 'Something went wrong, let me retry.'",
      "- Offer the user simple options: retry, try later, or take a different path.",
      "",
      "# WORKING MEMORY (Phase 3)",
      "You have access to <working_memory>, which persists across the conversation thread.",
      "Treat <working_memory> as the durable source of truth for:",
      "- Current phase",
      "- Selected outcome/style bundle",
      "If <working_memory> conflicts with the user's latest message, ask one clarifying question.",
      "",
      "# CURRENT CONTEXT",
      workflowName ? `User's workflow: "${workflowName}"` : "No workflow selected yet",
      selectedOutcome ? `User selected outcome: ${selectedOutcome}` : "",
      safeSelectedStyleBundle ? `User selected style bundle: ${safeSelectedStyleBundle}` : "",
      "",
      "# CURRENT PHASE INSTRUCTIONS (Phase 2)",
      phaseInstructions,
      "",
      "# WORKSPACE SKILLS",
      "Workspace provides automatic skill discovery from workspace/skills/ directory.",
      "Platform-specific knowledge and business advisor skills are available through the workspace.",
      "",
      "",
      "# TOOL USAGE GUIDELINES",
      "- When calling TODO tools, always ensure tenantId and threadId are passed from RequestContext",
      "- These values are automatically available via context.requestContext.get('tenantId') and context.requestContext.get('threadId')",
      "- The tools will fall back to these values if not explicitly provided in the tool call",
      "",
      "# MULTI-STEP EXECUTION RULES",
      "- After calling updateWorkingMemory or any tool, do NOT repeat text you already wrote before the tool call.",
      "- Your pre-tool text was already delivered. Continue with NEW content only.",
      "",
      // =========================================================================
      // INJECTED SKILLS (loaded from workspace at runtime)
      // =========================================================================
      platformSkillContent ? `\n\n# PLATFORM SKILL: ${safePlatformType.toUpperCase()}\n\n${platformSkillContent}` : "",
      businessSkillContent ? `\n\n# BUSINESS OUTCOMES ADVISOR\n\n${businessSkillContent}` : "",
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
  workspace,  // ← ADD THIS LINE (after existing properties, before closing brace)
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
    // Outcome & Style Tools
    getOutcomes,
    getStyleBundles,
    // NEW: Add Supatools
    getEventStats,
    recommendOutcome,
    // recommendStoryboard, // REMOVED: storyboard/align phase eliminated
    validatePreviewReadiness,
  },
});
