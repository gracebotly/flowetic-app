// Centralized selection action parsing + phase/selection compatibility checks.

export type SelectionType = "proposal" | "deploy";

export type DetectedSelection =
  | { type: "proposal"; value: string }
  | { type: "deploy"; value: string };

// 3-phase journey: only proposal and deploy tokens
const PROPOSAL_RE = /__ACTION__:select_proposal:([0-9]+)\b/;
const DEPLOY_RE = /__ACTION__:(confirm_deploy|deploy):([^\s]+)\b/;

export function detectSelection(userMessage: string): DetectedSelection | null {
  const deploy = userMessage.match(DEPLOY_RE);
  if (deploy?.[1] && deploy?.[2]) {
    return { type: "deploy", value: deploy[2] };
  }

  const proposal = userMessage.match(PROPOSAL_RE);
  if (proposal?.[1]) return { type: "proposal", value: proposal[1] };

  return null;
}

export function hasSelectionAction(userMessage: string): boolean {
  return detectSelection(userMessage) !== null;
}

export function selectionPhaseMatch(
  phase: string | undefined,
  selection: DetectedSelection,
): { ok: boolean; expected?: SelectionType } {
  if (!phase) return { ok: true };

  // Map legacy phase names to new phases for matching
  const normalizedPhase =
    (phase === "select_entity" || phase === "recommend" || phase === "style") ? "propose" :
    (phase === "build_preview" || phase === "interactive_edit") ? "build_edit" :
    phase;

  if (normalizedPhase === "propose") return { ok: selection.type === "proposal", expected: "proposal" };
  if (normalizedPhase === "build_edit" || normalizedPhase === "deploy") {
    return { ok: selection.type === "deploy", expected: "deploy" };
  }

  return { ok: true };
}


export function makeValidationResult(params: {
  success: boolean;
  startMs: number;
  message: string;
  details?: Record<string, unknown>;
}) {
  return {
    success: params.success,
    message: params.message,
    details: params.details,
    duration: Date.now() - params.startMs,
  };
}
