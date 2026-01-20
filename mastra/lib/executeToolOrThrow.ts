
import type { ToolExecutionContext } from "@mastra/core/tools";

export type ValidationErrorLike = {
  error: boolean;
  message: string;
  validationErrors?: unknown;
};

function isValidationErrorLike(value: unknown): value is ValidationErrorLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    (value as any).error === true &&
    "message" in value &&
    typeof (value as any).message === "string"
  );
}

/**
 * Minimal structural type for Mastra tools.
 * In Mastra v1, Tool.execute can be optional at the type level, so we accept that and throw if missing.
 */
export type ToolLike = {
  execute?: (inputData: any, context?: ToolExecutionContext<any, any>) => Promise<any>;
};

/**
 * Executes a Mastra tool and throws if:
 * - tool.execute is missing
 * - tool returns a ValidationError-like object
 *
 * Returns the successful result with ValidationError stripped out for downstream TS safety.
 */
export async function executeToolOrThrow<TResult>(
  tool: ToolLike,
  inputData: any,
  context?: ToolExecutionContext<any, any>,
): Promise<Exclude<TResult, ValidationErrorLike>> {
  if (typeof tool.execute !== "function") {
    throw new Error("TOOL_EXECUTE_MISSING");
  }

  const result = await tool.execute(inputData, context);

  if (isValidationErrorLike(result)) {
    const msg = `TOOL_OUTPUT_VALIDATION_FAILED: ${result.message}`;
    const err = new Error(msg);
    (err as any).validationErrors = result.validationErrors;
    throw err;
  }

  return result as any;
}
