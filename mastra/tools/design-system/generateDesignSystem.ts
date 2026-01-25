
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getUiUxProMaxSearchScriptPath, runPythonSearch, shell } from "./_python";

export const generateDesignSystem = createTool({
  id: "designSystem.generate",
  description:
    "Generate a complete UI/UX Pro Max design system using the local Python search script (--design-system).",
  inputSchema: z.object({
    query: z.string().min(1),
    projectName: z.string().optional(),
    format: z.enum(["ascii", "markdown"]).default("ascii"),
    persist: z.boolean().default(false),
    page: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    output: z.string(),
    error: z.string().optional(),
    meta: z
      .object({
        scriptPath: z.string(),
        commandHint: z.string(),
      })
      .optional(),
  }),
  execute: async (inputData) => {
    const scriptPath = getUiUxProMaxSearchScriptPath();

    const args: string[] = [];
    args.push(shell.shEscape(scriptPath));
    args.push(shell.shEscape(inputData.query));
    args.push("--design-system");
    args.push("-f", shell.shEscape(inputData.format));

    if (inputData.projectName) {
      args.push("-p", shell.shEscape(inputData.projectName));
    }
    if (inputData.persist) {
      args.push("--persist");
    }
    if (inputData.page) {
      args.push("--page", shell.shEscape(inputData.page));
    }

    try {
      const { stdout, stderr } = await runPythonSearch(args);
      const output = String(stdout || "").trim();

      if (stderr?.trim()) {
        console.log("[TOOL][designSystem.generate] stderr:", stderr.trim());
      }

      return {
        success: true,
        output,
        meta: {
          scriptPath,
          commandHint: `python3 "${scriptPath}" "${inputData.query}" --design-system`,
        },
      };
    } catch (e: any) {
      return {
        success: false,
        output: "",
        error: e?.message ?? "PYTHON_EXEC_FAILED",
        meta: {
          scriptPath,
          commandHint: `python3 "${scriptPath}" "${inputData.query}" --design-system`,
        },
      };
    }
  },
});

