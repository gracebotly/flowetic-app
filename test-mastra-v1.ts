

import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { RequestContext } from "@mastra/core/request-context";

// Test 1: Agent with v1 instruction pattern
const testAgent: Agent = new Agent({
  id: "testAgent",
  name: "testAgent",
  description: "Test agent for v1.0.4 compatibility",
  instructions: async ({ requestContext }: { requestContext: RequestContext }) => {
    return [
      {
        role: "system",
        content: "Test agent instruction pattern v1.0.4"
      }
    ];
  },
  model: { id: "openai/gpt-4o" },
});

// Test 2: Tool with v1 execute pattern
const testTool = createTool({
  id: "testTool",
  description: "Test tool for v1.0.4 compatibility",
  inputSchema: z.object({
    message: z.string()
  }),
  outputSchema: z.object({
    response: z.string()
  }),
  execute: async (inputData, context) => {
    return { response: `Echo: ${inputData.message}` };
  }
});

// Test 3: Mastra instance with storage
const mastra = new Mastra({
  storage: new LibSQLStore({
    id: "mastra-storage",
    url: process.env.MASTRA_STORAGE_URL || "file:./mastra.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
  agents: {
    testAgent,
    default: testAgent,
  },
});

// Test: Verify imports work
console.log("✅ All Mastra v1.0.4 imports successful");
console.log("✅ Agent with requestContext pattern created successfully");
console.log("✅ Tool with (inputData, context) pattern created successfully");
console.log("✅ Mastra instance with storage created successfully");

export { mastra, testAgent, testTool };
