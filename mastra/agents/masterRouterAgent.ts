

import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { glm47Model } from "../lib/models/glm47";
import { getMastraStorage } from "../lib/storage";
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
  getPhaseFromRequestContext,
  getPhaseInstructions,
} from "./instructions/phase-instructions";

export const masterRouterAgent: Agent = new Agent({
  id: "masterRouterAgent",
  name: "masterRouterAgent",
  description: "Master router agent that orchestrates sub-agents and workflows.",
  instructions: async ({ requestContext }: { requestContext: RequestContext }) => {
    const platformType = (typeof requestContext?.get === 'function' 
      ? requestContext.get("platformType") 
      : (requestContext as any)?.platformType) || "make" as PlatformType;
    
    const phase = getPhaseFromRequestContext(requestContext);
    const selectedOutcome = String(requestContext?.get?.("selectedOutcome") ?? "");
    const workflowName = String(requestContext?.get?.("workflowName") ?? "");
    const tenantId = String(requestContext?.get?.("tenantId") ?? "");
    const userId = String(requestContext?.get?.("userId") ?? "");
    const selectedStoryboard = String(requestContext?.get?.("selectedStoryboard") ?? "");
    const selectedStyleBundle = String(
      requestContext?.get?.("selectedStyleBundle") ??
        requestContext?.get?.("selectedStyleBundleId") ??
        "",
    );

    const contextHeader = [
      "# CURRENT REQUEST CONTEXT (authoritative)",
      userId ? `userId: ${userId}` : "userId: (missing)",
      tenantId ? `tenantId: ${tenantId}` : "tenantId: (missing)",
      phase ? `phase: ${phase}` : "phase: (missing)",
      workflowName ? `workflowName: ${workflowName}` : "workflowName: (missing)",
      selectedOutcome ? `selectedOutcome: ${selectedOutcome}` : "selectedOutcome: (missing)",
      "",
    ].join("\n");

    const platformSkill = await loadSkillMarkdown(platformType);

    const businessSkill =
      phase === "outcome" || phase === "story" || phase === "recommend" || phase === "align"
        ? await loadNamedSkillMarkdown("business-outcomes-advisor")
        : null;

    const phaseInstructions = getPhaseInstructions(phase, {
      platformType: String(platformType),
      workflowName: workflowName || undefined,
      selectedOutcome: selectedOutcome || undefined,
      selectedStoryboard: selectedStoryboard || undefined,
      selectedStyleBundle: selectedStyleBundle || undefined,
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
  model: ({ requestContext }: { requestContext: RequestContext }) => {
    // Get selected model from RequestContext (defaults to GLM 4.7)
    const selectedModelId = (typeof requestContext?.get === 'function'
      ? requestContext.get("selectedModel")
      : (requestContext as any)?.selectedModel) as string | undefined;
    
    // Import and use model selector
    const { getModelById } = require("../lib/models/modelSelector");
    return getModelById(selectedModelId);
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
  workingMemory: {
    enabled: true,
    template: `# Conversation Context
- Workflow: [name/type from user]
- User's goal: [what they want to achieve]
- Concerns raised: [any objections or questions]
- Recommendation status: [given/pending/challenged]
`,
  },
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
  },
});
