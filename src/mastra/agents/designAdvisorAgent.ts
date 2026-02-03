import { Agent } from "@mastra/core/agent";
import { searchUIUXStaticData, generateDesignSystemStatic } from "../tools/design-system/searchUIUXStaticData";
import { getStyleBundles } from "../tools/design/getStyleBundles";

// Legacy imports kept for reference but not used
// import { searchDesignDatabase } from "../tools/design-system/searchDesignDatabase";
// import { generateDesignSystem } from "../tools/design-system/generateDesignSystem";

// Placeholder for recommendStyleKeywords tool
// If this tool exists elsewhere, import it here
const recommendStyleKeywords = {
  id: "design.recommendStyleKeywords",
  description: "Recommend style keywords for dashboard design",
  inputSchema: {
    type: "object" as const,
    properties: {
      dashboardType: { type: "string", description: "Type of dashboard" },
    },
    required: ["dashboardType"],
  },
  execute: async (input: any) => {
    return {
      keywords: ["clean", "modern", "professional"],
    };
  },
};

export const designAdvisorAgent = new Agent({
  name: "Design Advisor",
  instructions: "You are a design system expert. Help users choose appropriate design styles, colors, and typography for their dashboards.",
  tools: {
    searchUIUXStaticData,
    generateDesignSystemStatic,
    getStyleBundles,
    recommendStyleKeywords,
  },
  model: "gpt-4",
});
