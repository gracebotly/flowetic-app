
import { detectSelection, makeValidationResult, selectionPhaseMatch } from "./selection-checks";

type CompletionContextLike = {
  iteration: number;
  originalTask: string;
  primitiveResult?: string;
  customContext?: Record<string, unknown>;
};

type CompletionResultLike = {
  passed: boolean;
  reason: string;
  duration: number;
  finalResult?: string;
};

function extractPhase(customContext?: Record<string, unknown>): string | undefined {
  const phase = customContext?.phase;
  return typeof phase === "string" ? phase : undefined;
}

/**
 * Deterministic completion scorer for Flowetic selections.
 *
 * This plugs into Mastra Agent Network validation (scorers), which is implemented
 * in the network loop you provided (validationStep -> runValidation({ scorers })).
 *
 * - If no __ACTION__:select_* token exists, scorer fails -> network continues (no looping confusion)
 * - If a token exists, scorer passes (optionally requiring phase/action match)
 */
export function createFloweticSelectionCompletionScorer(opts?: {
  requirePhaseMatch?: boolean;
  /**
   * If true, check both originalTask and primitiveResult for selection tokens.
   * Default true: safe across different prompt/event shapes.
   */
  checkPrimitiveResultToo?: boolean;
}): {
  scorer: string;
  run: (context: CompletionContextLike) => Promise<CompletionResultLike>;
} {
  const requirePhaseMatch = opts?.requirePhaseMatch ?? true;
  const checkPrimitiveResultToo = opts?.checkPrimitiveResultToo ?? true;

  return {
    scorer: "flowetic-selection-completion",
    async run(context) {
      const start = Date.now();

      const phase = extractPhase(context.customContext);
      const taskText = context.originalTask ?? "";
      const primitiveText = checkPrimitiveResultToo ? context.primitiveResult ?? "" : "";

      const textToCheck = `${taskText}\n${primitiveText}`;
      const selection = detectSelection(textToCheck);

      if (!selection) {
        const res = makeValidationResult({
          success: false,
          startMs: start,
          message:
            "No selection action detected. Waiting for user click selection (__ACTION__:select_*:...).",
        });

        return {
          passed: false,
          reason: res.message,
          duration: res.duration ?? Date.now() - start,
        };
      }

      if (requirePhaseMatch) {
        const match = selectionPhaseMatch(phase, selection);
        if (!match.ok) {
          const res = makeValidationResult({
            success: false,
            startMs: start,
            message: `Selection detected (${selection.type}:${selection.value}) but does not match current phase (${phase}). Expected ${match.expected}.`,
            details: { phase, selection, expected: match.expected },
          });

          return {
            passed: false,
            reason: res.message,
            duration: res.duration ?? Date.now() - start,
          };
        }
      }

      const res = makeValidationResult({
        success: true,
        startMs: start,
        message: "Selection action detected. Validation passed.",
        details: { phase, selection },
      });

      return {
        passed: true,
        reason: res.message,
        duration: res.duration ?? Date.now() - start,
      };
    },
  };
}

