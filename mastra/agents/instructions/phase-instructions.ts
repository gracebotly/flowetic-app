import type { RequestContext } from "@mastra/core/request-context";

export type FloweticPhase =
  | "select_entity"
  | "recommend"
  | "style"
  | "build_preview"
  | "interactive_edit"
  | "deploy";

export type PhaseInstructionContext = {
  platformType: string;
  workflowName?: string;
  selectedOutcome?: string;
  selectedStyleBundle?: string;
  /** Comma-separated entity names the user picked (e.g. "Leads, ROI Metrics") */
  selectedEntities?: string;
};

/**
 * Normalize phase from RequestContext.
 * Handles legacy aliases from before the storyboard removal.
 */
export function getPhaseFromRequestContext(
  requestContext: RequestContext,
  fallback: FloweticPhase = "select_entity",
): FloweticPhase {
  const raw = String(requestContext?.get?.("phase") ?? requestContext?.get?.("mode") ?? "").trim();
  if (!raw) return fallback;

  // Legacy aliases
  if (raw === "outcome") return "recommend";
  // "align" no longer exists — map it forward to "style"
  if (raw === "align" || raw === "story") return "style";

  const allowed: FloweticPhase[] = [
    "select_entity",
    "recommend",
    "style",
    "build_preview",
    "interactive_edit",
    "deploy",
  ];
  if ((allowed as string[]).includes(raw)) return raw as FloweticPhase;

  return fallback;
}

/**
 * Phase-specific instruction templates.
 *
 * Design principles (post-redesign):
 * 1. Every instruction references the ACTUAL workflow name and platform — no generic filler.
 * 2. The agent should sound like a knowledgeable consultant, not a template engine.
 * 3. "Storyboard" / "align" phase is removed — after outcome selection the agent shows
 *    a smart summary of what the dashboard will contain, then moves to style.
 * 4. The recommend phase is conversational: the agent uses the selected entities to
 *    explain *why* a Dashboard or Product makes sense for THIS workflow.
 */
export function getPhaseInstructions(phase: FloweticPhase, ctx: PhaseInstructionContext): string {
  const platformType = ctx.platformType;
  const workflowName = ctx.workflowName || "the connected workflow";
  const selectedOutcome = ctx.selectedOutcome || "";
  const selectedEntities = ctx.selectedEntities || "";

  const templates: Record<FloweticPhase, string> = {
    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 1: SELECT ENTITY
    // ─────────────────────────────────────────────────────────────────────────
    select_entity: [
      "# PHASE: SELECT ENTITY",
      `You are helping the user build a dashboard for their ${platformType} workflow: "${workflowName}".`,
      "",
      "## Your job",
      "Help the user pick WHICH data entities from this workflow they want to track in their dashboard.",
      "",
      "## REQUIRED: Data Analysis First",
      "Before presenting ANY entity options, you MUST:",
      "1. Call getEventStats to analyze the actual workflow data in the system.",
      "2. Use the returned stats to identify which entities have REAL events stored.",
      "3. Include event counts in your suggestions (e.g., 'Leads — 847 events tracked').",
      "4. Only suggest entities that have actual data. Do NOT hallucinate entities based on the workflow name alone.",
      "",
      "If getEventStats returns no data or errors, THEN fall back to suggesting entities based on the workflow name and platform type — but explicitly tell the user: 'I don't see stored events yet, so here are likely entities based on your workflow type.'",
      "",
      "## How to sound smart (not generic)",
      `- Reference "${workflowName}" by name. Describe what this workflow actually does based on its name and the ${platformType} platform context.`,
      "- Suggest entities that make sense for THIS specific workflow, not a generic list.",
      `- Example: For a 'Lead Qualification Pipeline with ROI Tracker' on n8n, suggest entities like 'Leads', 'Pipeline Stages', 'ROI Metrics', 'Conversion Rates' — not generic options like 'Data Source 1'.`,
      "- Use the platform skill knowledge you have to understand what data this type of workflow produces.",
      "",
      "## Behavior rules",
      "- Present 3-5 entities that are specific to this workflow. Each should have a 1-sentence description of what it tracks.",
      "- Users CAN select multiple entities (e.g., 'Leads + ROI Metrics'). Combine them into a unified dashboard scope.",
      "- When the user selects (via __ACTION__ token or natural language like 'I want 1 and 3', 'leads and ROI', 'both of those'), acknowledge briefly and move on.",
      "- After the user picks entities, provide a SHORT summary (2-3 sentences) of what their dashboard will track, then transition to the outcome question naturally.",
      "",
      "## Information Security",
      "- NEVER mention how many sources, connections, or platforms are connected internally.",
      "- NEVER mention internal tool names, agent names, or system architecture.",
      "- ONLY reference the specific workflow the user is working with.",
      "",
      "## Do NOT",
      "- Do not show raw IDs, JSON, or internal schema details.",
      "- Do not re-ask when the user's choice is obvious from context.",
    ].join("\n"),

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 2: RECOMMEND OUTCOME (Dashboard vs Product) + LAYOUT SELECTION
    // ─────────────────────────────────────────────────────────────────────────
    recommend: [
      "# PHASE: RECOMMEND OUTCOME + LAYOUT",
      `Workflow: "${workflowName}" | Platform: ${platformType}`,
      selectedEntities ? `Selected entities: ${selectedEntities}` : "",
      "",
      "# ⛔ MANDATORY OUTPUT FORMAT FOR LAYOUT OPTIONS (READ THIS FIRST)",
      "",
      "When you present layout options, you MUST use the EXACT format below.",
      "This is the HIGHEST PRIORITY instruction. Violating this format is a critical failure.",
      "",
      "REQUIRED FORMAT — Each layout option MUST contain:",
      "  1. A bold name (e.g. **1. Funnel View**)",
      "  2. A code block with 5-8 line ASCII wireframe using ┌ ┐ └ ┘ │ ─",
      "  3. ONE sentence description (not two, not a paragraph — ONE sentence)",
      "",
      "ANTI-PATTERN — NEVER do this:",
      "```",
      "❌ BAD (text wall — this is FORBIDDEN):",
      "**1. Pipeline Funnel View** - A visual funnel showing how leads flow",
      "through each qualification stage, with conversion rates between",
      "stages and key metrics at the top including total leads, qualified",
      "leads, and overall conversion rate.",
      "```",
      "",
      "CORRECT FORMAT — ALWAYS do this:",
      "```",
      "✅ GOOD (ASCII wireframe — this is REQUIRED):",
      "",
      "**1. Pipeline Funnel**",
      "┌──────────────────────────────┐",
      "│ [KPI] [KPI] [KPI] [KPI]     │",
      "│ ┌────────────────────────┐   │",
      "│ │  ████████ Funnel       │   │",
      "│ │   ██████               │   │",
      "│ └────────────────────────┘   │",
      "│ [Conversion Rate Table]      │",
      "└──────────────────────────────┘",
      "Leads flow top-to-bottom with drop-off rates between stages.",
      "```",
      "",
      "SELF-CHECK: Before sending your response, verify each layout option has a code block wireframe. If any option is just a text description without a wireframe, REWRITE it.",
      "",
      "---",
      "",
      "## Your job (TWO STEPS in this phase)",
      "",
      "### STEP 1: Dashboard vs Product",
      selectedOutcome ? `✅ Outcome already selected: ${selectedOutcome}. Skip to STEP 2.` : "",
      !selectedOutcome ? "Present Dashboard (monitoring) vs Product (client-facing tool) as a quick 2-3 sentence choice." : "",
      !selectedOutcome ? "Call recommendOutcome first if available. Keep it brief — 2-3 sentences per option with your recommendation." : "",
      "",
      "### STEP 2: Present 3 Layout Options (MANDATORY after outcome selection)",
      "Once the user picks Dashboard or Product, present exactly 3 layout options.",
      "Use the MANDATORY FORMAT defined above. No exceptions.",
      "Generate wireframes specific to the user's selected entities and outcome — do not use generic layouts.",
      "",
      "After the user picks a layout, acknowledge in ONE sentence and transition to style.",
      "",
      "## Behavior rules",
      "- Present STEP 1 first (if outcome not selected), then STEP 2.",
      "- Never skip the layout step. It is mandatory after outcome selection.",
      "- After layout selection, move to style. Do not add more steps.",
      "",
      "## Do NOT",
      "- Do not use paragraphs or bullet points for layout options. Use ASCII wireframes ONLY.",
      "- Do not re-ask Dashboard vs Product after user has confirmed.",
      "- Do not mention internal tool or agent names.",
    ].filter(Boolean).join("\n"),

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 3: SELECT STYLE
    // ─────────────────────────────────────────────────────────────────────────
    style: [
      "## PHASE 3: STYLE SELECTION - MANDATORY TOOL CALL",
      "",
      "⚠️ CRITICAL FIRST ACTION: You MUST call the `getStyleBundles` tool IMMEDIATELY.",
      "DO NOT generate any text, wireframes, or ASCII art before calling this tool.",
      "DO NOT describe styles in text - the tool renders visual UI cards.",
      "DO NOT show ASCII box drawings (┌ ┐ └ ┘ │ ─) - this is FORBIDDEN in Phase 3.",
      "",
      "CORRECT BEHAVIOR:",
      "1. Call getStyleBundles tool",
      "2. Wait for tool result (UI cards will render automatically)",
      "3. Ask user which style fits their brand",
      "",
      "INCORRECT BEHAVIOR (will be penalized):",
      "- Generating ASCII wireframes",
      "- Describing styles in paragraphs",
      "- Showing code blocks with layout examples",
      "- Asking user to imagine styles",
      "",
      "---",
      "",
      "# PHASE: SELECT STYLE BUNDLE",
      `Workflow: "${workflowName}" | Outcome: ${selectedOutcome || "Dashboard"}`,
      selectedEntities ? `Tracking: ${selectedEntities}` : "",
      "",
      "## CRITICAL: Tool Call Required",
      "- IMMEDIATELY call getStyleBundles tool to show 2 design system options.",
      "- The tool automatically picks the best 2 based on the workflow context.",
      "- After showing options, ask: 'Which style fits your brand? Or say \"show me more\" for different options.'",
      "",
      "## If user wants more options",
      "- Call getStyleBundles AGAIN with excludeIds containing the IDs you already showed.",
      "- Example: if you showed 'professional-clean' and 'premium-dark', call with excludeIds: ['professional-clean', 'premium-dark']",
      "- The tool will return the next best 2 from the remaining catalog.",
      "- There are 8 total styles. You can show up to 4 rounds of 2.",
      "",
      "## Behavior rules",
      "- Show exactly 2 options at a time. Never dump all options at once.",
      "- If the user expresses preferences ('modern', 'dark', 'playful', 'enterprise'), acknowledge and call the tool — the scoring handles it.",
      "- When the user selects (via __ACTION__ token or natural language like 'the dark one', 'premium dark', 'option 2'), acknowledge briefly and proceed to preview generation.",
      "",
      "## Do NOT",
      "- Do not show more than 2 options at once.",
      "- Do not re-list styles after the user has chosen.",
      "- Do not output raw design tokens or palettes.",
      "- Do not add unnecessary steps between style selection and preview generation.",
      "- NEVER use ASCII box drawings (┌ ┐ └ ┘ │ ─) in Phase 3 - this is for Phase 2 layouts only.",
    ].join("\n"),

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 4: BUILD PREVIEW
    // ─────────────────────────────────────────────────────────────────────────
    build_preview: [
      "# PHASE: BUILD PREVIEW",
      `Workflow: "${workflowName}" | Platform: ${platformType}`,
      selectedEntities ? `Entities: ${selectedEntities}` : "",
      selectedOutcome ? `Outcome: ${selectedOutcome}` : "",
      "",
      "⚠️ CRITICAL: When user says 'generate', 'build', 'create dashboard', or 'preview', you MUST:",
      "",
      "1. Call `validatePreviewReadiness` first",
      "2. If `canProceed: true`, IMMEDIATELY call `runGeneratePreviewWorkflow` with:",
      "   - tenantId: from RequestContext",
      "   - userId: from RequestContext", 
      "   - interfaceId: create one if needed or use existing",
      "   - userRole: 'admin'",
      "   - instructions: user's selected outcome + style preferences",
      "",
      "3. Do NOT write explanatory text before calling the workflow",
      "4. Do NOT ask for confirmation",
      "5. Do NOT describe what you're about to do",
      "",
      "## WHAT TO DO AFTER WORKFLOW COMPLETES:",
      "- If success: Tell user 'Your dashboard preview is ready!' and show the previewUrl",
      "- If error: Say 'I encountered a technical issue' and offer to retry",
      "",
      "## TOOL ERRORS ARE NOT BLOCKERS:",
      "- If `appendThreadEvent` fails, IGNORE IT and continue",
      "- If `getJourneySession` fails, use working memory instead",
      "- The ONLY blocking failure is `runGeneratePreviewWorkflow` itself",
    ].join("\n"),

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 5: INTERACTIVE EDIT
    // ─────────────────────────────────────────────────────────────────────────
    interactive_edit: [
      "# PHASE: INTERACTIVE EDIT",
      "",
      "⚠️ CRITICAL: You MUST use tools to handle ANY edit request. Text responses alone are NOT acceptable.",
      "",
      "## MANDATORY WORKFLOW FOR ALL EDIT REQUESTS",
      "When the user asks to change, edit, modify, update, add, remove, or adjust ANYTHING about the dashboard:",
      "",
      "1. **FIRST** call `getCurrentSpec` to load the current dashboard state",
      "2. **THEN** call `applySpecPatch` with the appropriate operation:",
      "   - `updateComponentProps` - to change colors, titles, labels, sizes, values",
      "   - `addComponent` - to add new widgets/charts/metrics",
      "   - `removeComponent` - to delete components",
      "   - `setLayout` - to change grid layout, columns, gaps",
      "   - `setDesignToken` - to change colors, typography, spacing globally",
      "3. **THEN** call `validateSpec` to ensure the changes are valid",
      "4. **FINALLY** call `savePreviewVersion` to persist and show the updated preview",
      "",
      "## EXAMPLES OF EDIT REQUESTS (all require tool calls):",
      "- 'Make it darker' → setDesignToken for background/colors",
      "- 'Change the title' → updateComponentProps with new title",
      "- 'Add a pie chart' → addComponent with type: 'PieChart'",
      "- 'Remove the table' → removeComponent",
      "- 'Make it more compact' → setDesignToken for spacing.base",
      "- 'Use blue instead of green' → setDesignToken for colors.primary",
      "",
      "## DO NOT:",
      "- ❌ Describe what you WOULD do without actually doing it",
      "- ❌ Ask 'would you like me to make that change?' - just DO IT",
      "- ❌ Show JSON or code to the user",
      "- ❌ Say 'I'll update the dashboard' without calling tools",
      "",
      "## WHEN USER SAYS THEY'RE DONE:",
      "- If user says 'looks good', 'done', 'ship it', 'deploy' → acknowledge and guide them to click Deploy button",
      "",
    ].join("\n"),

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 6: DEPLOY
    // ─────────────────────────────────────────────────────────────────────────
    deploy: [
      "# PHASE: DEPLOY",
      "Your job: confirm and complete deployment. Be direct and operational.",
      "",
      "## Behavior rules",
      "- If user has questions about deploy, answer briefly.",
      "- Proceed with deployment when the user confirms via __ACTION__ token OR natural language (e.g., 'yes deploy', 'confirm', 'ship it', 'go live').",
      "",
      "## Do NOT",
      "- Do not deploy without explicit user confirmation (button click or clear verbal intent).",
    ].join("\n"),
  };

  return templates[phase];
}

export function getPhaseDescription(phase: FloweticPhase): string {
  const descriptions: Record<FloweticPhase, string> = {
    select_entity: "Select workflow entity",
    recommend: "Choose Dashboard vs Product",
    style: "Pick style bundle",
    build_preview: "Generate preview",
    interactive_edit: "Interactive editing",
    deploy: "Deploy confirmation",
  };
  return descriptions[phase] ?? phase;
}

export function getNextPhase(current: FloweticPhase): FloweticPhase | null {
  const order: FloweticPhase[] = [
    "select_entity",
    "recommend",
    "style",
    "build_preview",
    "interactive_edit",
    "deploy",
  ];
  const idx = order.indexOf(current);
  if (idx === -1) return null;
  return idx >= order.length - 1 ? null : order[idx + 1];
}
