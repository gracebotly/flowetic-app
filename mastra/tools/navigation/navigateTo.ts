import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const Page = z.enum([
  "home",
  "connections",
  "chat",
  "projects",
  "clients",
  "activity",
  "settings",
  "project_detail",
]);

export const navigateTo = createTool({
  id: "navigation.navigateTo",
  description:
    "Return a URL for the app to navigate to. Use for moving the user to a page after an action.",
  inputSchema: z.object({
    page: Page,
    resourceId: z.string().uuid().optional().describe("Optional id for detail pages"),
    params: z.record(z.string()).optional().describe("Optional query params"),
  }),
  outputSchema: z.object({
    url: z.string(),
    message: z.string(),
  }),
  execute: async (inputData, context) => {
    const { page, resourceId, params } = context;

    let url = "/";
    switch (page) {
      case "home":
        url = "/";
        break;
      case "connections":
        url = "/control-panel/connections";
        break;
      case "chat":
        url = "/control-panel/chat";
        break;
      case "projects":
        url = "/control-panel/projects";
        break;
      case "project_detail":
        if (!resourceId) throw new Error("MISSING_RESOURCE_ID");
        url = `/control-panel/projects/${resourceId}`;
        break;
      case "clients":
        url = "/control-panel/clients";
        break;
      case "activity":
        url = "/control-panel/activity";
        break;
      case "settings":
        url = "/control-panel/settings";
        break;
      default:
        url = "/";
    }

    if (params && Object.keys(params).length > 0) {
      const qs = new URLSearchParams(params).toString();
      url = `${url}?${qs}`;
    }

    return {
      url,
      message: `Navigate to ${page}`,
    };
  },
});
