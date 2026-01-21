import type { ToolExecutionContext } from "@mastra/core/tools";

type ValidationErrorLike = {
  error: boolean;
  message: string;
  validationErrors?: unknown;
};

function isValidationErrorLike(value: unknown): value is ValidationErrorLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    (value as any).error === true
  );
}

/**
 * Universal safe tool caller for Mastra v1:
 * - Guards optional tool.execute
 * - Throws on ValidationError-like return objects
 */
export async function callTool<TResult = any>(
  tool: { execute?: (inputData: any, context: ToolExecutionContext<any, any>) => Promise<any> },
  inputData: any,
  context: ToolExecutionContext<any, any>,
): Promise<TResult> {
  if (typeof tool.execute !== "function") {
    throw new Error("TOOL_EXECUTE_MISSING");
  }

  const result = await tool.execute(inputData, context);

  if (isValidationErrorLike(result)) {
    const err = new Error(result.message || "TOOL_OUTPUT_VALIDATION_FAILED");
    (err as any).validationErrors = (result as any).validationErrors;
    throw err;
  }

  return result as TResult;
}
