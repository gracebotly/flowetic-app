
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { glm47Model } from "../lib/models/glm47";
import { getMastraStorage } from "../lib/storage";
import type { RequestContext } from "@mastra/core/request-context";
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
  instructions: async ({ requestContext }: { requestContext: RequestContext }) => {
    // Get current phase from request context for phase-based skill injection
    const phase = (typeof requestContext?.get === 'function' 
      ? requestContext.get("phase") 
      : (requestContext as any)?.phase) as string | undefined;
    
    const platformType = (typeof requestContext?.get === 'function' 
      ? requestContext.get("platformType") 
      : (requestContext as any)?.platformType) || "make" as PlatformType;
    
    const workflowName = (typeof requestContext?.get === 'function' 
      ? requestContext.get("workflowName") 
      : (requestContext as any)?.workflowName) as string | undefined;
    
    const selectedOutcome = (typeof requestContext?.get === 'function' 
      ? requestContext.get("selectedOutcome") 
      : (requestContext as any)?.selectedOutcome) as string | undefined;

    const platformSkill = await loadSkillMarkdown(platformType);
    
    // PHASE-BASED SKILL INJECTION: Only load business skill for Phase 1-2
    const businessSkill = (phase === "outcome" || phase === "story" || phase === "recommend" || phase === "align")
      ? await loadNamedSkillMarkdown("business-outcomes-advisor")
      : null;

    const skillContent = [
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
      "# DEEP LANE CONSULTATIVE RULE (PHASE 1-2)",
      "IF the user asks a clarifying business question (e.g., renewals vs selling access), you MUST answer it directly first.",
      "Then (optionally) ask at most ONE follow-up question if it materially changes the recommendation.",
      "Only AFTER answering, provide a confident recommendation (Dashboard vs Product) with 1-2 reasons tied to their question.",
      "",
      "# ANTI-ROBOT RULES",
      "- NEVER ignore the user's actual question.",
      "- NEVER reply with a generic recommendation without addressing the question asked.",
      "- Avoid template phrases like 'I'd be happy to help' or 'I recommend starting with...' unless you first answered the question.",
      "- Keep it conversational and business-first.",
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
      "# PLATFORM KNOWLEDGE",
      platformSkill || "[Platform skill not loaded]",
      "",
      "# BUSINESS OUTCOMES ADVISOR SKILL",
      businessSkill?.content || "[Business Outcomes Advisor skill not loaded - Phase 1-2 only]",
      "",
      "# CAPABILITIES",
      "You can manage Connections (sources): create, list, update, and delete platform connections for the tenant.",
      "You can manage Projects: create, list, update, and delete projects for the tenant.",
      "You can return a navigation URL using the navigation.navigateTo tool when you want the UI to move to a specific page.",

      "# NETWORK ORCHESTRATION:",
      "- When user asks for preview generation or mapping, use your sub-agents/workflows autonomously via network execution.",
      "- Prefer delegating: mapping → platformMappingMaster; style → designAdvisorAgent; spec edits → dashboardBuilderAgent; preview build → generatePreviewWorkflow.",
      "",
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
    ].join("\n");

    return {
      role: "system" as const,
      content: skillContent
    };
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
  memory: new Memory({
    storage: getMastraStorage(),
    options: {
      lastMessages: 30,
      workingMemory: {
        enabled: true,
        template: `# User Profile
- Primary goal:
- Target audience (client vs internal):
- Monetization intent (renewals/retention vs sell access vs both):
- Constraints:
- Decisions made so far:
`,
      },
      semanticRecall: {
        topK: 5,
        messageRange: 3,
        scope: "resource",
      },
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

