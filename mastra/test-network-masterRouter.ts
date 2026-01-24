




import "dotenv/config";
import { mastra } from "./index";

async function main() {
  const agent = mastra.getAgent("masterRouterAgent");
  if (!agent) throw new Error("masterRouterAgent not found");

  const tenantId = process.env.TEST_TENANT_ID || "tenant-test";
  const threadId = process.env.TEST_THREAD_ID || "thread-test";

  const stream = await agent.network("We just connected n8n. What should we do next?", {
    memory: {
      resource: tenantId,
      thread: threadId,
    },
  });

  for await (const chunk of stream) {
    // Minimal visibility for debugging
    if (chunk?.type) console.log(chunk.type);
    if (chunk.type === "network-execution-event-step-finish") {
      console.log("RESULT:", chunk.payload?.result);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});



