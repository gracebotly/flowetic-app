export type RuntimeContextLike = {
  get?: (key: string) => any;
  set?: (key: string, value: any) => void;
  [key: string]: any;
};

export type FloweticToolContext = {
  runtimeContext: RuntimeContextLike;
};

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
 * Universal safe tool caller for Flowetic:
 * - Guards optional tool.execute
 * - Throws on ValidationError-like return objects
 *
 * NOTE: We intentionally use FloweticToolContext instead of Mastra ToolExecutionContext
 * because we only rely on `runtimeContext.get()` throughout this app.
 */
export async function callTool<TResult = any>(
  tool: { execute?: (inputData: any, context: any) => Promise<any> },
  inputData: any,
  context: FloweticToolContext,
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
