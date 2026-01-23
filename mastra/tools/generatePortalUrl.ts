




import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const generatePortalUrl = createTool({
  id: "deploy.generatePortalUrl",
  description: "Generate the deployed portal URL for a dashboard deployment.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    interfaceId: z.string().min(1),
    deploymentId: z.string().min(1),
  }),
  outputSchema: z.object({
    deployedUrl: z.string().min(1),
  }),
  execute: async (inputData) => {
    // NOTE: This is a deterministic placeholder route.
    // Replace later with your real client subdomain routing if needed.
    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL?.startsWith("http")
        ? process.env.VERCEL_URL
        : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

    return {
      deployedUrl: `${base}/portal/${encodeURIComponent(inputData.tenantId)}/dashboards/${encodeURIComponent(
        inputData.interfaceId,
      )}`,
    };
  },
});


