

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getUiUxProMaxSearchScriptPath, runPython, shell } from "./_python";

const Domain = z.enum(["style", "color", "typography", "landing", "chart", "ux", "product", "icons"]);
const Stack = z.enum([
  "html-tailwind",
  "react",
  "nextjs",
  "vue",
  "svelte",
  "swiftui",
  "react-native",
  "flutter",
  "shadcn",
  "jetpack-compose",
]);

export const searchDesignDatabase = createTool({
  id: "designDatabase.search",
  description: "Search UI/UX Pro Max via local Python (domain or stack search).",
  inputSchema: z.object({
    query: z.string().min(1),
    domain: Domain.optional(),
    stack: Stack.optional(),
    maxResults: z.number().int().min(1).max(10).default(3),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    output: z.string(),
    error: z.string().optional(),
    meta: z
      .object({
        scriptPath: z.string(),
        used: z.object({
          domain: Domain.optional(),
          stack: Stack.optional(),
          maxResults: z.number(),
        }),
      })
      .optional(),
  }),
  execute: async (inputData) => {
    const scriptPath = getUiUxProMaxSearchScriptPath();

    const args: string[] = [];
    args.push(shell.shEscape(scriptPath));
    args.push(shell.shEscape(inputData.query));

    if (inputData.domain) {
      args.push("--domain", shell.shEscape(inputData.domain));
    } else if (inputData.stack) {
      args.push("--stack", shell.shEscape(inputData.stack));
    }

    args.push("-n", shell.shEscape(String(inputData.maxResults ?? 3)));

    try {
      const { stdout, stderr } = await runPython(args);
      if (stderr?.trim()) console.log("[TOOL][designDatabase.search] stderr:", stderr.trim());

      return {
        success: true,
        output: String(stdout || "").trim(),
        meta: {
          scriptPath,
          used: { domain: inputData.domain, stack: inputData.stack, maxResults: inputData.maxResults ?? 3 },
        },
      };
    } catch (e: any) {
      return {
        success: false,
        output: "",
        error: e?.message ?? "PYTHON_EXEC_FAILED",
        meta: {
          scriptPath,
          used: { domain: inputData.domain, stack: inputData.stack, maxResults: inputData.maxResults ?? 3 },
        },
      };
    }
  },
});


