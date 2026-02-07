export type ValidationResult = {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  duration?: number;
};

export type SelectionType = "entity" | "outcome" | "style_bundle" | "deploy";

export type DetectedSelection =
  | { type: "entity"; value: string }
  | { type: "outcome"; value: string }
  | { type: "style_bundle"; value: string }
  | { type: "deploy"; value: string };

const ENTITY_RE = /__ACTION__:select_entity:([^\s]+)\b/;
const OUTCOME_RE = /__ACTION__:select_outcome:([^\s]+)\b/;
// Legacy: storyboard regex removed — storyboard phase eliminated
const STYLE_BUNDLE_RE = /__ACTION__:select_style_bundle:([^\s]+)\b/;
const DEPLOY_RE = /__ACTION__:(confirm_deploy|deploy):([^\s]+)\b/;

export function detectSelection(userMessage: string): DetectedSelection | null {
  const deploy = userMessage.match(DEPLOY_RE);
  if (deploy?.[1] && deploy?.[2]) {
    return { type: "deploy", value: deploy[2] };
  }

  const entity = userMessage.match(ENTITY_RE);
  if (entity?.[1]) return { type: "entity", value: entity[1] };

  const outcome = userMessage.match(OUTCOME_RE);
  if (outcome?.[1]) return { type: "outcome", value: outcome[1] };

  // Legacy: storyboard tokens silently ignored (phase removed)

  const style = userMessage.match(STYLE_BUNDLE_RE);
  if (style?.[1]) return { type: "style_bundle", value: style[1] };

  return null;
}

export function hasAnySelectionAction(userMessage: string): boolean {
  return detectSelection(userMessage) !== null;
}

export function selectionPhaseMatch(
  phase: string | undefined,
  selection: DetectedSelection,
): { ok: boolean; expected?: SelectionType } {
  if (!phase) return { ok: true };

  if (phase === "select_entity") return { ok: selection.type === "entity", expected: "entity" };
  if (phase === "recommend") return { ok: selection.type === "outcome", expected: "outcome" };
  // Legacy: "align" phase removed — map to "style" for backward compat
  if (phase === "align") return { ok: selection.type === "style_bundle", expected: "style_bundle" };
  if (phase === "style") return { ok: selection.type === "style_bundle", expected: "style_bundle" };

  if (phase === "deploy" || phase === "interactive_edit") {
    return { ok: selection.type === "deploy", expected: "deploy" };
  }

  // Other phases: don't enforce strict matching in Phase 1
  return { ok: true };
}

export function makeValidationResult(params: {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  startMs: number;
}): ValidationResult {
  return {
    success: params.success,
    message: params.message,
    details: params.details,
    duration: Date.now() - params.startMs,
  };
}
