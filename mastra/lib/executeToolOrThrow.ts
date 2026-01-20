
import type { ToolExecutionContext } from "@mastra/core/tools";

export type ToolLike<TInput, TResult> = {
  execute: (inputData: TInput, context?: ToolExecutionContext<any, any>) => Promise<TResult>;
};

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
 * Executes a Mastra tool and throws if the result is a ValidationError-like object.
 * This makes downstream property access type-safe and prevents TS union errors.
 */
export async function executeToolOrThrow<TInput, TResult>(
  tool: ToolLike<TInput, TResult>,
  inputData: TInput,
  context?: ToolExecutionContext<any, any>,
): Promise<Exclude<TResult, ValidationErrorLike>> {
  const result = await tool.execute(inputData, context);

  if (isValidationErrorLike(result)) {
    const msg = `TOOL_OUTPUT_VALIDATION_FAILED: ${result.message}`;
    const err = new Error(msg);
    (err as any).validationErrors = result.validationErrors;
    throw err;
  }

  return result as any;
}
