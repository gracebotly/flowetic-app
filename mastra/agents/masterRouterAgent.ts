
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { glm47Model } from "../lib/models/glm47";
import { getMastraStorage } from "../lib/storage";
import type { PlatformType } from "../skills/loadSkill";
import { loadSkillMarkdown, loadNamedSkillMarkdown } from "../skills/loadSkill";
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

export const masterRouterAgent: Agent = new Agent({
  id: "masterRouterAgent",
  name: "masterRouterAgent",
  description: "Master router agent that orchestrates sub-agents and workflows.",
  instructions: async (context: any) => {
    // ✅ DEFENSIVE CONTEXT EXTRACTION
    const requestContext = context?.requestContext || context || {};
    const platformType = (requestContext.get?.("platformType") || requestContext.platformType || "make") as PlatformType;
    const workflowName = (requestContext.get?.("workflowName") || requestContext.workflowName) as string | undefined;
    const selectedOutcome = (requestContext.get?.("selectedOutcome") || requestContext.selectedOutcome) as string | undefined;

    const platformSkill = await loadSkillMarkdown(platformType);
    const businessSkill = await loadNamedSkillMarkdown("business-outcomes-advisor");

    return [
      {
        role: "system",
        content: businessSkill,
      },
      {
        role: "system",
        content: platformSkill,
      },
      {
        role: "system",
        content: [
          "ROUTING INSTRUCTIONS (INTERNAL ONLY)",
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

