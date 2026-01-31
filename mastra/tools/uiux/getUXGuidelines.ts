




import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadUIUXCSV } from "./loadUIUXCSV";
import { rankRowsByQuery } from "./_rank";

export const getUXGuidelines = createTool({
  id: "uiux.getUXGuidelines",
  description:
    "Retrieve UX guidelines from ui-ux-pro-max ux-guidelines.csv (accessibility, forms, layout, responsive).",
  inputSchema: z.object({
    category: z.string().optional(),
    issue: z.string().optional(),
    platform: z.string().optional(),
    severity: z.string().optional(),
    limit: z.number().int().min(1).max(10).default(5),
  }),
  outputSchema: z.object({
    guidelines: z.array(
      z.object({
        category: z.string(),
        issue: z.string(),
        platform: z.string(),
        description: z.string(),
        do: z.string(),
        dont: z.string(),
        codeExampleGood: z.string(),
        codeExampleBad: z.string(),
        severity: z.string(),
      }),
    ),
    count: z.number(),
  }),
  execute: async (inputData) => {
    const rows = await loadUIUXCSV("ux");
    if (rows.length === 0) return { guidelines: [], count: 0 };

    const query = [inputData.category, inputData.issue, inputData.platform, inputData.severity]
      .filter(Boolean)
      .join(" ");

    const ranked = rankRowsByQuery({ rows, query, limit: inputData.limit ?? 5 });

    const guidelines = ranked.map((row) => ({
      category: row["Category"] || "",
      issue: row["Issue"] || "",
      platform: row["Platform"] || "",
      description: row["Description"] || "",
      do: row["Do"] || "",
      dont: row["Don't"] || "",
      codeExampleGood: row["Code Example Good"] || "",
      codeExampleBad: row["Code Example Bad"] || "",
      severity: row["Severity"] || "",
    }));

    return { guidelines, count: guidelines.length };
  },
});



