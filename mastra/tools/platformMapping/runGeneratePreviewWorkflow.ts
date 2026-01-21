
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { triggerGeneratePreview } from "../../../lib/workflows/triggerPreview";

export const runGeneratePreviewWorkflow = createTool({
  id: "runGeneratePreviewWorkflow",
  description: "Triggers the generate preview workflow to create a dashboard preview",
  inputSchema: z.object({
    tenantId: z.string().describe("The tenant ID"),
    threadId: z.string().describe("The thread ID"),
    schemaName: z.string().describe("The schema name"),
    selectedStoryboardKey: z.string().describe("The selected storyboard key"),
    selectedStyleBundleId: z.string().describe("The selected style bundle ID"),
  }),
  execute: async ({ context }) => {
    const result = await triggerGeneratePreview({
      tenantId: context.tenantId,
      threadId: context.threadId,
      schemaName: context.schemaName,
      selectedStoryboardKey: context.selectedStoryboardKey,
      selectedStyleBundleId: context.selectedStyleBundleId,
    });
    return result;
  },
});
