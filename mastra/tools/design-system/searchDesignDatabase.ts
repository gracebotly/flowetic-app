

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getUiUxProMaxSearchScriptPath, runPython, shell } from "./_python";

const Domain = z.enum(["style", "color", "typography", "landing", "chart", "ux", "product", "icons"]);

export const searchDesignDatabase = createTool({
  id: "designDatabase.search",
  description: "Search UI/UX Pro Max via local Python (domain search).",
  inputSchema: z.object({
    query: z.string().min(1),
    domain: Domain,
    maxResults: z.number().int().min(1).max(10).default(3),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    output: z.string(),
    error: z.string().optional(),
  }),
  execute: async (inputData) => {
    const scriptPath = getUiUxProMaxSearchScriptPath();

    const args: string[] = [];
    args.push(shell.shEscape(scriptPath));
    args.push(shell.shEscape(inputData.query));
    args.push("--domain", shell.shEscape(inputData.domain));
    args.push("-n", shell.shEscape(String(inputData.maxResults)));

    try {
      const { stdout, stderr } = await runPython(args);
      if (stderr?.trim()) console.log("[TOOL][designDatabase.search] stderr:", stderr.trim());
      return { success: true, output: String(stdout || "").trim() };
    } catch (e: any) {
      return { success: false, output: "", error: e?.message ?? "PYTHON_EXEC_FAILED" };
    }
  },
});


