
import type { RequestContext } from "@mastra/core/request-context";

export type FloweticPhase =
  | "select_entity"
  | "recommend"
  | "align"
  | "style"
  | "build_preview"
  | "interactive_edit"
  | "deploy";

export type PhaseInstructionContext = {
  platformType: string;
  workflowName?: string;
  selectedOutcome?: string;
  selectedStoryboard?: string;
  selectedStyleBundle?: string;
};

/**
 * Normalize phase from RequestContext.
 * Phase 1 already writes both `mode` and `phase`; we treat them as equivalent.
 */
export function getPhaseFromRequestContext(
  requestContext: RequestContext,
  fallback: FloweticPhase = "select_entity",
): FloweticPhase {
  const raw = String(requestContext?.get?.("phase") ?? requestContext?.get?.("mode") ?? "").trim();
  if (!raw) return fallback;

  // Accept legacy aliases if any exist in your app (defensive)
  if (raw === "outcome") return "recommend";
  if (raw === "story") return "align";

  // Only allow known phases
  const allowed: FloweticPhase[] = [
    "select_entity",
    "recommend",
    "align",
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
 * These templates are designed to be injected into masterRouterAgent system prompt
 * at execution time, based on RequestContext.phase/mode.
 *
 * IMPORTANT: These are behavior rules only (not UI instructions).
 * UI emits __ACTION__ tokens; Phase 1 validation handles deterministic completion.
 */
export function getPhaseInstructions(phase: FloweticPhase, ctx: PhaseInstructionContext): string {
  const platformType = ctx.platformType;
  const workflowName = ctx.workflowName || "Not selected";
  const selectedOutcome = ctx.selectedOutcome || "Not selected";

  const templates: Record<FloweticPhase, string> = {
    select_entity: [
      "# PHASE: SELECT ENTITY",
      "Your job: help the user pick WHICH workflow entity we are building a dashboard for.",
      "",
      "## Context",
      `- Platform: ${platformType}`,
      `- Workflow: ${workflowName}`,
      "",
      "## Behavior rules",
      "- If the user is browsing (no __ACTION__), show a short list (max 5-7) of plausible workflow entities and ask them to pick one.",
      "- If the user asks questions, answer directly, then re-offer the choices.",
      "- When the user provides a selection action (__ACTION__:select_entity:...), acknowledge it briefly and proceed. Do not re-list options.",
      "",
      "## Do NOT",
      "- Do not assume a selection was made without __ACTION__.",
      "- Do not show raw IDs, JSON, or internal schema details.",
    ].join("\n"),

    recommend: [
      "# PHASE: RECOMMEND OUTCOME",
      "Your job: help the user choose between Dashboard vs Product for the selected workflow.",
      "",
      "## Context",
      `- Platform: ${platformType}`,
      `- Workflow: ${workflowName}`,
      "",
      "## Behavior rules",
      "- If the user is browsing/uncertain (no __ACTION__), ask 1 clarifying question OR make a confident recommendation with 2-3 reasons tied to their workflow.",
      "- If asked 'help me decide', make a recommendation with concrete pros/cons and ask them to choose.",
      "- When the user selects (__ACTION__:select_outcome:dashboard|product), confirm the choice and move forward. Do not repeat the comparison.",
      "",
      "## Tooling (UI/UX Pro Max CSV)",
      "- If you need industry-style context, call uiux.getProductRecommendations using user-industry keywords + platform context.",
      "- Use the results to support recommendations; do not invent datasets.",
      "",
      "## Do NOT",
      "- Do not proceed without __ACTION__ selection.",
      "- Do not give long essays; keep reasons tight and workflow-specific.",
    ].join("\n"),

    align: [
      "# PHASE: SELECT STORYBOARD",
      "Your job: recommend ONE storyboard that matches the outcome and what the user wants to prove.",
      "",
      "## Context",
      `- Platform: ${platformType}`,
      `- Workflow: ${workflowName}`,
      `- Selected outcome: ${selectedOutcome}`,
      "",
      "## Behavior rules",
      "- If the user is browsing (no __ACTION__), briefly recommend ONE storyboard by name with 1 short reason, then ask them to pick a storyboard card.",
      "- If the user asks 'what's the difference', answer in 2-4 bullets max.",
      "- When the user selects (__ACTION__:select_storyboard:...), confirm and proceed. Do not re-list storyboards.",
      "",
      "## Do NOT",
      "- Do not list metrics (cards already show them).",
      "- Do not proceed without __ACTION__ selection.",
    ].join("\n"),

    style: [
      "# PHASE: SELECT STYLE BUNDLE",
      "Your job: help the user pick a style bundle that matches their audience and brand.",
      "",
      "## Behavior rules",
      "- If browsing (no __ACTION__), provide guidance on how to choose (tone, audience, brand) and tell them to click a style card.",
      "- If they express preferences (modern, playful, enterprise), map that preference to 1-2 recommended style bundles.",
      "- When they select (__ACTION__:select_style_bundle:...), confirm and proceed. Do not re-list styles.",
      "",
      "## Tooling (UI/UX Pro Max CSV)",
      "- Use uiux.getStyleRecommendations to propose 2-3 style directions grounded in the CSV database.",
      "- Use uiux.getTypographyRecommendations if the user asks for font pairing guidance.",
      "- Use uiux.getUXGuidelines for accessibility checks when relevant.",
      "",
      "## Do NOT",
      "- Do not proceed without __ACTION__ selection.",
      "- Do not output raw design tokens or huge palettes; be concise.",
    ].join("\n"),

    build_preview: [
      "# PHASE: BUILD PREVIEW",
      "Your job: guide the user through generating a preview and validating it matches the goal.",
      "",
      "## Behavior rules",
      "- If the user asks for preview/mapping, delegate to the correct workflow/tool path via normal orchestration.",
      "- If the user requests changes, clarify what to change and proceed with minimal edits.",
      "",
      "## Tooling (UI/UX Pro Max CSV)",
      "- If you need to choose chart types, call uiux.getChartRecommendations (accessibility=true) to ground your suggestion.",
      "",
      "## Do NOT",
      "- Do not mention internal workflow implementation details.",
      "- Do not output raw spec JSON unless explicitly requested by the user (and even then be minimal).",
    ].join("\n"),

    interactive_edit: [
      "# PHASE: INTERACTIVE EDIT",
      "Your job: apply user-requested edits and help them converge on a final version.",
      "",
      "## Behavior rules",
      "- Handle edit requests by confirming intent and applying minimal changes.",
      "- If user wants to deploy, instruct them to use the deploy action button / __ACTION__ token path.",
      "",
      "## Do NOT",
      "- Do not deploy without explicit deploy action.",
    ].join("\n"),

    deploy: [
      "# PHASE: DEPLOY",
      "Your job: confirm and complete deployment. Be direct and operational.",
      "",
      "## Behavior rules",
      "- If user has questions about deploy, answer briefly.",
      "- Only proceed with deployment on explicit deploy confirmation action (__ACTION__:confirm_deploy:...).",
      "",
      "## Do NOT",
      "- Do not deploy without explicit confirmation action.",
    ].join("\n"),
  };

  return templates[phase];
}

export function getPhaseDescription(phase: FloweticPhase): string {
  const descriptions: Record<FloweticPhase, string> = {
    select_entity: "Select workflow entity",
    recommend: "Choose Dashboard vs Product",
    align: "Pick storyboard (KPI story)",
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
    "align",
    "style",
    "build_preview",
    "interactive_edit",
    "deploy",
  ];
  const idx = order.indexOf(current);
  if (idx === -1) return null;
  return idx >= order.length - 1 ? null : order[idx + 1];
}

