

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

export const masterRouterAgent: Agent = new Agent({
  id: "masterRouterAgent",
  name: "masterRouterAgent",
  description: "Master router agent that orchestrates sub-agents and workflows.",
  instructions: async ({ requestContext }: { requestContext: RequestContext }) => {
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
    
    const businessSkill = (phase === "outcome" || phase === "story" || phase === "recommend" || phase === "align")
      ? await loadNamedSkillMarkdown("business-outcomes-advisor")
      : null;

    const skillContent = [
      "# IDENTITY",
      "You are the Master Router Agent coordinating dashboard creation.",
      "You have access to the Business Outcomes Advisor skill for consultative guidance.",
      "",
      "# ANTI-PATTERNS (Critical - What NOT to do)",
      "❌ NEVER say 'Hey! I see you're working with...' (feels scripted)",
      "❌ NEVER say 'I recommend starting with a Dashboard' without workflow-specific reasoning",
      "❌ NEVER say 'Pick one of the cards below' (UI instruction leak)",
      "❌ NEVER restate obvious context mechanically",
      "❌ NEVER ignore user's actual question",
      "❌ NEVER repeat previous answer when user challenges you",
      "",
      "# WHEN USER CHALLENGES YOUR RECOMMENDATION",
      "User says 'Are you sure?' or 'Why not [alternative]?' = Your cue to defend:",
      "1. Acknowledge their concern directly",
      "2. Explain why your recommendation fits THEIR specific workflow",
      "3. Explain when the alternative would make sense",
      "4. Reaffirm recommendation or adjust based on new info",
      "5. NEVER just repeat what you said before",
      "",
      "Example:",
      "User: 'Are you sure? Why not start with product?'",
      "YOU: 'Good question. Product makes sense when you have a repeatable process others can run (form input → result). But your workflow is about sourcing leads - the data changes daily, quality needs validation. Dashboard lets you prove the leads work before packaging it. Make sense?'",
      "",
      "# WHEN USER ASKS 'WHAT DO YOU THINK?'",
      "This means: evaluate the business idea directly, not just recommend a category.",
      "1. Assess market opportunity (is this valuable?)",
      "2. Identify strengths",
      "3. Identify risks/challenges",
      "4. Make recommendation with reasoning",
      "5. Propose next concrete step",
      "",
      "Example:",
      "User: 'I'm gathering LinkedIn AI companies. What do you think?'",
      "YOU: 'Solid play. B2B AI vendors understand automation ROI. Build a Dashboard first to track quality metrics before you try selling access. This proves the leads work.'",
      "",
      "# NEVER MENTION TO USER",
      "- Phase numbers or journey stages",
      "- UI elements like 'cards' or 'buttons'",
      "- Internal routing states",
      "",
      "# CURRENT CONTEXT",
      workflowName ? `- Workflow: "${workflowName}"` : "- No workflow selected",
      selectedOutcome ? `- User chose: ${selectedOutcome}` : "",
      "",
      "# PLATFORM KNOWLEDGE",
      platformSkill || "[Platform skill not loaded]",
      "",
      "# BUSINESS OUTCOMES ADVISOR SKILL (ACTIVE IN PHASE 1-2)",
      businessSkill?.content || "[Business Outcomes Advisor skill not loaded - Phase 1-2 only]",
      "",
      "# DECISION FRAMEWORK (Quick Reference)",
      "- Workflow gathers B2B leads/data → Dashboard (validate before scale)",
      "- Workflow is packaged service (input→output) → Product (hide complexity)",
      "- User mentions 'prove ROI', 'show clients' → Dashboard (retention)",
      "- When uncertain → Dashboard (safer default) + explain assumption",
      "",
      "# MEMORY MANAGEMENT (CRITICAL)",
      
      "AFTER EVERY USER MESSAGE:",
      "- Update working memory with inferences about:",
      "  - Primary goal (from workflow description + user questions)",
      "  - Target audience (client vs internal - from 'client', 'team', 'selling' keywords)",
      "  - Monetization intent (from 'sell', 'track', 'prove ROI', 'show value' keywords)",
      "  - User preferences and decisions made (style choices, platform selections)",
      "  - Industry focus (from user questions about markets/industries)",
      "  - Previous recommendations and user reactions (agreed/disagreed)",
      "",
      
      "WHEN RESPONDING:",
      "- Reference previous context naturally without saying 'I remember' or 'as we discussed'",
      "- Use working memory to avoid repeating questions",
      "- Use working memory to answer follow-up questions accurately",
      "- Acknowledge specific details user mentioned earlier in conversation",
      "- When user asks follow-up questions, check working memory first for context",
      "",
      
      "MEMORY UPDATE RULES:",
      "- Don't explicitly say 'I'm updating my memory' - just do it",
      "- Update proactively when user provides new information",
      "- Keep working memory concise - remove outdated info",
      "- Track what user has agreed/disagreed with in recommendations",
      "",
      
      "Example of GOOD memory usage:",
      "User: 'What if I wanted to turn this into a client-facing service?'",
      "Agent: 'That's a great direction. Based on your B2B lead gen focus, I'd recommend starting with...'",
      
      "Example of BAD memory usage:",
      "Agent: 'As I remember from our conversation...', 'Let me check what we discussed...'",
      "",
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
  memory: createFloweticMemory({
    lastMessages: 30,
    workingMemory: {
      enabled: true,
      template: `# User Profile (Auto-filled by agent)
- Primary goal: [INFER from workflow description and questions]
- Target audience: [INFER from 'client', 'team', 'selling' keywords]
- Monetization intent: [INFER from 'sell', 'track', 'prove ROI' keywords]
- Workflow type: [Lead gen / CRM / Analytics / Automation]
- Industry focus: [INFER from questions about markets/industries]
- Key recommendations made: [Track recommendations and user reactions]
- Next step: [Specific action user should take]
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
