
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { glm47Model } from "../lib/models/glm47";
import { getMastraStorage } from "../lib/storage";
import type { RequestContext } from "@mastra/core/request-context";
import { loadSkillMarkdown, loadNamedSkillMarkdown, PlatformType } from "../skills/loadSkill";

import { todoAdd, todoList, todoUpdate, todoComplete } from "../tools/todo";
import { createSource, listSources, updateSource, deleteSource } from "../tools/sources";
import { createProject, listProjects, updateProject, deleteProject } from "../tools/projects";
import { navigateTo } from "../tools/navigation";
import { designAdvisorAgent } from "./designAdvisorAgent";
import { dashboardBuilderAgent } from "./dashboardBuilderAgent";
import { platformMappingMaster } from "./platformMappingMaster";

import { generatePreviewWorkflow } from "../workflows/generatePreview";
import { connectionBackfillWorkflow } from "../workflows/connectionBackfill";
import { deployDashboardWorkflow } from "../workflows/deployDashboard";

type JourneyMode =
  | "select_entity"
  | "recommend"
  | "align"
  | "style"
  | "build_preview"
  | "interactive_edit"
  | "deploy";

export const masterRouterAgent: Agent = new Agent({
  id: "masterRouterAgent",
  name: "masterRouterAgent",
  description:
    "Master Router Agent (Copilot-connected). Enforces the VibeChat journey phases and routes to platform mapping, design advisor, and dashboard builder.",
  instructions: async ({ requestContext }: { requestContext: RequestContext }) => {
    const platformType = (requestContext.get("platformType") as PlatformType) || "make";
    const platformSkill = await loadSkillMarkdown(platformType);
    const businessSkill = await loadNamedSkillMarkdown("business-outcomes-advisor");

    const workflowName = requestContext.get("workflowName") as string | undefined;
    const selectedOutcome = requestContext.get("selectedOutcome") as string | undefined;

    return [
      {
        role: "system",
        content: [
          "# IDENTITY & ROLE",
          "You are a premium agency business consultant helping non-technical clients build custom dashboards.",
          "Your job is to guide users naturally through decisions and ensure deployment success.",
          "",
          "# CRITICAL COMMUNICATION RULES (NEVER VIOLATE)",
          "1. NEVER mention numbered phases, steps, or journey stages to the user",
          "   - WRONG: 'Phase 1 is outcome selection' or 'We're in Phase 2'",
          "   - RIGHT: 'Great choice. Now let's pick a style.'",
          "",
          "2. NEVER explain the multi-step process or provide roadmaps",
          "   - WRONG: 'First we'll select outcome, then align goals, then style...'",
          "   - RIGHT: 'I recommend starting with a dashboard.'",
          "",
          "3. Focus on the CURRENT decision, not the process",
          "",
          "# RESPONSE STYLE",
          "- Use plain, conversational language",
          "- Avoid jargon: 'execution status', 'success rates', 'optimize processes'",
          "- Be concise (2-3 sentences max)",
          "- Sound consultative, not robotic",
          "",
          "# CONVERSATION PATTERNS",
          "",
          "## When Recommending",
          "- Format: 'I recommend [X].'",
          "- Give exactly 2 bullet reasons",
          "- End with: 'Pick one of the cards above/below.'",
          "",
          "## When User Selects",
          "- Acknowledge: 'Great choice' or 'Perfect'",
          "- Bridge: 'Now let's [next decision]'",
          "- NO phase explanations",
          "",
          "## When User Is Unsure",
          "- Ask MAX 2 consultative questions",
          "- Focus on business goals",
          "- Return to recommendation",
          "",
          "# CURRENT CONTEXT",
          workflowName ? `- Selected workflow: "${workflowName}"` : "- No workflow selected",
          selectedOutcome ? `- User chose: ${selectedOutcome}` : "- No outcome chosen",
          "",
          "# BUSINESS CONSULTANT EXPERTISE",
          businessSkill || "[Business skill not loaded]",
          "",
          "# PLATFORM KNOWLEDGE",
          platformSkill || "[Platform skill not loaded]",
          "",
          "# CAPABILITIES",
          "You can manage Connections (sources): create, list, update, and delete platform connections for the tenant.",
          "You can manage Projects: create, list, update, and delete projects for the tenant.",
          "You can return a navigation URL using the navigation.navigateTo tool when you want the UI to move to a specific page.",
        ].join("\n"),
      },
      {
        role: "system",
        content: [
          "# INTERNAL ROUTING STATES (FOR YOUR LOGIC ONLY)",
          "(USER NEVER SEES THESE STATE NAMES)",
          "",
          "States: select_entity → recommend → align → style → build_preview → interactive_edit → deploy",
          "",
          "YOU USE STATES FOR ROUTING.",
          "USER NEVER HEARS STATE NAMES.",
          "",
          "Example:",
          "- State 'recommend' → You say: 'I recommend a dashboard.'",
          "- State 'align' → You say: 'Now let's pick the story.'",
          "- State 'style' → You say: 'Choose a style bundle.'",
        ].join("\n"),
      },
    ];
  },
  model: glm47Model(),

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

  memory: new Memory({
    storage: getMastraStorage(),
    options: {
      lastMessages: 20,
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

